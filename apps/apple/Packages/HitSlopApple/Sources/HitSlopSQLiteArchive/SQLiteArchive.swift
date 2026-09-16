import Foundation
import SQLite3
import CryptoKit

public struct SQLiteFailure: LocalizedError, Sendable {
    public let message: String
    public init(_ message: String) { self.message = message }
    public var errorDescription: String? { message }
}

public enum SQLiteValue: Sendable, Equatable {
    case null, text(String), blob(Data), integer(Int64), real(Double)
    public var text: String? { if case .text(let s) = self { s } else { nil } }
    public var data: Data? { if case .blob(let b) = self { b } else { nil } }
    public var integer: Int64? { if case .integer(let n) = self { n } else { nil } }
}

/// Experimental flat-file format. Also used by the read-only Finder extensions.
/// Every connection is independently opened; never use immutable=1 on a live file.
public final class SQLiteArchive: @unchecked Sendable {
    public static let applicationID: Int64 = 0x534C5131 // SLQ1, deliberately distinct from production .slop
    public let url: URL
    private var db: OpaquePointer?
    private let lock = NSRecursiveLock()
    private let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

    public init(url: URL, writable: Bool = false, create: Bool = false) throws {
        self.url = url
        if create && FileManager.default.fileExists(atPath: url.path) { throw SQLiteFailure("Destination exists") }
        let flags = (writable ? SQLITE_OPEN_READWRITE : SQLITE_OPEN_READONLY) | (create ? SQLITE_OPEN_CREATE : 0) | SQLITE_OPEN_FULLMUTEX
        guard sqlite3_open_v2(url.path, &db, flags, nil) == SQLITE_OK else {
            let message = db.map { String(cString: sqlite3_errmsg($0)) } ?? "Cannot open SQLite file"
            sqlite3_close(db); db = nil; throw SQLiteFailure(message)
        }
        do {
            sqlite3_busy_timeout(db, 1500)
            try execute("PRAGMA trusted_schema=OFF")
            if create {
                try execute("PRAGMA application_id=\(Self.applicationID)")
                try execute("PRAGMA user_version=1")
                try execute("PRAGMA journal_mode=DELETE")
            } else {
                guard try query("PRAGMA application_id").first?["application_id"]?.integer == Self.applicationID,
                      try query("PRAGMA user_version").first?["user_version"]?.integer == 1 else {
                    throw SQLiteFailure("Not a supported SQLite document spike")
                }
            }
            if writable {
                guard try query("PRAGMA journal_mode").first?["journal_mode"]?.text == "delete" else { throw SQLiteFailure("Expected DELETE journal mode") }
                try execute("PRAGMA synchronous=FULL")
                try execute("PRAGMA fullfsync=ON")
            }
            if create {
                try transaction {
                    try execute("CREATE TABLE sqlar(name TEXT PRIMARY KEY, mode INT, mtime INT, sz INT, data BLOB)")
                    try execute("CREATE TABLE document(id INTEGER PRIMARY KEY CHECK(id=1), identity TEXT NOT NULL, generation INTEGER NOT NULL, checkpoint BLOB NOT NULL, json TEXT NOT NULL, theme TEXT NOT NULL, revision TEXT NOT NULL, cursor INTEGER NOT NULL DEFAULT 0)")
                    try execute("CREATE TABLE outbox(sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, hash TEXT NOT NULL, bytes BLOB NOT NULL)")
                    try execute("CREATE TABLE artwork(kind TEXT PRIMARY KEY CHECK(kind IN ('preview','icon')), generation INTEGER NOT NULL, png BLOB NOT NULL)")
                }
            }
        } catch { sqlite3_close(db); db = nil; throw error }
    }
    deinit { sqlite3_close(db) }
    public func close() throws {
        lock.lock(); defer { lock.unlock() }
        guard let db else { return }
        guard sqlite3_close(db) == SQLITE_OK else { throw SQLiteFailure("SQLite connection is busy") }
        self.db = nil
    }
    private func statement(_ sql: String, _ values: [SQLiteValue]) throws -> OpaquePointer {
        guard let db else { throw SQLiteFailure("Document is closed") }
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK, let statement else { throw SQLiteFailure(String(cString: sqlite3_errmsg(db)) + " (SQLite \(sqlite3_extended_errcode(db)))") }
        do {
            guard sqlite3_bind_parameter_count(statement) == Int32(values.count) else { throw SQLiteFailure("Parameter count mismatch") }
            for (index, value) in values.enumerated() {
                let position = Int32(index + 1)
                let result: Int32
                switch value {
                case .null: result = sqlite3_bind_null(statement, position)
                case .real(let n): result = sqlite3_bind_double(statement, position, n)
                case .integer(let n): result = sqlite3_bind_int64(statement, position, n)
                case .text(let s): result = s.withCString { sqlite3_bind_text(statement, position, $0, -1, transient) }
                case .blob(let bytes):
                    result = bytes.isEmpty ? sqlite3_bind_zeroblob(statement, position, 0) : bytes.withUnsafeBytes { sqlite3_bind_blob(statement, position, $0.baseAddress, Int32($0.count), transient) }
                }
                guard result == SQLITE_OK else { throw SQLiteFailure("Cannot bind SQLite value") }
            }
            return statement
        } catch { sqlite3_finalize(statement); throw error }
    }
    public func execute(_ sql: String, _ values: [SQLiteValue] = []) throws {
        lock.lock(); defer { lock.unlock() }
        let s = try statement(sql, values); defer { sqlite3_finalize(s) }
        let result = sqlite3_step(s)
        guard result == SQLITE_DONE || result == SQLITE_ROW else { throw SQLiteFailure(String(cString: sqlite3_errmsg(db)) + " (SQLite \(sqlite3_extended_errcode(db)))") }
    }
    public func query(_ sql: String, _ values: [SQLiteValue] = []) throws -> [[String: SQLiteValue]] {
        lock.lock(); defer { lock.unlock() }
        let s = try statement(sql, values); defer { sqlite3_finalize(s) }
        var rows: [[String: SQLiteValue]] = []
        while true {
            let result = sqlite3_step(s)
            if result == SQLITE_DONE { return rows }
            guard result == SQLITE_ROW else { throw SQLiteFailure(String(cString: sqlite3_errmsg(db)) + " (SQLite \(sqlite3_extended_errcode(db)))") }
            var row: [String: SQLiteValue] = [:]
            for column in 0..<sqlite3_column_count(s) {
                let key = String(cString: sqlite3_column_name(s, column))
                switch sqlite3_column_type(s, column) {
                case SQLITE_TEXT: row[key] = .text(String(cString: sqlite3_column_text(s, column)))
                case SQLITE_FLOAT: row[key] = .real(sqlite3_column_double(s, column))
                case SQLITE_INTEGER: row[key] = .integer(sqlite3_column_int64(s, column))
                case SQLITE_BLOB:
                    let size = Int(sqlite3_column_bytes(s, column))
                    row[key] = .blob(size == 0 ? Data() : Data(bytes: sqlite3_column_blob(s, column)!, count: size))
                default: row[key] = .null
                }
            }
            rows.append(row)
        }
    }
    public func transaction<T>(_ work: () throws -> T) throws -> T {
        lock.lock(); defer { lock.unlock() }
        try execute("BEGIN IMMEDIATE")
        do { let value = try work(); try execute("COMMIT"); return value }
        catch { try? execute("ROLLBACK"); throw error }
    }
    public static func safePath(_ name: String) -> Bool {
        !name.isEmpty && !name.hasPrefix("/") && !name.contains("\\") && !name.contains("\0") && !name.split(separator: "/", omittingEmptySubsequences: false).contains(where: { $0 == ".." || $0 == "." || $0.isEmpty })
    }
    public func asset(_ name: String) throws -> Data {
        guard Self.safePath(name) else { throw SQLiteFailure("Unsafe archive path") }
        guard let row = try query("SELECT sz,data FROM sqlar WHERE name=? AND length(data)<=67108864", [.text(name)]).first,
              let bytes = row["data"]?.data, row["sz"]?.integer == Int64(bytes.count) else {
            throw SQLiteFailure("Missing, oversized, or compressed asset: \(name)")
        }
        return bytes
    }
    public func putAsset(_ name: String, bytes: Data) throws {
        guard Self.safePath(name), bytes.count <= 67_108_864 else { throw SQLiteFailure("Invalid asset") }
        try execute("INSERT INTO sqlar VALUES(?,420,0,?,?)", [.text(name), .integer(Int64(bytes.count)), .blob(bytes)])
    }
    public func artwork(_ kind: String) throws -> Data {
        if let png = try query("SELECT png FROM artwork WHERE kind=? AND length(png)<=33554432", [.text(kind)]).first?["png"]?.data { return png }
        return try asset(kind == "icon" ? "QuickLook/Icon.png" : "QuickLook/Preview.png")
    }
    public func backup(to destination: URL) throws {
        lock.lock(); defer { lock.unlock() }
        guard !FileManager.default.fileExists(atPath: destination.path), let db else { throw SQLiteFailure("Invalid backup destination or closed document") }
        var output: OpaquePointer?
        guard sqlite3_open(destination.path, &output) == SQLITE_OK, let output else { sqlite3_close(output); throw SQLiteFailure("Cannot create snapshot") }
        defer { sqlite3_close(output) }
        guard let backup = sqlite3_backup_init(output, "main", db, "main") else { throw SQLiteFailure("Cannot start snapshot") }
        let result = sqlite3_backup_step(backup, -1)
        let finish = sqlite3_backup_finish(backup)
        guard result == SQLITE_DONE, finish == SQLITE_OK else { throw SQLiteFailure("Snapshot failed") }
    }
    public static func hash(_ bytes: Data) -> String { SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined() }
}

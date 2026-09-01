import CryptoKit
import Foundation
import HitSlopCore
import SQLite3

private let sqliteTransient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

final class SlopJSONStore {
    let url: URL
    /// Stat-first cache for the change poller: re-read and re-hash the file only
    /// when its modification date or size changes.
    private var revisionCache: (modified: Date, size: UInt64, revision: String)?
    init(url: URL) { self.url = url }

    func open(_ initialValue: Any) throws -> (value: Any, revision: String) {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        if !FileManager.default.fileExists(atPath: url.path) {
            let data = try Self.encode(initialValue)
            do { try data.write(to: url, options: .withoutOverwriting) }
            catch let error as CocoaError where error.code == .fileWriteFileExists { }
        }
        return try read()
    }

    func read() throws -> (value: Any, revision: String) {
        let data = try Data(contentsOf: url)
        return (try JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed]), Self.revision(data))
    }

    func write(_ value: Any, expectedRevision: String?) throws -> String {
        let current = try Data(contentsOf: url)
        if let expectedRevision, expectedRevision != Self.revision(current) { throw SlopPackageError.invalid("revision_conflict") }
        let data = try Self.encode(value)
        try data.write(to: url, options: .atomic)
        return Self.revision(data)
    }

    func revision() throws -> String? {
        guard let attributes = try? FileManager.default.attributesOfItem(atPath: url.path),
              let modified = attributes[.modificationDate] as? Date,
              let size = (attributes[.size] as? NSNumber)?.uint64Value
        else { revisionCache = nil; return nil }
        if let cached = revisionCache, cached.modified == modified, cached.size == size { return cached.revision }
        let revision = Self.revision(try Data(contentsOf: url))
        revisionCache = (modified, size, revision)
        return revision
    }
    private static func encode(_ value: Any) throws -> Data {
        var data = try JSONSerialization.data(withJSONObject: value, options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes, .fragmentsAllowed])
        data.append(0x0a); return data
    }
    private static func revision(_ data: Data) -> String { "sha256:" + SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
}

final class SlopDatabase {
    private var handle: OpaquePointer?
    init(url: URL) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        var database: OpaquePointer?
        guard sqlite3_open_v2(url.path, &database, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK, let database else {
            defer { sqlite3_close(database) }
            throw SlopPackageError.invalid("could not open SQLite store")
        }
        handle = database
        sqlite3_busy_timeout(database, 5_000)
        try executeInternal("PRAGMA foreign_keys=ON")
        try executeInternal("PRAGMA journal_mode=WAL")
        try executeInternal("PRAGMA trusted_schema=OFF")
        sqlite3_limit(database, SQLITE_LIMIT_ATTACHED, 0)
        sqlite3_set_authorizer(database, { _, action, arg1, arg2, _, _ in
            switch action {
            case SQLITE_ATTACH, SQLITE_DETACH, SQLITE_CREATE_VTABLE, SQLITE_DROP_VTABLE: return SQLITE_DENY
            case SQLITE_FUNCTION:
                let name = (arg2 ?? arg1).map { String(cString: $0).lowercased() } ?? ""
                return name == "load_extension" ? SQLITE_DENY : SQLITE_OK
            case SQLITE_PRAGMA:
                let name = arg1.map { String(cString: $0).lowercased() } ?? ""
                return ["data_store_directory", "temp_store_directory", "writable_schema"].contains(name) ? SQLITE_DENY : SQLITE_OK
            default: return SQLITE_OK
            }
        }, nil)
    }
    deinit { close() }

    func query(_ sql: String, parameters: [Any]) throws -> [[String: Any]] {
        let normalized = sql.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if normalized.hasPrefix("pragma "), !["pragma table_info", "pragma table_xinfo", "pragma index_list", "pragma index_info", "pragma foreign_key_list"].contains(where: normalized.hasPrefix) {
            throw SlopPackageError.invalid("this PRAGMA is not available to guest queries")
        }
        let statement = try prepareSingle(sql); defer { sqlite3_finalize(statement) }
        guard sqlite3_stmt_readonly(statement) != 0 else { throw SlopPackageError.invalid("query only accepts read-only SQL") }
        try bind(parameters, to: statement)
        var rows: [[String: Any]] = []
        while true {
            switch sqlite3_step(statement) {
            case SQLITE_ROW:
                var row: [String: Any] = [:]
                for index in 0..<sqlite3_column_count(statement) {
                    let key = sqlite3_column_name(statement, index).map { String(cString: $0) } ?? "column_\(index)"
                    row[key] = column(statement, index)
                }
                rows.append(row)
            case SQLITE_DONE: return rows
            default: throw error()
            }
        }
    }

    func execute(_ sql: String, parameters: [Any]) throws -> Int {
        let first = sql.trimmingCharacters(in: .whitespacesAndNewlines).split(whereSeparator: { $0.isWhitespace }).first?.lowercased() ?? ""
        guard !["pragma", "begin", "commit", "rollback", "savepoint", "release", "attach", "detach"].contains(first) else { throw SlopPackageError.invalid("transaction and connection control are host-owned") }
        let statement = try prepareSingle(sql); defer { sqlite3_finalize(statement) }
        guard sqlite3_stmt_readonly(statement) == 0 else { throw SlopPackageError.invalid("execute only accepts mutating SQL") }
        try bind(parameters, to: statement)
        guard sqlite3_step(statement) == SQLITE_DONE else { throw error() }
        return Int(sqlite3_changes(handle))
    }

    func transaction(_ statements: [(String, [Any])]) throws -> Int {
        try executeInternal("BEGIN IMMEDIATE")
        do {
            var changes = 0
            for (sql, parameters) in statements { changes += try execute(sql, parameters: parameters) }
            try executeInternal("COMMIT")
            return changes
        } catch { try? executeInternal("ROLLBACK"); throw error }
    }

    func dataVersion() throws -> Int64 {
        let statement = try prepareSingle("PRAGMA data_version"); defer { sqlite3_finalize(statement) }
        guard sqlite3_step(statement) == SQLITE_ROW else { throw error() }
        return sqlite3_column_int64(statement, 0)
    }

    func checkpoint() {
        guard let handle else { return }
        if sqlite3_wal_checkpoint_v2(handle, nil, SQLITE_CHECKPOINT_TRUNCATE, nil, nil) != SQLITE_OK {
            sqlite3_wal_checkpoint_v2(handle, nil, SQLITE_CHECKPOINT_PASSIVE, nil, nil)
        }
    }
    func close() { if let handle { checkpoint(); sqlite3_close_v2(handle); self.handle = nil } }

    private func prepareSingle(_ sql: String) throws -> OpaquePointer {
        guard let handle else { throw SlopPackageError.invalid("SQLite store is closed") }
        var statement: OpaquePointer?, remainder = ""
        let result = sql.withCString { source in
            var tail: UnsafePointer<CChar>?
            let result = sqlite3_prepare_v2(handle, source, -1, &statement, &tail)
            if let tail { remainder = String(cString: tail) }
            return result
        }
        guard result == SQLITE_OK, let statement else { throw error() }
        guard remainder.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { sqlite3_finalize(statement); throw SlopPackageError.invalid("only one SQL statement is allowed") }
        return statement
    }

    private func bind(_ parameters: [Any], to statement: OpaquePointer) throws {
        guard parameters.count == Int(sqlite3_bind_parameter_count(statement)) else { throw SlopPackageError.invalid("SQLite parameter count mismatch") }
        for (offset, value) in parameters.enumerated() {
            let index = Int32(offset + 1), result: Int32
            switch value {
            case is NSNull: result = sqlite3_bind_null(statement, index)
            case let value as Bool: result = sqlite3_bind_int(statement, index, value ? 1 : 0)
            case let value as Int: result = sqlite3_bind_int64(statement, index, Int64(value))
            case let value as Int64: result = sqlite3_bind_int64(statement, index, value)
            case let value as Double: result = sqlite3_bind_double(statement, index, value)
            case let value as NSNumber: result = sqlite3_bind_double(statement, index, value.doubleValue)
            case let value as String: result = sqlite3_bind_text(statement, index, value, -1, sqliteTransient)
            case let value as Data: result = value.withUnsafeBytes { sqlite3_bind_blob(statement, index, $0.baseAddress, Int32($0.count), sqliteTransient) }
            default: throw SlopPackageError.invalid("unsupported SQLite parameter")
            }
            guard result == SQLITE_OK else { throw error() }
        }
    }

    private func column(_ statement: OpaquePointer, _ index: Int32) -> Any {
        switch sqlite3_column_type(statement, index) {
        case SQLITE_INTEGER: return sqlite3_column_int64(statement, index)
        case SQLITE_FLOAT: return sqlite3_column_double(statement, index)
        case SQLITE_TEXT: return sqlite3_column_text(statement, index).map { String(cString: $0) } ?? NSNull()
        case SQLITE_BLOB:
            let count = Int(sqlite3_column_bytes(statement, index)); guard count > 0, let bytes = sqlite3_column_blob(statement, index) else { return ["$blob": ""] }
            return ["$blob": Data(bytes: bytes, count: count).base64EncodedString()]
        default: return NSNull()
        }
    }

    private func executeInternal(_ sql: String) throws {
        guard let handle else { throw SlopPackageError.invalid("SQLite store is closed") }
        guard sqlite3_exec(handle, sql, nil, nil, nil) == SQLITE_OK else { throw error() }
    }
    private func error() -> SlopPackageError { .invalid(handle.map { String(cString: sqlite3_errmsg($0)) } ?? "SQLite store is closed") }
}

import Foundation
import SQLite3
import Darwin
import HitSlopCore

/// Host bookkeeping only. App resources and editable projections remain files.
public final class SlopSyncStorage {
    struct Metadata: Codable {
        var documentId: String
        var schema: String
        var transport: SlopLoroTransport
        var generation = 0
        var cursor = 0
        var shareSeed: SlopLoroTransfer?
        var materializedHash: String?
        var pendingProjection: Data?
        var receipts: [String: String] = [:]
    }
    struct Snapshot {
        let metadata: Metadata
        let checkpoint: Data
        let updates: [Data]
    }
    enum Value { case text(String), blob(Data), integer(Int), null }
    private var db: OpaquePointer?
    private let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
    let url: URL
    var beforeCommit: (() throws -> Void)?

    public init(root: URL) throws {
        // Foundation preserves /var aliases on macOS; SQLite NOFOLLOW requires
        // the actual filesystem path, including the trusted package's ancestors.
        guard let resolvedRoot = realpath(root.path, nil) else { throw SlopDocumentError("Cannot locate document directory") }
        let canonicalRoot = URL(fileURLWithPath: String(cString: resolvedRoot))
        free(resolvedRoot)
        let directory = canonicalRoot.appendingPathComponent("state", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let directoryInfo = try directory.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey])
        guard directoryInfo.isDirectory == true, directoryInfo.isSymbolicLink != true else { throw SlopDocumentError("Unsafe document state directory") }
        url = directory.appendingPathComponent("document.sqlite")
        if FileManager.default.fileExists(atPath: url.path) {
            let info = try url.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey])
            guard info.isRegularFile == true, info.isSymbolicLink != true else { throw SlopDocumentError("Unsafe document database") }
        }
        guard sqlite3_open_v2(url.path, &db, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX | SQLITE_OPEN_NOFOLLOW, nil) == SQLITE_OK else {
            let error = failure(); sqlite3_close(db); db = nil; throw error
        }
        do {
            try execute("PRAGMA trusted_schema=OFF")
            sqlite3_limit(db, SQLITE_LIMIT_LENGTH, 32 * 1024 * 1024)
            sqlite3_limit(db, SQLITE_LIMIT_SQL_LENGTH, 64 * 1024)
            sqlite3_limit(db, SQLITE_LIMIT_COLUMN, 64)
            sqlite3_busy_timeout(db, 5000)
            try transaction {
                let version = try rows("PRAGMA user_version") { sqlite3_column_int($0, 0) }.first ?? -1
                let empty = try rows("SELECT name FROM sqlite_schema") { try self.text($0, 0) }.isEmpty
                if empty && version == 0 {
                    for sql in Self.tables.values { try execute(sql) }
                    try execute("PRAGMA user_version=1")
                } else {
                    guard version == 1 else { throw SlopDocumentError("Unsupported document database format; v1 is required. Preserve this document and create a new one.") }
                    try validateSchema()
                }
            }
            try execute("PRAGMA journal_mode=DELETE")
            try execute("PRAGMA synchronous=FULL")
        } catch { sqlite3_close(db); db = nil; throw error }
    }
    private static let tables = [
        "document": "CREATE TABLE document (id INTEGER PRIMARY KEY CHECK(id=1), generation INTEGER NOT NULL, metadata BLOB NOT NULL, checkpoint BLOB NOT NULL)",
        "updates": "CREATE TABLE updates (sequence INTEGER PRIMARY KEY AUTOINCREMENT, bytes BLOB NOT NULL)",
        "outbox": "CREATE TABLE outbox (sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, hash TEXT NOT NULL, bytes BLOB NOT NULL)",
    ]
    private func validateSchema() throws {
        func normalized(_ sql: String) -> String { sql.lowercased().filter { !$0.isWhitespace } }
        let objects = try rows("SELECT type,name,tbl_name,sql FROM sqlite_schema") { statement in
            (try self.text(statement, 0), try self.text(statement, 1), try self.text(statement, 2),
             sqlite3_column_type(statement, 3) == SQLITE_NULL ? nil : try self.text(statement, 3))
        }
        if objects.isEmpty { return }
        var tables = Set<String>()
        for (type, name, table, sql) in objects {
            if type == "table", let expected = Self.tables[name], let sql, normalized(sql) == normalized(expected) {
                tables.insert(name)
            } else if type == "table", name == "sqlite_sequence", let sql, normalized(sql) == "createtablesqlite_sequence(name,seq)" {
                continue
            } else if type == "index", name == "sqlite_autoindex_outbox_1", table == "outbox", sql == nil {
                continue
            } else { throw SlopDocumentError("Unexpected document database schema") }
        }
        guard tables == Set(Self.tables.keys) else { throw SlopDocumentError("Incomplete document database schema") }
    }
    deinit { sqlite3_close(db) }
    private func failure() -> SlopDocumentError {
        SlopDocumentError(db.map { String(cString: sqlite3_errmsg($0)) } ?? "Document database is closed")
    }
    private func statement(_ sql: String, _ values: [Value]) throws -> OpaquePointer {
        guard let db else { throw failure() }
        var result: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &result, nil) == SQLITE_OK, let result else { throw failure() }
        do {
            guard sqlite3_bind_parameter_count(result) == Int32(values.count) else { throw SlopDocumentError("Incorrect SQL parameters") }
            for (index, value) in values.enumerated() {
                let position = Int32(index + 1)
                let status: Int32
                switch value {
                case .integer(let n): status = sqlite3_bind_int64(result, position, Int64(n))
                case .text(let text): status = text.withCString { sqlite3_bind_text(result, position, $0, -1, transient) }
                case .blob(let data):
                    status = data.isEmpty ? sqlite3_bind_zeroblob(result, position, 0) : data.withUnsafeBytes {
                        sqlite3_bind_blob(result, position, $0.baseAddress, Int32($0.count), transient)
                    }
                case .null: status = sqlite3_bind_null(result, position)
                }
                guard status == SQLITE_OK else { throw failure() }
            }
            return result
        } catch { sqlite3_finalize(result); throw error }
    }
    func execute(_ sql: String, _ values: [Value] = []) throws {
        let statement = try statement(sql, values); defer { sqlite3_finalize(statement) }
        var status = sqlite3_step(statement)
        while status == SQLITE_ROW { status = sqlite3_step(statement) }
        guard status == SQLITE_DONE else { throw failure() }
    }
    private func rows<T>(_ sql: String, _ values: [Value] = [], read: (OpaquePointer) throws -> T) throws -> [T] {
        let statement = try statement(sql, values); defer { sqlite3_finalize(statement) }
        var values: [T] = []
        var totalBytes = 0
        var status = sqlite3_step(statement)
        while status == SQLITE_ROW {
            guard values.count < 10_000 else { throw SlopLimitError("Document database contains too many records") }
            for column in 0..<sqlite3_column_count(statement) { totalBytes += Int(sqlite3_column_bytes(statement, column)) }
            guard totalBytes <= 64 * 1024 * 1024 else { throw SlopLimitError("Document database result exceeds 64 MiB") }
            values.append(try read(statement)); status = sqlite3_step(statement)
        }
        guard status == SQLITE_DONE else { throw failure() }
        return values
    }
    private func blob(_ statement: OpaquePointer, _ column: Int32) throws -> Data {
        guard sqlite3_column_type(statement, column) == SQLITE_BLOB else { throw SlopDocumentError("Expected database bytes") }
        let size = Int(sqlite3_column_bytes(statement, column))
        guard size <= 32 * 1024 * 1024 else { throw SlopLimitError("Database value exceeds 32 MiB") }
        if size == 0 { return Data() }
        guard let pointer = sqlite3_column_blob(statement, column) else { throw SlopDocumentError("Missing database bytes") }
        return Data(bytes: pointer, count: size)
    }
    private func text(_ statement: OpaquePointer, _ column: Int32) throws -> String {
        guard sqlite3_column_type(statement, column) == SQLITE_TEXT, sqlite3_column_bytes(statement, column) <= 64 * 1024,
              let pointer = sqlite3_column_text(statement, column) else { throw SlopDocumentError("Expected database text") }
        return String(cString: pointer)
    }
    func transaction<T>(_ action: () throws -> T) throws -> T {
        try execute("BEGIN IMMEDIATE")
        do {
            let result = try action()
            try beforeCommit?()
            try execute("COMMIT")
            return result
        } catch { try? execute("ROLLBACK"); throw error }
    }
    func generation() throws -> Int? {
        try rows("SELECT generation FROM document") { Int(sqlite3_column_int64($0, 0)) }.first
    }
    private func metadata(_ bytes: Data) throws -> Metadata {
        try SlopJSONLimits.check(bytes, maximumBytes: 32 * 1024 * 1024)
        return try JSONDecoder().decode(Metadata.self, from: bytes)
    }
    func load() throws -> Snapshot? {
        guard let record = try rows("SELECT metadata,checkpoint FROM document", read: {
            (try metadata(blob($0, 0)), try blob($0, 1))
        }).first else { return nil }
        return Snapshot(metadata: record.0, checkpoint: record.1,
                        updates: try rows("SELECT bytes FROM updates ORDER BY sequence") { try blob($0, 0) })
    }
    func initialize(_ metadata: Metadata, checkpoint: Data) throws {
        try execute("INSERT INTO document(id,generation,metadata,checkpoint) VALUES(1,?,?,?)",
                    [.integer(metadata.generation), .blob(try JSONEncoder().encode(metadata)), .blob(checkpoint)])
    }
    func save(_ metadata: Metadata, update: Data? = nil, checkpoint: Data? = nil) throws {
        try execute("UPDATE document SET generation=?,metadata=? WHERE id=1",
                    [.integer(metadata.generation), .blob(try JSONEncoder().encode(metadata))])
        if let update { try execute("INSERT INTO updates(bytes) VALUES(?)", [.blob(update)]) }
        if let checkpoint {
            try execute("UPDATE document SET checkpoint=? WHERE id=1", [.blob(checkpoint)])
            try execute("DELETE FROM updates")
        }
    }
    func needsCheckpoint(adding bytes: Int) throws -> Bool {
        try rows("SELECT COUNT(*),COALESCE(SUM(length(bytes)),0) FROM updates") {
            sqlite3_column_int64($0, 0) + 1 >= 100 || sqlite3_column_int64($0, 1) + Int64(bytes) >= 1024 * 1024
        }.first ?? false
    }
    func enqueue(_ batch: SlopLoroBatch) throws {
        try execute("INSERT INTO outbox(id,hash,bytes) VALUES(?,?,?)", [.text(batch.id), .text(batch.hash), .blob(try batch.decoded())])
    }
    func outbox() throws -> [SlopLoroBatch] {
        try rows("SELECT id,hash,bytes FROM outbox ORDER BY sequence") {
            try SlopLoroBatch(id: text($0, 0), hash: text($0, 1), bytes: blob($0, 2).base64EncodedString())
        }
    }
    func nextBatch() throws -> SlopLoroBatch? {
        try rows("SELECT id,hash,bytes FROM outbox ORDER BY sequence LIMIT 1") {
            try SlopLoroBatch(id: text($0, 0), hash: text($0, 1), bytes: blob($0, 2).base64EncodedString())
        }.first
    }
    func queuedBatchCount() throws -> Int {
        try rows("SELECT COUNT(*) FROM outbox") { Int(sqlite3_column_int64($0, 0)) }.first ?? 0
    }
    func acknowledge(id: String, hash: String) throws {
        guard let first = try nextBatch(), first.id == id, first.hash == hash else { throw SlopDocumentError("Invalid upload acknowledgement") }
        try execute("DELETE FROM outbox WHERE id=? AND hash=?", [.text(id), .text(hash)])
    }
    public func backup(to destination: URL) throws {
        guard !FileManager.default.fileExists(atPath: destination.path), let db else { throw SlopDocumentError("Invalid database backup destination") }
        var target: OpaquePointer?
        guard sqlite3_open(destination.path, &target) == SQLITE_OK, let target else {
            sqlite3_close(target); throw SlopDocumentError("Cannot open database backup")
        }
        defer { sqlite3_close(target) }
        guard let backup = sqlite3_backup_init(target, "main", db, "main") else { throw SlopDocumentError("Cannot start database backup") }
        let status = sqlite3_backup_step(backup, -1), finished = sqlite3_backup_finish(backup)
        guard status == SQLITE_DONE, finished == SQLITE_OK else { throw SlopDocumentError("Database backup failed") }
    }
}

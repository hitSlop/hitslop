import CryptoKit
import Darwin
import Foundation
import HitSlopCore
import SQLite3

/// Host bookkeeping only. App resources and editable projections remain files.
public final class SlopCommandStorage {
    struct Timings {
        var load = 0.0
        var apply = 0.0
        var save = 0.0
    }
    var timings = Timings()
    private func elapsed(_ start: ContinuousClock.Instant) -> Double {
        let value = start.duration(to: .now).components
        return Double(value.seconds) * 1000 + Double(value.attoseconds) / 1e15
    }
    public struct ExternalOpening: Codable, Sendable {
        public var authority: String
        public var lease: SlopDocumentJSON
    }
    public struct Metadata: Codable, Sendable {
        public var mode: SlopDocumentMode
        public var pendingProjection = false
        public var outstanding: [String: SlopDocumentJSON] = [:]
        public var promotion: SlopDocumentJSON?
        public var externalOpening: ExternalOpening?
        public var materializedHash: String?
        public var proposalHash: String?
        public var proposalPath: String?
        public var proposalReason: String?
        public init(mode: SlopDocumentMode, pendingProjection: Bool = false) {
            self.mode = mode
            self.pendingProjection = pendingProjection
        }
    }
    public struct Record: Codable, Sendable {
        public var snapshot: SlopDocumentJSON
        public var metadata: Metadata
    }
    enum Value {
        case text(String)
        case blob(Data)
        case integer(Int)
        case null
    }
    private var db: OpaquePointer?
    private let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
    let url: URL
    var beforeCommit: (() throws -> Void)?

    public init(root: URL) throws {
        // Foundation preserves /var aliases on macOS; SQLite NOFOLLOW requires
        // the actual filesystem path, including the trusted package's ancestors.
        guard let resolvedRoot = realpath(root.path, nil) else {
            throw SlopDocumentError("Cannot locate document directory")
        }
        let canonicalRoot = URL(fileURLWithPath: String(cString: resolvedRoot))
        free(resolvedRoot)
        let directory = canonicalRoot.appendingPathComponent("state", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let directoryInfo = try directory.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey])
        guard directoryInfo.isDirectory == true, directoryInfo.isSymbolicLink != true else {
            throw SlopDocumentError("Unsafe document state directory")
        }
        url = directory.appendingPathComponent("document.sqlite")
        if FileManager.default.fileExists(atPath: url.path) {
            let info = try url.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey])
            guard info.isRegularFile == true, info.isSymbolicLink != true else {
                throw SlopDocumentError("Unsafe document database")
            }
        }
        guard
            sqlite3_open_v2(
                url.path, &db,
                SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX | SQLITE_OPEN_NOFOLLOW, nil)
                == SQLITE_OK
        else {
            let error = failure()
            sqlite3_close(db)
            db = nil
            throw error
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
                    try execute("PRAGMA user_version=3")
                } else {
                    guard version == 3 else {
                        throw SlopDocumentError(
                            "Unsupported document database format"
                        )
                    }
                    try validateSchema()
                }
            }
            try execute("PRAGMA journal_mode=DELETE")
            try execute("PRAGMA synchronous=FULL")
        } catch {
            sqlite3_close(db)
            db = nil
            throw error
        }
    }
    // Receipts deduplicate command/undo retries and resolve external imports after a
    // crash between commit and projection bookkeeping. externalOpening reuses the ID.
    private static let tables = [
        "document":
            "CREATE TABLE document (id INTEGER PRIMARY KEY CHECK(id=1), snapshot BLOB NOT NULL, metadata BLOB NOT NULL)",
        "undo": "CREATE TABLE undo (id INTEGER PRIMARY KEY CHECK(id=1), lease TEXT NOT NULL, request TEXT NOT NULL, revision INTEGER NOT NULL, snapshot BLOB NOT NULL)",
        "leases": "CREATE TABLE leases (id TEXT PRIMARY KEY, expires INTEGER NOT NULL)",
        "receipts":
            "CREATE TABLE receipts (lease TEXT NOT NULL, request TEXT NOT NULL, digest BLOB NOT NULL CHECK(length(digest)=32), result BLOB NOT NULL, PRIMARY KEY(lease,request))",
    ]
    private func validateSchema() throws {
        func normalized(_ sql: String) -> String { sql.lowercased().filter { !$0.isWhitespace } }
        let objects = try rows("SELECT type,name,tbl_name,sql FROM sqlite_schema") { statement in
            (
                try self.text(statement, 0), try self.text(statement, 1), try self.text(statement, 2),
                sqlite3_column_type(statement, 3) == SQLITE_NULL ? nil : try self.text(statement, 3)
            )
        }
        var tables = Set<String>()
        for (type, name, table, sql) in objects {
            if type == "table", let expected = Self.tables[name], let sql, normalized(sql) == normalized(expected) {
                tables.insert(name)
            } else if type == "index", ["sqlite_autoindex_leases_1", "sqlite_autoindex_receipts_1"].contains(name),
                ["leases", "receipts"].contains(table), sql == nil
            {
                continue
            } else {
                throw SlopDocumentError("Unexpected document database schema")
            }
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
            guard sqlite3_bind_parameter_count(result) == Int32(values.count) else {
                throw SlopDocumentError("Incorrect SQL parameters")
            }
            for (index, value) in values.enumerated() {
                let position = Int32(index + 1)
                let status: Int32
                switch value {
                case .integer(let n): status = sqlite3_bind_int64(result, position, Int64(n))
                case .text(let text):
                    status = text.withCString {
                        sqlite3_bind_text(result, position, $0, Int32(text.utf8.count), transient)
                    }
                case .blob(let data):
                    status =
                        data.isEmpty
                        ? sqlite3_bind_zeroblob(result, position, 0)
                        : data.withUnsafeBytes {
                            sqlite3_bind_blob(result, position, $0.baseAddress, Int32($0.count), transient)
                        }
                case .null: status = sqlite3_bind_null(result, position)
                }
                guard status == SQLITE_OK else { throw failure() }
            }
            return result
        } catch {
            sqlite3_finalize(result)
            throw error
        }
    }
    func execute(_ sql: String, _ values: [Value] = []) throws {
        let statement = try statement(sql, values)
        defer { sqlite3_finalize(statement) }
        var status = sqlite3_step(statement)
        while status == SQLITE_ROW { status = sqlite3_step(statement) }
        guard status == SQLITE_DONE else { throw failure() }
    }
    private func rows<T>(_ sql: String, _ values: [Value] = [], read: (OpaquePointer) throws -> T) throws -> [T] {
        let statement = try statement(sql, values)
        defer { sqlite3_finalize(statement) }
        var values: [T] = []
        var totalBytes = 0
        var status = sqlite3_step(statement)
        while status == SQLITE_ROW {
            guard values.count < 10_000 else { throw SlopLimitError("Document database contains too many records") }
            for column in 0..<sqlite3_column_count(statement) {
                totalBytes += Int(sqlite3_column_bytes(statement, column))
            }
            guard totalBytes <= 64 * 1024 * 1024 else {
                throw SlopLimitError("Document database result exceeds 64 MiB")
            }
            values.append(try read(statement))
            status = sqlite3_step(statement)
        }
        guard status == SQLITE_DONE else { throw failure() }
        return values
    }
    private func blob(_ statement: OpaquePointer, _ column: Int32) throws -> Data {
        guard sqlite3_column_type(statement, column) == SQLITE_BLOB else {
            throw SlopDocumentError("Expected database bytes")
        }
        let size = Int(sqlite3_column_bytes(statement, column))
        guard size <= 32 * 1024 * 1024 else { throw SlopLimitError("Database value exceeds 32 MiB") }
        if size == 0 { return Data() }
        guard let pointer = sqlite3_column_blob(statement, column) else {
            throw SlopDocumentError("Missing database bytes")
        }
        return Data(bytes: pointer, count: size)
    }
    private func text(_ statement: OpaquePointer, _ column: Int32) throws -> String {
        guard sqlite3_column_type(statement, column) == SQLITE_TEXT,
            sqlite3_column_bytes(statement, column) <= 64 * 1024,
            let pointer = sqlite3_column_text(statement, column)
        else { throw SlopDocumentError("Expected database text") }
        return String(cString: pointer)
    }
    func transaction<T>(_ action: () throws -> T) throws -> T {
        try execute("BEGIN IMMEDIATE")
        do {
            let result = try action()
            try beforeCommit?()
            try execute("COMMIT")
            return result
        } catch {
            try? execute("ROLLBACK")
            throw error
        }
    }
    public func load() throws -> Record? {
        try rows("SELECT snapshot,metadata FROM document") {
            let record = try Record(snapshot: SlopDocumentJSON(data: blob($0, 0)), metadata: JSONDecoder().decode(Metadata.self, from: blob($0, 1)))
            guard (record.metadata.mode == .promoting) == (record.metadata.promotion != nil) else {
                throw SlopDocumentError("Invalid document authority metadata")
            }
            return record
        }.first
    }
    public func initialize(snapshot: SlopDocumentJSON, metadata: Metadata = .init(mode: .local)) throws {
        try transaction {
            guard try load() == nil else { return }
            try execute(
                "INSERT INTO document(id,snapshot,metadata) VALUES(1,?,?)",
                [.blob(try snapshotBytes(snapshot)), .blob(try JSONEncoder().encode(metadata))])
        }
    }
    /// The exact data and assembled snapshot must both be readable before committing.
    private func snapshotBytes(_ snapshot: SlopDocumentJSON, preparedData: Data? = nil) throws -> Data {
        let data = try preparedData ?? snapshot["data"].encoded(
            maximumBytes: SlopJSONLimits.documentBytes, maximumDepth: SlopJSONLimits.maximumDepth)
        try SlopJSONLimits.check(data)
        var header = snapshot.object
        header.removeValue(forKey: "data")
        var bytes = try SlopDocumentJSON.object(header).encoded()
        bytes.removeLast()
        bytes.append(contentsOf: (header.isEmpty ? "\"data\":" : ",\"data\":").utf8)
        bytes.append(data)
        bytes.append(UInt8(ascii: "}"))
        try SlopJSONLimits.check(bytes, maximumBytes: SlopFile.maximumBytes, maximumDepth: SlopJSONLimits.maximumDepth + 1)
        return bytes
    }
    public func save(_ record: Record, preparedData: Data? = nil, preservingUndo: Bool = false) throws {
        let snapshot = try snapshotBytes(record.snapshot, preparedData: preparedData)
        let metadata = try JSONEncoder().encode(record.metadata)
        if !preservingUndo { try execute("DELETE FROM undo") }
        try execute("UPDATE document SET snapshot=?,metadata=? WHERE id=1", [.blob(snapshot), .blob(metadata)])
    }
    public func saveMetadata(_ metadata: Metadata) throws {
        try execute("UPDATE document SET metadata=? WHERE id=1", [.blob(try JSONEncoder().encode(metadata))])
    }
    public func open(now: Int = Int(Date().timeIntervalSince1970 * 1000)) throws -> SlopDocumentJSON {
        try transaction {
            guard let record = try load() else { throw SlopDocumentError("Document is not initialized") }
            let id = UUID().uuidString
            let expiry = now + slopRetryWindowMilliseconds
            try execute("DELETE FROM receipts WHERE lease IN (SELECT id FROM leases WHERE expires<=?)", [.integer(now)])
            try execute("DELETE FROM undo WHERE lease IN (SELECT id FROM leases WHERE expires<=?)", [.integer(now)])
            try execute("DELETE FROM leases WHERE expires<=?", [.integer(now)])
            try execute("INSERT INTO leases(id,expires) VALUES(?,?)", [.text(id), .integer(expiry)])
            return .object([
                "snapshot": record.snapshot,
                "lease": .object(["id": .string(id), "expiresAt": .number(Double(expiry))]),
            ])
        }
    }
    /// Reload, execute, receipt and commit under one cross-process write lock.
    public func apply(
        _ request: SlopDocumentJSON, schema: SlopDocumentSchema, now: Int = Int(Date().timeIntervalSince1970 * 1000)
    ) throws -> (snapshot: SlopDocumentJSON, result: SlopDocumentJSON, metadata: Metadata) {
        try transaction {
            let start = ContinuousClock.now
            guard var record = try load() else { throw SlopDocumentError("Document is not initialized") }
            timings.load = elapsed(start)
            func outcome(_ result: SlopDocumentJSON) -> (SlopDocumentJSON, SlopDocumentJSON, Metadata) {
                (record.snapshot, result, record.metadata)
            }
            func rejected(_ code: String, _ message: String) -> SlopDocumentJSON {
                .object(["ok": .bool(false), "error": .object(["code": .string(code), "message": .string(message)])])
            }
            let required: Set<String> = ["documentId", "schemaHash", "authority", "leaseId", "requestId"]
            let payload = request.object["ops"] != nil ? "ops" : request.object["undo"] != nil ? "undo" : "replace"
            guard Set(request.object.keys) == required.union([payload]),
                required.allSatisfy({ request[$0].string?.isEmpty == false })
            else {
                return outcome(rejected("invalid_request", "Invalid command envelope"))
            }
            let operations: [(SlopDocumentJSON, [SlopPathStep])]
            do {
                if payload == "ops" {
                    operations = try SlopDocumentOps.parse(request["ops"])
                } else if payload == "undo" {
                    operations = []
                    let undo = request["undo"]
                    guard Set(undo.object.keys) == ["requestId", "revision"], undo["requestId"].string?.isEmpty == false,
                        let revision = undo["revision"].number, revision >= 1, revision.rounded() == revision,
                        revision <= 9_007_199_254_740_991
                    else { throw SlopCommandError("invalid_request", "Invalid undo") }
                } else {
                    operations = []
                    let replacement = request["replace"]
                    guard Set(replacement.object.keys) == ["baseRevision", "data"],
                        let base = replacement["baseRevision"].number, base >= 0, base.rounded() == base,
                        base <= 9_007_199_254_740_991
                    else { throw SlopCommandError("invalid_request", "Invalid replacement") }
                }
            } catch { return outcome(rejected("invalid_request", error.localizedDescription)) }
            guard ["documentId", "schemaHash", "authority"].allSatisfy({ request[$0] == record.snapshot[$0] }) else {
                return outcome(rejected("authority_changed", "Reopen the current document authority"))
            }
            let lease = request["leaseId"].string!
            let id = request["requestId"].string!
            guard
                let expiry = try rows(
                    "SELECT expires FROM leases WHERE id=?", [.text(lease)], read: { sqlite3_column_int64($0, 0) }
                ).first, expiry > now
            else {
                return outcome(rejected("lease_expired", "This attempt can no longer execute"))
            }
            let digest = Data(SHA256.hash(data: try request.encoded()))
            if let receipt = try rows(
                "SELECT digest,result FROM receipts WHERE lease=? AND request=?", [.text(lease), .text(id)],
                read: {
                    (try blob($0, 0), try SlopDocumentJSON(data: blob($0, 1)))
                }
            ).first {
                return outcome(
                    receipt.0 == digest
                        ? receipt.1 : rejected("request_reused", "Request ID reused with different content"))
            }
            guard record.metadata.mode == .local else {
                return outcome(rejected("offline", "This document is owned by its shared authority"))
            }
            let result: SlopDocumentJSON
            var prepared: SlopDocumentSchema.Prepared?
            let applying = ContinuousClock.now
            do {
                let document: SlopDocumentSchema.Prepared
                if payload == "undo" {
                    let target = request["undo"]
                    guard target["revision"] == record.snapshot["revision"],
                        let undo = try rows("SELECT lease,request,revision,snapshot FROM undo WHERE id=1", read: {
                            (try self.text($0, 0), try self.text($0, 1), sqlite3_column_int64($0, 2), try SlopDocumentJSON(data: blob($0, 3)))
                        }).first, Double(undo.2) == record.snapshot["revision"].number
                    else { throw SlopCommandError("stale_revision", "Undo unavailable after another change.") }
                    guard undo.0 == lease, undo.1 == target["requestId"].string else {
                        throw SlopCommandError("rejected", "Undo belongs to another command or session")
                    }
                    guard ["documentId", "schemaHash", "authority"].allSatisfy({ undo.3[$0] == record.snapshot[$0] }) else {
                        throw SlopCommandError("authority_changed", "Undo belongs to another authority")
                    }
                    do { document = try schema.prepare(undo.3["data"]) } catch {
                        throw SlopCommandError("validation", error.localizedDescription)
                    }
                } else if payload == "replace" {
                    let replacement = request["replace"]
                    guard replacement["baseRevision"] == record.snapshot["revision"] else {
                        throw SlopCommandError("stale_revision", "Preserve this proposal: the document changed")
                    }
                    do { document = try schema.prepare(replacement["data"]) } catch {
                        throw SlopCommandError("validation", error.localizedDescription)
                    }
                } else {
                    document = try SlopDocumentOps.apply(operations, to: record.snapshot["data"], schema: schema)
                }
                guard let revision = record.snapshot["revision"].number, revision < 9_007_199_254_740_991 else {
                    throw SlopCommandError("invalid_operation", "Document revision limit reached")
                }
                record.snapshot["data"] = document.data
                prepared = document
                record.snapshot["revision"] = .number(revision + 1)
                record.metadata.pendingProjection = true
                // Storage errors escape; they must never become a deterministic receipt.
                result = .object(["ok": .bool(true), "revision": .number(revision + 1)])
            } catch let error as SlopCommandError { result = rejected(error.code, error.message) }
            timings.apply = elapsed(applying)
            let saving = ContinuousClock.now
            if let prepared {
                if payload == "ops" {
                    try execute("INSERT OR REPLACE INTO undo(id,lease,request,revision,snapshot) SELECT 1,?,?,?,snapshot FROM document WHERE id=1",
                        [.text(lease), .text(id), .integer(Int(record.snapshot["revision"].number!))])
                } else { try execute("DELETE FROM undo") }
                try save(record, preparedData: prepared.bytes, preservingUndo: true)
            }
            try execute(
                "INSERT INTO receipts(lease,request,digest,result) VALUES(?,?,?,?)",
                [.text(lease), .text(id), .blob(digest), .blob(try result.encoded())])
            timings.save = elapsed(saving)
            return outcome(result)
        }
    }
    public func backup(to destination: URL) throws {
        guard !FileManager.default.fileExists(atPath: destination.path), let db else {
            throw SlopDocumentError("Invalid database backup destination")
        }
        var target: OpaquePointer?
        guard sqlite3_open(destination.path, &target) == SQLITE_OK, let target else {
            sqlite3_close(target)
            throw SlopDocumentError("Cannot open database backup")
        }
        defer { sqlite3_close(target) }
        guard let backup = sqlite3_backup_init(target, "main", db, "main") else {
            throw SlopDocumentError("Cannot start database backup")
        }
        let status = sqlite3_backup_step(backup, -1)
        let finished = sqlite3_backup_finish(backup)
        guard status == SQLITE_DONE, finished == SQLITE_OK else { throw SlopDocumentError("Database backup failed") }
    }
}

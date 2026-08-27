import Foundation
import SQLite3

public let slopApplicationID: Int32 = 0x534C4F50
public let slopUserVersion: Int32 = 2
public let slopDatabaseName = "document.sqlite"

private let sqliteTransient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

public enum SlopError: LocalizedError {
    case invalidPackage(String)
    case sqlite(String)
    case missingView
    case invalidArgument(String)

    public var errorDescription: String? {
        switch self {
        case .invalidPackage(let message), .sqlite(let message), .invalidArgument(let message):
            return message
        case .missingView:
            return "The document does not contain a main HTML view."
        }
    }
}

public struct SlopMetadata: Sendable {
    public let values: [String: String]

    public subscript(_ key: String) -> String? { values[key] }
    public var title: String { values["title"] ?? "Untitled" }
    public var summary: String { values["summary"] ?? "" }
    public var width: Double { Double(values["width"] ?? "") ?? 430 }
    public var height: Double { Double(values["height"] ?? "") ?? 620 }
    public var minimumWidth: Double { Double(values["min_width"] ?? "") ?? 340 }
    public var minimumHeight: Double { Double(values["min_height"] ?? "") ?? 360 }
    public var cornerRadius: Double { Double(values["corner_radius"] ?? "") ?? 22 }
    public var alwaysOnTop: Bool { values["always_on_top"] == "1" || values["always_on_top"] == "true" }
    public var revision: Int64 { Int64(values["revision"] ?? "") ?? 0 }
}

private enum SQLiteAccess {
    case host
    case render
    case action
}

private final class SQLiteGate {
    let restricted: Bool
    var access: SQLiteAccess = .host
    init(restricted: Bool) { self.restricted = restricted }
}

public struct SlopPreparedQuery {
    public let columns: [String]
    public let readonly: Bool
}

public final class SlopDatabase: @unchecked Sendable {
    private var handle: OpaquePointer?
    private let lock = NSRecursiveLock()
    private let gate: SQLiteGate
    public let sqliteURL: URL
    public let readOnly: Bool

    public init(packageURL: URL, readOnly: Bool = false, restricted: Bool = false) throws {
        self.sqliteURL = try SlopPackage.sqliteURL(for: packageURL)
        self.readOnly = readOnly
        self.gate = SQLiteGate(restricted: restricted)

        let flags = readOnly
            ? SQLITE_OPEN_READONLY | SQLITE_OPEN_FULLMUTEX
            : SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX
        guard sqlite3_open_v2(sqliteURL.path, &handle, flags, nil) == SQLITE_OK else {
            throw SlopError.sqlite("Could not open \(sqliteURL.path): \(errorMessage)")
        }

        sqlite3_busy_timeout(handle, 5_000)
        try rawExecute("PRAGMA foreign_keys = ON")
        if !readOnly { try rawExecute("PRAGMA journal_mode = WAL") }

        let applicationID = try intPragma("application_id")
        guard applicationID == Int64(slopApplicationID) else {
            close()
            throw SlopError.invalidPackage("Not a hitSlop document: application_id is \(applicationID).")
        }

        let userdata = Unmanaged.passUnretained(gate).toOpaque()
        sqlite3_set_authorizer(handle, { userdata, action, arg1, _, _, source in
            let gate = Unmanaged<SQLiteGate>.fromOpaque(userdata!).takeUnretainedValue()
            let table = arg1.map { String(cString: $0) } ?? ""
            let fromTrigger = source != nil
            let reads: Set<Int32> = [SQLITE_SELECT, SQLITE_READ, SQLITE_FUNCTION, SQLITE_RECURSIVE]
            switch gate.access {
            case .host:
                guard gate.restricted else { return SQLITE_OK }
                switch action {
                case SQLITE_ATTACH, SQLITE_DETACH, SQLITE_CREATE_VTABLE, SQLITE_DROP_VTABLE:
                    return SQLITE_DENY
                default:
                    return SQLITE_OK
                }
            case .render:
                return reads.contains(action) ? SQLITE_OK : SQLITE_DENY
            case .action:
                if reads.contains(action) { return SQLITE_OK }
                if fromTrigger { return SQLITE_DENY }
                guard action == SQLITE_INSERT || action == SQLITE_UPDATE || action == SQLITE_DELETE else {
                    return SQLITE_DENY
                }
                if table.hasPrefix("sqlite_") || table.hasPrefix("slop_") {
                    return SQLITE_DENY
                }
                return SQLITE_OK
            }
        }, userdata)
    }

    deinit { close() }

    public var errorMessage: String {
        guard let handle else { return "database is closed" }
        return String(cString: sqlite3_errmsg(handle))
    }

    public func close() {
        lock.lock()
        defer { lock.unlock() }
        guard handle != nil else { return }
        if !readOnly { try? rawExecute("PRAGMA wal_checkpoint(TRUNCATE)") }
        sqlite3_close(handle)
        handle = nil
    }

    public func checkpoint() throws {
        guard !readOnly else { return }
        try rawExecute("PRAGMA wal_checkpoint(TRUNCATE)")
    }

    public func metadata() throws -> SlopMetadata {
        let rows = try query("SELECT key, value FROM slop_meta ORDER BY key")
        var values: [String: String] = [:]
        for row in rows {
            guard let key = row["key"] as? String else { continue }
            let raw = row["value"]
            if raw is NSNull || raw == nil { values[key] = "" }
            else { values[key] = String(describing: raw!) }
        }
        return SlopMetadata(values: values)
    }

    public func mainHTML() throws -> String {
        let rows = try query("SELECT body FROM slop_view WHERE path = '/' LIMIT 1")
        guard let html = rows.first?["body"] as? String else { throw SlopError.missingView }
        return html
    }

    public func asset(path: String) throws -> (mime: String, data: Data)? {
        let rows = try query("SELECT mime, body FROM slop_assets WHERE path = ? LIMIT 1", parameters: [path])
        guard let row = rows.first,
              let mime = row["mime"] as? String,
              let data = row["body"] as? Data else { return nil }
        return (mime, data)
    }

    public func docs() throws -> [[String: Any]] {
        try query("SELECT topic, body FROM slop_docs ORDER BY topic")
    }

    public func schema() throws -> [[String: Any]] {
        try query("SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE sql IS NOT NULL ORDER BY type, name")
    }

    public func prepareRender(_ sql: String) throws -> SlopPreparedQuery {
        lock.lock()
        defer { lock.unlock() }
        return try withAccess(.render) {
            let statement = try prepare(sql)
            defer { sqlite3_finalize(statement) }
            let readonly = sqlite3_stmt_readonly(statement) != 0
            guard readonly else {
                throw SlopError.invalidArgument("Render queries must be read-only")
            }
            return SlopPreparedQuery(columns: columnNames(statement), readonly: readonly)
        }
    }

    public func renderQuery(_ sql: String) throws -> [[String: Any]] {
        try withAccess(.render) {
            try query(sql)
        }
    }

    public func validateActionSQL(_ sql: String) throws {
        lock.lock()
        defer { lock.unlock() }
        try withAccess(.action) {
            let statement = try prepare(sql)
            sqlite3_finalize(statement)
        }
    }

    public func executeNamed(_ sql: String, fields: [String: String]) throws -> [String: Any] {
        guard !readOnly else { throw SlopError.sqlite("document is read-only") }
        lock.lock()
        defer { lock.unlock() }
        try rawExecute("BEGIN IMMEDIATE")
        do {
            let result: [String: Any] = try withAccess(.action) {
                let statement = try prepare(sql)
                defer { sqlite3_finalize(statement) }
                try bindNamed(fields, to: statement)
                let code = sqlite3_step(statement)
                guard code == SQLITE_DONE || code == SQLITE_ROW else {
                    throw SlopError.sqlite(errorMessage)
                }
                return [
                    "changes": Int(sqlite3_changes(handle)),
                    "lastInsertRowid": sqlite3_last_insert_rowid(handle),
                ]
            }
            try bumpDocumentRevision()
            try rawExecute("COMMIT")
            var output = result
            output["revision"] = try revision()
            return output
        } catch {
            try? rawExecute("ROLLBACK")
            throw error
        }
    }

    public func withReadSnapshot<T>(_ body: () throws -> T) throws -> T {
        lock.lock()
        defer { lock.unlock() }
        try rawExecute("BEGIN")
        do {
            let value = try body()
            try rawExecute("COMMIT")
            return value
        } catch {
            try? rawExecute("ROLLBACK")
            throw error
        }
    }

    public func query(_ sql: String, parameters: [Any] = []) throws -> [[String: Any]] {
        lock.lock()
        defer { lock.unlock() }
        guard let handle else { throw SlopError.sqlite("database is closed") }
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(handle, sql, -1, &statement, nil) == SQLITE_OK else {
            throw SlopError.sqlite(errorMessage)
        }
        defer { sqlite3_finalize(statement) }
        guard sqlite3_stmt_readonly(statement) != 0 else {
            throw SlopError.invalidArgument("slop.query only accepts read-only SQL; use slop.exec for mutations.")
        }
        try bind(parameters, to: statement)

        var rows: [[String: Any]] = []
        while true {
            let code = sqlite3_step(statement)
            if code == SQLITE_DONE { break }
            guard code == SQLITE_ROW else { throw SlopError.sqlite(errorMessage) }
            var row: [String: Any] = [:]
            for index in 0..<sqlite3_column_count(statement) {
                let name = String(cString: sqlite3_column_name(statement, index))
                row[name] = columnValue(statement, index: index)
            }
            rows.append(row)
        }
        return rows
    }

    @discardableResult
    public func execute(_ sql: String, parameters: [Any] = [], bumpRevision: Bool = true) throws -> [String: Any] {
        guard !readOnly else { throw SlopError.sqlite("document is read-only") }
        lock.lock()
        defer { lock.unlock() }
        try rawExecute("BEGIN IMMEDIATE")
        do {
            guard let handle else { throw SlopError.sqlite("database is closed") }
            var statement: OpaquePointer?
            guard sqlite3_prepare_v2(handle, sql, -1, &statement, nil) == SQLITE_OK else {
                throw SlopError.sqlite(errorMessage)
            }
            defer { sqlite3_finalize(statement) }
            try bind(parameters, to: statement)
            let code = sqlite3_step(statement)
            guard code == SQLITE_DONE || code == SQLITE_ROW else { throw SlopError.sqlite(errorMessage) }
            let changes = Int(sqlite3_changes(handle))
            let rowID = sqlite3_last_insert_rowid(handle)
            if bumpRevision { try bumpDocumentRevision() }
            try rawExecute("COMMIT")
            return ["changes": changes, "lastInsertRowid": rowID, "revision": try revision()]
        } catch {
            try? rawExecute("ROLLBACK")
            throw error
        }
    }

    public func transaction(_ statements: [[String: Any]]) throws -> [[String: Any]] {
        guard !readOnly else { throw SlopError.sqlite("document is read-only") }
        lock.lock()
        defer { lock.unlock() }
        try rawExecute("BEGIN IMMEDIATE")
        do {
            var results: [[String: Any]] = []
            for item in statements {
                guard let sql = item["sql"] as? String else {
                    throw SlopError.invalidArgument("transaction statement is missing sql")
                }
                let params = item["params"] as? [Any] ?? []
                results.append(try executeWithoutTransaction(sql, parameters: params))
            }
            try bumpDocumentRevision()
            try rawExecute("COMMIT")
            return results
        } catch {
            try? rawExecute("ROLLBACK")
            throw error
        }
    }

    public func setMeta(_ key: String, value: String, bumpRevision: Bool = true) throws {
        _ = try execute(
            "INSERT INTO slop_meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            parameters: [key, value],
            bumpRevision: bumpRevision
        )
    }

    public func revision() throws -> Int64 {
        let rows = try query("SELECT value FROM slop_meta WHERE key = 'revision'")
        if let value = rows.first?["value"] as? Int64 { return value }
        if let value = rows.first?["value"] as? String { return Int64(value) ?? 0 }
        return 0
    }

    public func dataVersion() throws -> Int64 {
        try intPragma("data_version")
    }

    public func storePreview(_ png: Data, forRevision revision: Int64) throws {
        lock.lock()
        defer { lock.unlock() }
        try rawExecute("BEGIN IMMEDIATE")
        do {
            _ = try executeWithoutTransaction(
                "INSERT INTO slop_assets(path, mime, body) VALUES ('/preview.png', 'image/png', ?) ON CONFLICT(path) DO UPDATE SET mime = excluded.mime, body = excluded.body",
                parameters: [png]
            )
            _ = try executeWithoutTransaction(
                "INSERT INTO slop_meta(key, value) VALUES ('preview_revision', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                parameters: [String(revision)]
            )
            try rawExecute("COMMIT")
            try rawExecute("PRAGMA wal_checkpoint(TRUNCATE)")
        } catch {
            try? rawExecute("ROLLBACK")
            throw error
        }
    }

    public func jsonRows(_ rows: [[String: Any]]) -> [[String: Any]] {
        rows.map { row in
            row.mapValues { value in
                if let data = value as? Data { return ["$blob": data.base64EncodedString()] }
                return value
            }
        }
    }

    private func intPragma(_ name: String) throws -> Int64 {
        let rows = try query("PRAGMA \(name)")
        return rows.first?.values.first as? Int64 ?? 0
    }

    private func bumpDocumentRevision() throws {
        _ = try executeWithoutTransaction(
            "INSERT INTO slop_meta(key, value) VALUES ('revision', '1') ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + 1"
        )
        _ = try executeWithoutTransaction(
            "INSERT INTO slop_meta(key, value) VALUES ('modified_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            parameters: [ISO8601DateFormatter().string(from: Date())]
        )
    }

    private func executeWithoutTransaction(_ sql: String, parameters: [Any] = []) throws -> [String: Any] {
        guard let handle else { throw SlopError.sqlite("database is closed") }
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(handle, sql, -1, &statement, nil) == SQLITE_OK else {
            throw SlopError.sqlite(errorMessage)
        }
        defer { sqlite3_finalize(statement) }
        try bind(parameters, to: statement)
        let code = sqlite3_step(statement)
        guard code == SQLITE_DONE || code == SQLITE_ROW else { throw SlopError.sqlite(errorMessage) }
        return ["changes": Int(sqlite3_changes(handle)), "lastInsertRowid": sqlite3_last_insert_rowid(handle)]
    }

    private func withAccess<T>(_ access: SQLiteAccess, _ body: () throws -> T) throws -> T {
        let previous = gate.access
        gate.access = access
        defer { gate.access = previous }
        return try body()
    }

    private func prepare(_ sql: String) throws -> OpaquePointer {
        guard let handle else { throw SlopError.sqlite("database is closed") }
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(handle, sql, -1, &statement, nil) == SQLITE_OK, let statement else {
            throw SlopError.sqlite(errorMessage)
        }
        return statement
    }

    private func columnNames(_ statement: OpaquePointer?) -> [String] {
        (0..<sqlite3_column_count(statement)).map { index in
            String(cString: sqlite3_column_name(statement, index))
        }
    }

    private func bindNamed(_ fields: [String: String], to statement: OpaquePointer?) throws {
        for (name, value) in fields {
            let index = sqlite3_bind_parameter_index(statement, ":" + name)
            guard index > 0 else {
                throw SlopError.invalidArgument("Unexpected action field: \(name)")
            }
            guard sqlite3_bind_text(statement, index, value, -1, sqliteTransient) == SQLITE_OK else {
                throw SlopError.sqlite(errorMessage)
            }
        }
        let count = Int(sqlite3_bind_parameter_count(statement))
        var missing: [String] = []
        if count > 0 {
            for index in 1...count {
                guard let cName = sqlite3_bind_parameter_name(statement, Int32(index)) else { continue }
                let raw = String(cString: cName)
                let name = raw.hasPrefix(":") ? String(raw.dropFirst()) : raw
                if fields[name] == nil { missing.append(name) }
            }
        }
        if !missing.isEmpty {
            throw SlopError.invalidArgument("Missing action field: \(missing.sorted().joined(separator: ", "))")
        }
    }

    private func rawExecute(_ sql: String) throws {
        guard let handle else { throw SlopError.sqlite("database is closed") }
        var errorPointer: UnsafeMutablePointer<CChar>?
        let code = sqlite3_exec(handle, sql, nil, nil, &errorPointer)
        guard code == SQLITE_OK else {
            let message = errorPointer.map { String(cString: $0) } ?? errorMessage
            sqlite3_free(errorPointer)
            throw SlopError.sqlite(message)
        }
    }

    private func bind(_ parameters: [Any], to statement: OpaquePointer?) throws {
        for (offset, parameter) in parameters.enumerated() {
            let index = Int32(offset + 1)
            let code: Int32
            switch parameter {
            case is NSNull:
                code = sqlite3_bind_null(statement, index)
            case let value as Bool:
                code = sqlite3_bind_int(statement, index, value ? 1 : 0)
            case let value as Int:
                code = sqlite3_bind_int64(statement, index, Int64(value))
            case let value as Int64:
                code = sqlite3_bind_int64(statement, index, value)
            case let value as Double:
                code = sqlite3_bind_double(statement, index, value)
            case let value as NSNumber:
                code = sqlite3_bind_double(statement, index, value.doubleValue)
            case let value as String:
                code = sqlite3_bind_text(statement, index, value, -1, sqliteTransient)
            case let value as Data:
                code = value.withUnsafeBytes { bytes in
                    sqlite3_bind_blob(statement, index, bytes.baseAddress, Int32(bytes.count), sqliteTransient)
                }
            case let value as [String: Any] where value["$blob"] is String:
                let data = Data(base64Encoded: value["$blob"] as! String) ?? Data()
                code = data.withUnsafeBytes { bytes in
                    sqlite3_bind_blob(statement, index, bytes.baseAddress, Int32(bytes.count), sqliteTransient)
                }
            default:
                code = sqlite3_bind_text(statement, index, String(describing: parameter), -1, sqliteTransient)
            }
            guard code == SQLITE_OK else { throw SlopError.sqlite(errorMessage) }
        }
    }

    private func columnValue(_ statement: OpaquePointer?, index: Int32) -> Any {
        switch sqlite3_column_type(statement, index) {
        case SQLITE_INTEGER:
            return sqlite3_column_int64(statement, index)
        case SQLITE_FLOAT:
            return sqlite3_column_double(statement, index)
        case SQLITE_TEXT:
            return sqlite3_column_text(statement, index).map { String(cString: $0) } ?? ""
        case SQLITE_BLOB:
            let count = Int(sqlite3_column_bytes(statement, index))
            guard let bytes = sqlite3_column_blob(statement, index) else { return Data() }
            return Data(bytes: bytes, count: count)
        default:
            return NSNull()
        }
    }
}

public enum SlopPackage {
    public static func sqliteURL(for packageOrDatabaseURL: URL) throws -> URL {
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: packageOrDatabaseURL.path, isDirectory: &isDirectory) else {
            throw SlopError.invalidPackage("Not found: \(packageOrDatabaseURL.path)")
        }
        if isDirectory.boolValue {
            let sqliteURL = packageOrDatabaseURL.appendingPathComponent(slopDatabaseName)
            guard FileManager.default.fileExists(atPath: sqliteURL.path) else {
                throw SlopError.invalidPackage("Missing \(slopDatabaseName) in \(packageOrDatabaseURL.lastPathComponent).")
            }
            return sqliteURL
        }
        return packageOrDatabaseURL
    }

    public static func packageURL(for packageOrDatabaseURL: URL) -> URL {
        packageOrDatabaseURL.lastPathComponent == slopDatabaseName
            ? packageOrDatabaseURL.deletingLastPathComponent()
            : packageOrDatabaseURL
    }

    public static func clone(from sourceURL: URL, to requestedDestination: URL, title: String? = nil) throws -> URL {
        let sourceSQLite = try sqliteURL(for: sourceURL)
        let destination = requestedDestination.pathExtension.lowercased() == "slop"
            ? requestedDestination
            : requestedDestination.appendingPathExtension("slop")
        try prepareEmptyDestination(destination)
        try FileManager.default.createDirectory(at: destination, withIntermediateDirectories: true)
        let destinationSQLite = destination.appendingPathComponent(slopDatabaseName)

        var source: OpaquePointer?
        var target: OpaquePointer?
        guard sqlite3_open_v2(sourceSQLite.path, &source, SQLITE_OPEN_READONLY | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK,
              sqlite3_open_v2(destinationSQLite.path, &target, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK else {
            sqlite3_close(source)
            sqlite3_close(target)
            try? FileManager.default.removeItem(at: destination)
            throw SlopError.sqlite("Could not create the SQLite copy.")
        }
        defer { sqlite3_close(source); sqlite3_close(target) }
        guard let backup = sqlite3_backup_init(target, "main", source, "main") else {
            try? FileManager.default.removeItem(at: destination)
            throw SlopError.sqlite("Could not initialize the SQLite backup.")
        }
        let result = sqlite3_backup_step(backup, -1)
        sqlite3_backup_finish(backup)
        guard result == SQLITE_DONE else {
            try? FileManager.default.removeItem(at: destination)
            throw SlopError.sqlite("Could not finish the SQLite backup.")
        }
        sqlite3_close(target)
        target = nil

        let copy = try SlopDatabase(packageURL: destination)
        let now = ISO8601DateFormatter().string(from: Date())
        try copy.setMeta("document_id", value: UUID().uuidString, bumpRevision: false)
        try copy.setMeta("created_at", value: now, bumpRevision: false)
        try copy.setMeta("modified_at", value: now, bumpRevision: false)
        try copy.setMeta("revision", value: "0", bumpRevision: false)
        try copy.setMeta("preview_revision", value: "-1", bumpRevision: false)
        if let title { try copy.setMeta("title", value: title, bumpRevision: false) }
        try copy.checkpoint()
        try SlopPreviewIcon.installFromDatabase(copy, into: destination)
        copy.close()
        return destination
    }

    public static func nextDuplicateURL(for packageURL: URL) -> URL {
        let folder = packageURL.deletingLastPathComponent()
        let stem = packageURL.deletingPathExtension().lastPathComponent
        for index in 1...999 {
            let suffix = index == 1 ? " copy" : " copy \(index)"
            let candidate = folder.appendingPathComponent(stem + suffix).appendingPathExtension("slop")
            if !FileManager.default.fileExists(atPath: candidate.path) { return candidate }
        }
        return folder.appendingPathComponent(stem + " copy " + UUID().uuidString.prefix(6)).appendingPathExtension("slop")
    }

    /// NSSavePanel may create an empty package directory for a `.slop` UTI.
    /// Replace that placeholder. Refuse to clobber a real document.
    private static func prepareEmptyDestination(_ destination: URL) throws {
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: destination.path, isDirectory: &isDirectory) else { return }
        let sqlite = destination.appendingPathComponent(slopDatabaseName)
        if isDirectory.boolValue, !FileManager.default.fileExists(atPath: sqlite.path) {
            try FileManager.default.removeItem(at: destination)
            return
        }
        throw SlopError.invalidArgument("A document already exists at \(destination.path).")
    }
}

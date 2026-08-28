import Foundation
import SQLite3

private let sqliteTransient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

public final class SlopDatabase: @unchecked Sendable {
    public static let applicationID: Int32 = 0x534C5057 // "SLPW"
    public static let schemaVersion: Int32 = 1

    private let lock = NSRecursiveLock()
    private var handle: OpaquePointer?

    public init(url: URL) throws {
        var database: OpaquePointer?
        let flags = SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX
        guard sqlite3_open_v2(url.path, &database, flags, nil) == SQLITE_OK,
              let database
        else {
            let message = database.map { String(cString: sqlite3_errmsg($0)) } ?? "Could not open database"
            sqlite3_close(database)
            throw SlopHostError.sqlite(message)
        }

        handle = database
        sqlite3_busy_timeout(database, 5_000)
        try executeInternal("PRAGMA foreign_keys = ON")
        try executeInternal("PRAGMA journal_mode = WAL")

        let applicationID = try scalarInt("PRAGMA application_id")
        guard applicationID == Int64(Self.applicationID) else {
            close()
            throw SlopHostError.invalidPackage(
                "Database application_id is \(applicationID); expected \(Self.applicationID)"
            )
        }
        let schemaVersion = try scalarInt("PRAGMA user_version")
        guard schemaVersion <= Int64(Self.schemaVersion) else {
            close()
            throw SlopHostError.invalidPackage(
                "Database schema version \(schemaVersion) is newer than this host supports"
            )
        }

        sqlite3_set_authorizer(
            database,
            { _, action, arg1, arg2, _, _ in
                switch action {
                case SQLITE_ATTACH, SQLITE_DETACH,
                     SQLITE_CREATE_VTABLE, SQLITE_DROP_VTABLE:
                    return SQLITE_DENY
                case SQLITE_FUNCTION:
                    let name = (arg2 ?? arg1).map { String(cString: $0).lowercased() } ?? ""
                    return name == "load_extension" ? SQLITE_DENY : SQLITE_OK
                case SQLITE_PRAGMA:
                    let name = arg1.map { String(cString: $0).lowercased() } ?? ""
                    let blocked = [
                        "data_store_directory", "temp_store_directory", "writable_schema",
                    ]
                    return blocked.contains(name) ? SQLITE_DENY : SQLITE_OK
                default:
                    return SQLITE_OK
                }
            },
            nil
        )
    }

    deinit {
        close()
    }

    public func query(_ sql: String, parameters: [Any] = []) throws -> [[String: Any]] {
        try locked {
            let statement = try prepareSingle(sql)
            defer { sqlite3_finalize(statement) }
            guard sqlite3_stmt_readonly(statement) != 0 else {
                throw SlopHostError.sqlite("query only accepts read-only SQL")
            }
            try bind(parameters, to: statement)

            var rows: [[String: Any]] = []
            while true {
                switch sqlite3_step(statement) {
                case SQLITE_ROW:
                    var row: [String: Any] = [:]
                    for index in 0..<sqlite3_column_count(statement) {
                        let name = String(cString: sqlite3_column_name(statement, index))
                        row[name] = columnValue(statement, index: index)
                    }
                    rows.append(row)
                case SQLITE_DONE:
                    return rows
                default:
                    throw currentError()
                }
            }
        }
    }

    @discardableResult
    public func execute(_ sql: String, parameters: [Any] = []) throws -> Int {
        try locked {
            let statement = try prepareSingle(sql)
            defer { sqlite3_finalize(statement) }
            guard sqlite3_stmt_readonly(statement) == 0 else {
                throw SlopHostError.sqlite("execute only accepts mutating SQL")
            }
            try bind(parameters, to: statement)
            guard sqlite3_step(statement) == SQLITE_DONE else { throw currentError() }
            return Int(sqlite3_changes(handle))
        }
    }

    @discardableResult
    public func transaction(_ statements: [(sql: String, parameters: [Any])]) throws -> Int {
        try locked {
            try executeInternal("BEGIN IMMEDIATE")
            do {
                var changes = 0
                for statement in statements {
                    changes += try execute(statement.sql, parameters: statement.parameters)
                }
                try executeInternal("COMMIT")
                return changes
            } catch {
                try? executeInternal("ROLLBACK")
                throw error
            }
        }
    }

    public func dataVersion() throws -> Int64 {
        try scalarInt("PRAGMA data_version")
    }

    public func checkpoint() {
        locked {
            guard let handle else { return }
            sqlite3_wal_checkpoint_v2(handle, nil, SQLITE_CHECKPOINT_TRUNCATE, nil, nil)
        }
    }

    public func close() {
        locked {
            guard let database = handle else { return }
            sqlite3_wal_checkpoint_v2(database, nil, SQLITE_CHECKPOINT_TRUNCATE, nil, nil)
            sqlite3_close_v2(database)
            handle = nil
        }
    }

    private func scalarInt(_ sql: String) throws -> Int64 {
        try locked {
            let statement = try prepareSingle(sql)
            defer { sqlite3_finalize(statement) }
            guard sqlite3_step(statement) == SQLITE_ROW else { throw currentError() }
            return sqlite3_column_int64(statement, 0)
        }
    }

    private func executeInternal(_ sql: String) throws {
        guard let handle else { throw SlopHostError.sqlite("Database is closed") }
        var errorMessage: UnsafeMutablePointer<CChar>?
        guard sqlite3_exec(handle, sql, nil, nil, &errorMessage) == SQLITE_OK else {
            let message = errorMessage.map { String(cString: $0) } ?? "SQLite operation failed"
            sqlite3_free(errorMessage)
            throw SlopHostError.sqlite(message)
        }
    }

    private func prepareSingle(_ sql: String) throws -> OpaquePointer {
        guard let handle else { throw SlopHostError.sqlite("Database is closed") }
        var statement: OpaquePointer?
        var tail: UnsafePointer<CChar>?
        guard sqlite3_prepare_v2(handle, sql, -1, &statement, &tail) == SQLITE_OK,
              let statement
        else {
            throw currentError()
        }
        let remainder = tail.map { String(cString: $0) } ?? ""
        guard remainder.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            sqlite3_finalize(statement)
            throw SlopHostError.sqlite("Only one SQL statement is allowed per call")
        }
        return statement
    }

    private func bind(_ parameters: [Any], to statement: OpaquePointer) throws {
        guard parameters.count == Int(sqlite3_bind_parameter_count(statement)) else {
            throw SlopHostError.sqlite(
                "Expected \(sqlite3_bind_parameter_count(statement)) parameters, received \(parameters.count)"
            )
        }
        for (offset, value) in parameters.enumerated() {
            let index = Int32(offset + 1)
            let result: Int32
            switch value {
            case is NSNull:
                result = sqlite3_bind_null(statement, index)
            case let value as Bool:
                result = sqlite3_bind_int(statement, index, value ? 1 : 0)
            case let value as Int:
                result = sqlite3_bind_int64(statement, index, Int64(value))
            case let value as Int64:
                result = sqlite3_bind_int64(statement, index, value)
            case let value as Double:
                result = sqlite3_bind_double(statement, index, value)
            case let value as NSNumber:
                result = sqlite3_bind_double(statement, index, value.doubleValue)
            case let value as String:
                result = sqlite3_bind_text(statement, index, value, -1, sqliteTransient)
            case let value as Data:
                result = value.withUnsafeBytes { bytes in
                    sqlite3_bind_blob(statement, index, bytes.baseAddress, Int32(bytes.count), sqliteTransient)
                }
            default:
                throw SlopHostError.invalidBridgeValue(
                    "Unsupported SQLite parameter at index \(offset): \(type(of: value))"
                )
            }
            guard result == SQLITE_OK else { throw currentError() }
        }
    }

    private func columnValue(_ statement: OpaquePointer, index: Int32) -> Any {
        switch sqlite3_column_type(statement, index) {
        case SQLITE_INTEGER:
            return sqlite3_column_int64(statement, index)
        case SQLITE_FLOAT:
            return sqlite3_column_double(statement, index)
        case SQLITE_TEXT:
            guard let text = sqlite3_column_text(statement, index) else { return NSNull() }
            return String(cString: text)
        case SQLITE_BLOB:
            let count = Int(sqlite3_column_bytes(statement, index))
            guard count > 0, let bytes = sqlite3_column_blob(statement, index) else { return Data() }
            return Data(bytes: bytes, count: count)
        default:
            return NSNull()
        }
    }

    private func currentError() -> SlopHostError {
        guard let handle else { return .sqlite("Database is closed") }
        return .sqlite(String(cString: sqlite3_errmsg(handle)))
    }

    private func locked<T>(_ operation: () throws -> T) rethrows -> T {
        lock.lock()
        defer { lock.unlock() }
        return try operation()
    }
}

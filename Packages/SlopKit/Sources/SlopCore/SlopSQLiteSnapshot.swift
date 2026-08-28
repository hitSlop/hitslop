import Foundation
import SQLite3

enum SlopSQLiteSnapshot {
    private static let busyRetryLimit = 100
    private static let busyRetryDelayMilliseconds: Int32 = 10

    static func copy(from sourceURL: URL, to destinationURL: URL) throws {
        var source: OpaquePointer?
        let sourceHasWAL = FileManager.default.fileExists(atPath: sourceURL.path + "-wal")
        let sourceHasSharedMemory = FileManager.default.fileExists(atPath: sourceURL.path + "-shm")
        if sourceHasWAL, !sourceHasSharedMemory {
            throw SlopHostError.sqlite(
                "Cannot snapshot \(sourceURL.lastPathComponent) read-only because it has a WAL file without shared memory"
            )
        }

        let sourceLocation = sourceHasWAL
            ? sourceURL.path
            : sourceURL.absoluteString + (sourceURL.absoluteString.contains("?") ? "&immutable=1" : "?immutable=1")
        let sourceFlags = SQLITE_OPEN_READONLY | SQLITE_OPEN_FULLMUTEX | (sourceHasWAL ? 0 : SQLITE_OPEN_URI)
        guard sqlite3_open_v2(sourceLocation, &source, sourceFlags, nil) == SQLITE_OK,
              let source
        else {
            let message = errorMessage(from: source, fallback: "Could not open source database")
            sqlite3_close(source)
            throw SlopHostError.sqlite(message)
        }
        defer { sqlite3_close(source) }
        sqlite3_busy_timeout(source, 5_000)

        try validate(source)

        var destination: OpaquePointer?
        let destinationFlags = SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX
        guard sqlite3_open_v2(destinationURL.path, &destination, destinationFlags, nil) == SQLITE_OK,
              let destination
        else {
            let message = errorMessage(from: destination, fallback: "Could not create database snapshot")
            sqlite3_close(destination)
            throw SlopHostError.sqlite(message)
        }
        defer { sqlite3_close(destination) }
        sqlite3_busy_timeout(destination, 5_000)

        guard let backup = sqlite3_backup_init(destination, "main", source, "main") else {
            throw SlopHostError.sqlite(errorMessage(from: destination, fallback: "Could not initialize database snapshot"))
        }
        defer { sqlite3_backup_finish(backup) }

        var busyRetries = 0
        while true {
            switch sqlite3_backup_step(backup, 128) {
            case SQLITE_DONE:
                return
            case SQLITE_OK:
                busyRetries = 0
            case SQLITE_BUSY, SQLITE_LOCKED:
                guard busyRetries < busyRetryLimit else {
                    throw SlopHostError.sqlite("Timed out waiting to snapshot \(sourceURL.lastPathComponent)")
                }
                busyRetries += 1
                sqlite3_sleep(busyRetryDelayMilliseconds)
            default:
                throw SlopHostError.sqlite(errorMessage(from: destination, fallback: "Could not copy database snapshot"))
            }
        }
    }

    private static func validate(_ database: OpaquePointer) throws {
        let applicationID = try scalar("PRAGMA application_id", in: database)
        guard applicationID == Int64(SlopDatabase.applicationID) else {
            throw SlopHostError.invalidPackage(
                "Database application_id is \(applicationID); expected \(SlopDatabase.applicationID)"
            )
        }

        let schemaVersion = try scalar("PRAGMA user_version", in: database)
        guard schemaVersion <= Int64(SlopDatabase.schemaVersion) else {
            throw SlopHostError.invalidPackage(
                "Database schema version \(schemaVersion) is newer than this host supports"
            )
        }
    }

    private static func scalar(_ sql: String, in database: OpaquePointer) throws -> Int64 {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK,
              let statement
        else {
            throw SlopHostError.sqlite(errorMessage(from: database, fallback: "Could not inspect database"))
        }
        defer { sqlite3_finalize(statement) }
        guard sqlite3_step(statement) == SQLITE_ROW else {
            throw SlopHostError.sqlite(errorMessage(from: database, fallback: "Could not inspect database"))
        }
        return sqlite3_column_int64(statement, 0)
    }

    private static func errorMessage(from database: OpaquePointer?, fallback: String) -> String {
        database.map { String(cString: sqlite3_errmsg($0)) } ?? fallback
    }
}

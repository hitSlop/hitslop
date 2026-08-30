import Foundation
import SQLite3

public enum SlopSQLiteSnapshot {
    public static func copy(from sourceURL: URL, to destinationURL: URL) throws {
        var source: OpaquePointer?
        let hasWAL = FileManager.default.fileExists(atPath: sourceURL.path + "-wal")
        let location = hasWAL ? sourceURL.path : sourceURL.absoluteString + "?immutable=1"
        let flags = SQLITE_OPEN_READONLY | SQLITE_OPEN_FULLMUTEX | (hasWAL ? 0 : SQLITE_OPEN_URI)
        guard sqlite3_open_v2(location, &source, flags, nil) == SQLITE_OK, let source else {
            defer { sqlite3_close(source) }
            throw SlopPackageError.invalid("could not open SQLite snapshot source")
        }
        defer { sqlite3_close(source) }
        var destination: OpaquePointer?
        guard sqlite3_open_v2(destinationURL.path, &destination, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK, let destination else {
            defer { sqlite3_close(destination) }
            throw SlopPackageError.invalid("could not create SQLite snapshot")
        }
        defer { sqlite3_close(destination) }
        guard let backup = sqlite3_backup_init(destination, "main", source, "main") else { throw SlopPackageError.invalid("could not initialize SQLite snapshot") }
        defer { sqlite3_backup_finish(backup) }
        var retries = 0
        while true {
            switch sqlite3_backup_step(backup, 128) {
            case SQLITE_DONE: return
            case SQLITE_OK: retries = 0
            case SQLITE_BUSY, SQLITE_LOCKED:
                guard retries < 100 else { throw SlopPackageError.invalid("timed out waiting for SQLite snapshot") }
                retries += 1; sqlite3_sleep(10)
            default: throw SlopPackageError.invalid(String(cString: sqlite3_errmsg(destination)))
            }
        }
    }
}

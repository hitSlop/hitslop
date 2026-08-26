import Foundation
import SQLite3

struct SlopPreviewPayload {
    let title: String
    let width: CGFloat
    let height: CGFloat
    let png: Data?
}

enum SlopPreviewReader {
    static func read(packageURL: URL) -> SlopPreviewPayload? {
        let securityScoped = packageURL.startAccessingSecurityScopedResource()
        defer {
            if securityScoped { packageURL.stopAccessingSecurityScopedResource() }
        }

        var metadata: [String: String] = [:]
        let png = pngFromQuickLook(packageURL)
        if png != nil {
            return SlopPreviewPayload(
                title: packageURL.deletingPathExtension().lastPathComponent,
                width: 430,
                height: 620,
                png: png
            )
        }

        let sqliteURL = packageURL.appendingPathComponent("document.sqlite")
        var database: OpaquePointer?
        let flags = SQLITE_OPEN_READONLY | SQLITE_OPEN_FULLMUTEX | SQLITE_OPEN_URI
        var sqlitePNG: Data?
        if sqlite3_open_v2(sqliteURL.path, &database, flags, nil) == SQLITE_OK {
            sqlite3_busy_timeout(database, 250)
            var statement: OpaquePointer?
            if sqlite3_prepare_v2(database, "SELECT key, value FROM slop_meta", -1, &statement, nil) == SQLITE_OK {
                while sqlite3_step(statement) == SQLITE_ROW {
                    guard let keyBytes = sqlite3_column_text(statement, 0) else { continue }
                    let key = String(cString: keyBytes)
                    let value = sqlite3_column_text(statement, 1).map { String(cString: $0) } ?? ""
                    metadata[key] = value
                }
            }
            sqlite3_finalize(statement)

            statement = nil
            if sqlite3_prepare_v2(database, "SELECT body FROM slop_assets WHERE path = '/preview.png' LIMIT 1", -1, &statement, nil) == SQLITE_OK,
               sqlite3_step(statement) == SQLITE_ROW,
               let bytes = sqlite3_column_blob(statement, 0) {
                sqlitePNG = Data(bytes: bytes, count: Int(sqlite3_column_bytes(statement, 0)))
            }
            sqlite3_finalize(statement)
        }
        sqlite3_close(database)

        return SlopPreviewPayload(
            title: metadata["title"] ?? packageURL.deletingPathExtension().lastPathComponent,
            width: CGFloat(Double(metadata["width"] ?? "") ?? 430),
            height: CGFloat(Double(metadata["height"] ?? "") ?? 620),
            png: sqlitePNG
        )
    }

    private static func pngFromQuickLook(_ packageURL: URL) -> Data? {
        let candidates = [
            packageURL.appendingPathComponent("QuickLook/Thumbnail.png"),
            packageURL.appendingPathComponent("preview.png"),
            packageURL.appendingPathComponent("QuickLook/Preview.png"),
        ]
        for url in candidates {
            if let data = try? Data(contentsOf: url), !data.isEmpty { return data }
        }
        return nil
    }
}

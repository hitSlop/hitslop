import Foundation
import SQLite3

private let packSQLiteTransient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

extension SlopPackage {
    /// Pack an authoring folder (`view.html`, `schema.sql`, `docs.md`, `meta.json`, `assets/`)
    /// into a `.slop` package.
    public static func pack(from sourceDirectory: URL, to requestedDestination: URL? = nil) throws -> URL {
        let source = sourceDirectory.standardizedFileURL
        let viewURL = source.appendingPathComponent("view.html")
        guard FileManager.default.fileExists(atPath: viewURL.path) else {
            throw SlopError.invalidArgument("Authoring folder is missing view.html: \(source.path)")
        }

        var destination = requestedDestination?.standardizedFileURL
            ?? source.appendingPathExtension("slop")
        if destination.pathExtension.lowercased() != "slop" {
            destination.appendPathExtension("slop")
        }
        if FileManager.default.fileExists(atPath: destination.path) {
            try FileManager.default.removeItem(at: destination)
        }
        try FileManager.default.createDirectory(at: destination, withIntermediateDirectories: true)

        let sqliteURL = destination.appendingPathComponent(slopDatabaseName)
        var handle: OpaquePointer?
        let flags = SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX
        guard sqlite3_open_v2(sqliteURL.path, &handle, flags, nil) == SQLITE_OK, let db = handle else {
            sqlite3_close(handle)
            try? FileManager.default.removeItem(at: destination)
            throw SlopError.sqlite("Could not create \(sqliteURL.path)")
        }
        var sealed = false
        defer {
            if !sealed { sqlite3_close(db) }
        }

        try exec(db, "PRAGMA busy_timeout = 5000")
        try exec(db, "PRAGMA foreign_keys = ON")
        try exec(db, "PRAGMA journal_mode = WAL")
        try exec(db, "PRAGMA application_id = \(slopApplicationID)")
        try exec(db, "PRAGMA user_version = \(slopUserVersion)")
        try exec(db, """
            CREATE TABLE slop_meta (key TEXT PRIMARY KEY, value ANY);
            CREATE TABLE slop_view (path TEXT PRIMARY KEY, mime TEXT NOT NULL DEFAULT 'text/html', body TEXT NOT NULL);
            CREATE TABLE slop_docs (topic TEXT PRIMARY KEY, body TEXT NOT NULL);
            CREATE TABLE slop_assets (path TEXT PRIMARY KEY, mime TEXT NOT NULL, body BLOB NOT NULL);
            """)

        let now = ISO8601DateFormatter().string(from: Date())
        var meta: [String: String] = [
            "format": "slop/2",
            "title": source.lastPathComponent,
            "width": "420",
            "height": "720",
            "min_width": "340",
            "min_height": "360",
            "corner_radius": "22",
            "always_on_top": "0",
            "document_id": UUID().uuidString,
            "revision": "0",
            "preview_revision": "-1",
            "created_at": now,
            "modified_at": now,
        ]
        let metaURL = source.appendingPathComponent("meta.json")
        if let data = try? Data(contentsOf: metaURL),
           let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
            for (key, value) in object {
                meta[key] = stringifyJSON(value)
            }
        }
        for (key, value) in meta {
            try run(db, "INSERT INTO slop_meta(key, value) VALUES (?, ?)", .text(key), .text(value))
        }

        let html = try String(contentsOf: viewURL, encoding: .utf8)
        try run(db, "INSERT INTO slop_view(path, mime, body) VALUES (?, ?, ?)", .text("/"), .text("text/html"), .text(html))

        let docsURL = source.appendingPathComponent("docs.md")
        if let docs = try? String(contentsOf: docsURL, encoding: .utf8), !docs.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            try run(db, "INSERT INTO slop_docs(topic, body) VALUES (?, ?)", .text("readme"), .text(docs))
        }

        let schemaURL = source.appendingPathComponent("schema.sql")
        if let schema = try? String(contentsOf: schemaURL, encoding: .utf8), !schema.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            try exec(db, schema)
        }

        let assetsDir = source.appendingPathComponent("assets", isDirectory: true)
        if let enumerator = FileManager.default.enumerator(at: assetsDir, includingPropertiesForKeys: [.isRegularFileKey], options: [.skipsHiddenFiles]) {
            for case let fileURL as URL in enumerator {
                let values = try fileURL.resourceValues(forKeys: [.isRegularFileKey])
                guard values.isRegularFile == true else { continue }
                let rel = fileURL.path.replacingOccurrences(of: assetsDir.path + "/", with: "")
                    .replacingOccurrences(of: "\\", with: "/")
                let body = try Data(contentsOf: fileURL)
                try run(
                    db,
                    "INSERT INTO slop_assets(path, mime, body) VALUES (?, ?, ?)",
                    .text("/" + rel),
                    .text(mimeFor(fileURL)),
                    .blob(body)
                )
            }
        }

        try exec(db, "PRAGMA wal_checkpoint(TRUNCATE)")
        sqlite3_close(db)
        sealed = true

        let packed = try SlopDatabase(packageURL: destination)
        try SlopPreviewIcon.installFromDatabase(packed, into: destination)
        try packed.checkpoint()
        packed.close()
        return destination
    }

    private enum Bind {
        case text(String)
        case blob(Data)
    }

    private static func exec(_ db: OpaquePointer, _ sql: String) throws {
        var error: UnsafeMutablePointer<CChar>?
        let code = sqlite3_exec(db, sql, nil, nil, &error)
        guard code == SQLITE_OK else {
            let message = error.map { String(cString: $0) } ?? String(cString: sqlite3_errmsg(db))
            sqlite3_free(error)
            throw SlopError.sqlite(message)
        }
    }

    private static func run(_ db: OpaquePointer, _ sql: String, _ binds: Bind...) throws {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            throw SlopError.sqlite(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(statement) }
        for (offset, bind) in binds.enumerated() {
            let index = Int32(offset + 1)
            let code: Int32
            switch bind {
            case .text(let value):
                code = sqlite3_bind_text(statement, index, value, -1, packSQLiteTransient)
            case .blob(let data):
                code = data.withUnsafeBytes { bytes in
                    sqlite3_bind_blob(statement, index, bytes.baseAddress, Int32(bytes.count), packSQLiteTransient)
                }
            }
            guard code == SQLITE_OK else {
                throw SlopError.sqlite(String(cString: sqlite3_errmsg(db)))
            }
        }
        let step = sqlite3_step(statement)
        guard step == SQLITE_DONE || step == SQLITE_ROW else {
            throw SlopError.sqlite(String(cString: sqlite3_errmsg(db)))
        }
    }

    private static func stringifyJSON(_ value: Any) -> String {
        switch value {
        case let number as NSNumber:
            if CFGetTypeID(number) == CFBooleanGetTypeID() {
                return number.boolValue ? "1" : "0"
            }
            return number.stringValue
        case let string as String:
            return string
        case is NSNull:
            return ""
        default:
            return String(describing: value)
        }
    }

    private static func mimeFor(_ url: URL) -> String {
        switch url.pathExtension.lowercased() {
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "webp": return "image/webp"
        case "svg": return "image/svg+xml"
        case "css": return "text/css"
        case "js": return "text/javascript"
        case "json": return "application/json"
        case "woff2": return "font/woff2"
        default: return "application/octet-stream"
        }
    }
}

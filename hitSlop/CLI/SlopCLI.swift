import AppKit
import ArgumentParser
import Foundation
#if SWIFT_PACKAGE
import SlopCore
#endif

@main
struct SlopCommand: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "slop",
        abstract: "Inspect and edit SQLite-backed hitSlop mini-documents.",
        version: "0.2.0",
        subcommands: [
            Templates.self, Create.self, Pack.self, Stat.self, Schema.self, Query.self, Exec.self,
            Read.self, Write.self, Duplicate.self, Export.self, Watch.self, Open.self,
        ]
    )
}

private struct Templates: ParsableCommand {
    static let configuration = CommandConfiguration(abstract: "List installed .slop templates as JSON.")

    func run() throws {
        let result = try TemplateLocator.templates().map { url -> [String: Any] in
            let database = try SlopDatabase(packageURL: url, readOnly: true)
            let metadata = try database.metadata()
            return [
                "id": metadata["template_id"] ?? url.deletingPathExtension().lastPathComponent,
                "title": metadata.title,
                "summary": metadata.summary,
                "path": url.path,
            ]
        }
        try printJSON(result)
    }
}

private struct Create: ParsableCommand {
    static let configuration = CommandConfiguration(abstract: "Create a document by cloning a template.")

    @Option(name: .long, help: "Template id, name, or .slop path.")
    var template: String

    @Option(name: .long, help: "Destination .slop path.")
    var output: String

    func run() throws {
        let source = try TemplateLocator.resolve(template)
        let requested = resolveURL(output)
        let title = requested.deletingPathExtension().lastPathComponent
        let url = try SlopPackage.clone(from: source, to: requested, title: title)
        try printJSON(["path": url.path, "title": title])
    }
}

private struct Pack: ParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "Pack a template folder (view.html + schema.sql) into a .slop package."
    )

    @Argument(help: "Authoring directory containing view.html.")
    var source: String

    @Option(name: .long, help: "Destination .slop path. Defaults to <dir>.slop")
    var output: String?

    func run() throws {
        let sourceURL = resolveURL(source)
        let destination = output.map(resolveURL)
        let url = try SlopPackage.pack(from: sourceURL, to: destination)
        try printJSON(["path": url.path])
    }
}

private struct Stat: ParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "Print document metadata, embedded instructions, and schema as JSON."
    )

    @Argument(help: "Path to a .slop document.")
    var path: String

    func run() throws {
        let database = try SlopDatabase(packageURL: resolveURL(path), readOnly: true)
        try printJSON([
            "meta": try database.metadata().values,
            "docs": database.jsonRows(try database.docs()),
            "schema": database.jsonRows(try database.schema()),
        ])
    }
}

private struct Schema: ParsableCommand {
    static let configuration = CommandConfiguration(abstract: "Print the complete SQLite schema as JSON.")

    @Argument(help: "Path to a .slop document.")
    var path: String

    func run() throws {
        let database = try SlopDatabase(packageURL: resolveURL(path), readOnly: true)
        try printJSON(database.jsonRows(try database.schema()))
    }
}

private struct Query: ParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "Run a read-only SQL statement and print rows as JSON."
    )

    @Argument(help: "Path to a .slop document.")
    var path: String

    @Argument(help: "A single read-only SQL statement.")
    var sql: String

    @Option(name: .long, help: "Bound values encoded as a JSON array.")
    var params: String?

    func run() throws {
        let database = try SlopDatabase(packageURL: resolveURL(path), readOnly: true)
        let rows = try database.query(sql, parameters: try parseParameters(params))
        try printJSON(database.jsonRows(rows))
    }
}

private struct Exec: ParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "Run one mutating SQL statement and bump the document revision."
    )

    @Argument(help: "Path to a .slop document.")
    var path: String

    @Argument(help: "A single INSERT, UPDATE, DELETE, or DDL statement.")
    var sql: String

    @Option(name: .long, help: "Bound values encoded as a JSON array.")
    var params: String?

    func run() throws {
        let database = try SlopDatabase(packageURL: resolveURL(path))
        let result = try database.execute(sql, parameters: try parseParameters(params))
        try database.checkpoint()
        try printJSON(result)
    }
}

private struct Read: ParsableCommand {
    static let configuration = CommandConfiguration(abstract: "Read one embedded slop_docs topic.")

    @Argument(help: "Path to a .slop document.")
    var path: String

    @Argument(help: "Topic name in slop_docs.")
    var topic: String

    func run() throws {
        let database = try SlopDatabase(packageURL: resolveURL(path), readOnly: true)
        let rows = try database.query(
            "SELECT topic, body FROM slop_docs WHERE topic = ?",
            parameters: [topic]
        )
        guard let row = database.jsonRows(rows).first else {
            throw SlopError.invalidArgument("No slop_docs topic named \(topic).")
        }
        try printJSON(row)
    }
}

private struct Write: ParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "Replace one embedded slop_docs topic from a file or stdin."
    )

    @Argument(help: "Path to a .slop document.")
    var path: String

    @Argument(help: "Topic name in slop_docs.")
    var topic: String

    @Option(name: .long, help: "Read the new body from this UTF-8 file instead of stdin.")
    var file: String?

    func run() throws {
        let body: String
        if let file {
            body = try String(contentsOf: resolveURL(file), encoding: .utf8)
        } else {
            body = String(data: FileHandle.standardInput.readDataToEndOfFile(), encoding: .utf8) ?? ""
        }
        let database = try SlopDatabase(packageURL: resolveURL(path))
        let result = try database.execute(
            "INSERT INTO slop_docs(topic, body) VALUES (?, ?) ON CONFLICT(topic) DO UPDATE SET body = excluded.body",
            parameters: [topic, body]
        )
        try database.checkpoint()
        try printJSON(result)
    }
}

private struct Duplicate: ParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "Duplicate a document with SQLite's backup API and a fresh identity."
    )

    @Argument(help: "Path to the source .slop document.")
    var path: String

    @Option(name: .long, help: "Destination .slop path.")
    var output: String

    func run() throws {
        let destination = resolveURL(output)
        let url = try SlopPackage.clone(
            from: resolveURL(path),
            to: destination,
            title: destination.deletingPathExtension().lastPathComponent
        )
        try printJSON(["path": url.path])
    }
}

private enum ExportFormat: String, ExpressibleByArgument {
    case png
    case pdf
}

private struct Export: AsyncParsableCommand {
    static let configuration = CommandConfiguration(abstract: "Render a document to PNG or PDF.")

    @Argument(help: "Path to a .slop document.")
    var path: String

    @Option(name: .long, help: "Export format: png or pdf.")
    var format: ExportFormat

    @Option(name: .long, help: "Destination image or PDF path.")
    var output: String

    func run() async throws {
        let renderFormat: SlopHeadlessRenderer.Format = format == .png ? .png : .pdf
        let data = try await SlopHeadlessRenderer.render(packageURL: resolveURL(path), format: renderFormat)
        let outputURL = resolveURL(output)
        try data.write(to: outputURL, options: .atomic)
        try printJSON(["path": outputURL.path, "format": format.rawValue, "bytes": data.count])
    }
}

private struct Watch: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "Stream JSON whenever the document revision changes."
    )

    @Argument(help: "Path to a .slop document.")
    var path: String

    func run() async throws {
        let database = try SlopDatabase(packageURL: resolveURL(path), readOnly: true)
        var previous = try database.revision()
        try printJSON(["revision": previous])
        while !Task.isCancelled {
            try await Task.sleep(for: .milliseconds(500))
            let current = try database.revision()
            if current != previous {
                previous = current
                try printJSON(["revision": current])
            }
        }
    }
}

private struct Open: ParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "Open a document in its registered macOS application."
    )

    @Argument(help: "Path to a .slop document.")
    var path: String

    func run() throws {
        let url = resolveURL(path)
        guard NSWorkspace.shared.open(url) else {
            throw SlopError.invalidArgument("Could not open \(url.path).")
        }
        try printJSON(["path": url.path])
    }
}

private enum TemplateLocator {
    static func templates() throws -> [URL] {
        let manager = FileManager.default
        var roots: [URL] = []
        if let override = ProcessInfo.processInfo.environment["HITSLOP_TEMPLATES"] {
            roots.append(resolveURL(override))
        }
        let cwd = URL(fileURLWithPath: manager.currentDirectoryPath)
        roots.append(cwd.appendingPathComponent("Templates"))
        roots.append(cwd.appendingPathComponent("hitSlop/Templates"))
        let executable = resolveURL(CommandLine.arguments[0]).resolvingSymlinksInPath()
        let contents = executable.deletingLastPathComponent().deletingLastPathComponent()
        roots.append(contents.appendingPathComponent("Resources/Templates"))
        if let resources = Bundle.main.resourceURL {
            roots.append(resources.appendingPathComponent("Templates"))
        }
        roots.append(URL(fileURLWithPath: "/Applications/hitSlop.app/Contents/Resources/Templates"))

        for root in roots where manager.fileExists(atPath: root.path) {
            let urls = try manager.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)
                .filter { $0.pathExtension.lowercased() == "slop" }
            if !urls.isEmpty {
                return urls.sorted { $0.lastPathComponent < $1.lastPathComponent }
            }
        }
        throw SlopError.invalidArgument(
            "No template directory found. Set HITSLOP_TEMPLATES or run from the repository."
        )
    }

    static func resolve(_ identifier: String) throws -> URL {
        let direct = resolveURL(identifier)
        if FileManager.default.fileExists(atPath: direct.path) { return direct }
        let normalized = identifier.lowercased().replacingOccurrences(of: " ", with: "-")
        for url in try templates() {
            let database = try? SlopDatabase(packageURL: url, readOnly: true)
            let metadata = try? database?.metadata()
            let id = metadata?["template_id"]?.lowercased()
            let stem = url.deletingPathExtension().lastPathComponent
                .lowercased()
                .replacingOccurrences(of: " ", with: "-")
            if id == identifier.lowercased() || id?.hasSuffix(".\(normalized)") == true || stem == normalized {
                return url
            }
        }
        throw SlopError.invalidArgument("Unknown template: \(identifier)")
    }
}

private func resolveURL(_ path: String) -> URL {
    let expanded = (path as NSString).expandingTildeInPath
    return URL(fileURLWithPath: expanded).standardizedFileURL
}

private func parseParameters(_ json: String?) throws -> [Any] {
    guard let json else { return [] }
    guard let data = json.data(using: .utf8),
          let values = try JSONSerialization.jsonObject(with: data) as? [Any]
    else {
        throw SlopError.invalidArgument("--params must be a JSON array.")
    }
    return values
}

private func printJSON(_ value: Any) throws {
    let data = try slopJSONData(value, pretty: true)
    FileHandle.standardOutput.write(data)
    FileHandle.standardOutput.write(Data("\n".utf8))
}

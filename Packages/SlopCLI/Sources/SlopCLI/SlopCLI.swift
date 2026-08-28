import AppKit
import ArgumentParser
import Foundation
import SlopCore
import SlopMacSupport

@main
struct SlopCLI: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "slop",
        abstract: "Inspect, duplicate, open, and export ElementaryUI .slop apps.",
        version: "1.0.0",
        subcommands: [Validate.self, Duplicate.self, Open.self, Export.self]
    )
}

struct Validate: ParsableCommand {
    static let configuration = CommandConfiguration(abstract: "Validate a slop-wasm/1 document.")
    @Argument(transform: URL.init(fileURLWithPath:)) var document: URL

    func run() throws {
        let package = try SlopPackage(rootURL: document)
        print("valid\t\(package.manifest.format)")
        print("title\t\(package.manifest.title)")
        print("runtime\t\(package.manifest.runtime)")
        print("source\t\(package.isSourceCurrent ? "current" : "needs-rebuild")")
        print("artifact\t\(package.entryURL.path)")
    }
}

struct Duplicate: ParsableCommand {
    static let configuration = CommandConfiguration(abstract: "Create an independent copy with a new document ID.")
    @Argument(transform: URL.init(fileURLWithPath:)) var document: URL
    @Argument(transform: URL.init(fileURLWithPath:)) var destination: URL?

    func run() throws {
        let target = destination ?? SlopDuplicator.nextDuplicateURL(for: document)
        print(try SlopDuplicator.duplicate(from: document, to: target).path)
    }
}

struct Open: ParsableCommand {
    static let configuration = CommandConfiguration(abstract: "Open a document in hitSlop.")
    @Argument(transform: URL.init(fileURLWithPath:)) var document: URL

    func run() throws {
        guard NSWorkspace.shared.open(document) else {
            throw ValidationError("macOS could not open \(document.path)")
        }
    }
}

struct Export: AsyncParsableCommand {
    static let configuration = CommandConfiguration(abstract: "Export the full document as PNG or PDF.")

    enum Format: String, ExpressibleByArgument { case png, pdf }

    @Argument(transform: URL.init(fileURLWithPath:)) var document: URL
    @Option var format: Format
    @Option(name: [.short, .long], transform: URL.init(fileURLWithPath:)) var output: URL?

    @MainActor
    func run() async throws {
        let destination = output ?? document.deletingPathExtension().appendingPathExtension(format.rawValue)
        let data = try await SlopDocumentRenderer.render(
            packageURL: document,
            format: format == .png ? .png : .pdf
        )
        try data.write(to: destination, options: .atomic)
        print(destination.path)
    }
}

import AppKit
import ArgumentParser
import Foundation
import SlopCore
import SlopMacSupport

@main
struct SlopCLI: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "slop",
        abstract: "Inspect, duplicate, open, and export .slop apps.",
        version: "1.0.0",
        subcommands: [Validate.self, Dev.self, PackageTemplates.self, Duplicate.self, Open.self, Export.self]
    )
}

struct Validate: ParsableCommand {
    static let configuration = CommandConfiguration(abstract: "Validate a slop-web/1 document.")
    @Argument(transform: URL.init(fileURLWithPath:)) var document: URL

    func run() throws {
        let package = try SlopPackage(rootURL: document)
        print("valid\t\(package.manifest.format)")
        print("title\t\(package.manifest.title)")
        print("cartridge\t\(package.entryURL.path)")
        print("style\t\(package.styleURL.path)")
    }
}

struct Dev: ParsableCommand {
    static let configuration = CommandConfiguration(abstract: "Build and open an authored template as a disposable runtime cartridge.")
    @Argument(transform: URL.init(fileURLWithPath:)) var template: URL

    func run() throws {
        try WebSDK.run(["dev", template.path])
    }
}

struct PackageTemplates: ParsableCommand {
    static let configuration = CommandConfiguration(abstract: "Build the authored template workspace into Swift package resources.")
    @Flag(help: "Check whether committed cartridges are current without replacing them.") var check = false

    func run() throws {
        var arguments = ["package-templates"]
        if check { arguments.append("--check") }
        try WebSDK.run(arguments)
    }
}

private enum WebSDK {
    static func run(_ arguments: [String]) throws {
        try validateNode()
        let bin = try sdkScript()
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = ["node", bin.path] + arguments
        process.standardOutput = FileHandle.standardOutput
        process.standardError = FileHandle.standardError
        try process.run()
        process.waitUntilExit()
        if process.terminationStatus != 0 {
            throw ExitCode(process.terminationStatus)
        }
    }

    private static func sdkScript() throws -> URL {
        if let override = ProcessInfo.processInfo.environment["SLOP_SDK"] {
            let url = URL(fileURLWithPath: override).appendingPathComponent("bin/slop.mjs")
            if FileManager.default.fileExists(atPath: url.path) { return url }
        }
        if let executable = Bundle.main.executableURL?.resolvingSymlinksInPath() {
            let installed = executable
                .deletingLastPathComponent()
                .deletingLastPathComponent()
                .appendingPathComponent("libexec/hitslop/sdk/bin/slop.mjs")
            if FileManager.default.fileExists(atPath: installed.path) { return installed }
        }
        var directory = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        while true {
            let candidate = directory.appendingPathComponent("sdk/bin/slop.mjs")
            if FileManager.default.fileExists(atPath: candidate.path) { return candidate }
            let parent = directory.deletingLastPathComponent()
            if parent.path == directory.path { break }
            directory = parent
        }
        throw ValidationError("Could not find the hitSlop web SDK. Reinstall the CLI or set SLOP_SDK to an SDK directory.")
    }

    private static func validateNode() throws {
        let process = Process()
        let output = Pipe()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        process.arguments = ["node", "--version"]
        process.standardOutput = output
        process.standardError = output
        do {
            try process.run()
        } catch {
            throw ValidationError("Node 20.19 or newer is required to build .slop packages.")
        }
        process.waitUntilExit()
        let version = String(decoding: output.fileHandleForReading.readDataToEndOfFile(), as: UTF8.self)
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "v"))
        let parts = version.split(separator: ".").compactMap { Int($0) }
        guard process.terminationStatus == 0,
              let major = parts.first,
              major > 20 || (major == 20 && parts.count > 1 && parts[1] >= 19)
        else {
            let found = process.terminationStatus == 0 && !version.isEmpty
                ? version
                : "no usable Node installation"
            throw ValidationError("Node 20.19 or newer is required; found \(found).")
        }
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

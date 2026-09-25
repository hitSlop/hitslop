import AppKit
import ArgumentParser
import Darwin
import Foundation
import HitSlopCore
import HitSlopHost
import HitSlopRuntime
import HitSlopWasm

struct ImportJSON: AsyncParsableCommand {
  static let configuration = CommandConfiguration(commandName: "import", abstract: "Import complete JSON data into a new or existing document.")
  @Argument(transform: URL.init(fileURLWithPath:)) var document: URL
  @Option(transform: URL.init(fileURLWithPath:)) var file: URL
  @Option(name: .customLong("from"), transform: URL.init(fileURLWithPath:)) var source: URL?
  @Flag var replace = false
  @Option var ifVersion: String?

  mutating func validate() throws {
    guard (source != nil) != replace, replace ? ifVersion?.isEmpty == false : ifVersion == nil else {
      throw ValidationError("Use --from TEMPLATE or --replace --if-version TOKEN")
    }
  }

  @MainActor func run() async throws {
    let input = file.standardizedFileURL
    let bytes = try SlopFile.read(input, within: input.deletingLastPathComponent(), maximumBytes: 16 * 1024 * 1024)
    guard (try JSONSerialization.jsonObject(with: bytes)) is [String: Any] else {
      throw ValidationError("Import requires a JSON root object")
    }
    _ = NSApplication.shared
    NSApp.setActivationPolicy(.prohibited)
    let result: Data
    if let source {
      result = try await create(from: source, data: bytes)
    } else {
      result = try await DocumentCommand.run(method: "import", url: document, importData: bytes, expectedVersion: ifVersion)
    }
    print(String(decoding: result, as: UTF8.self))
  }

  @MainActor private func create(from source: URL, data: Data) async throws -> Data {
    let destination = (document.pathExtension.lowercased() == "slop" ? document : document.appendingPathExtension("slop")).standardizedFileURL
    try SlopLocalDocument.requireLocal(destination)
    let templatesRoot = ProcessInfo.processInfo.environment["HITSLOP_TEMPLATES_ROOT"].map { URL(fileURLWithPath: $0) } ?? DocumentFactory.defaultTemplatesRoot
    guard !DocumentFactory.isManagedTemplatePackage(destination),
      !DocumentFactory.isManagedTemplatePackage(destination, templatesRoot: templatesRoot) else {
      throw ValidationError("A document cannot be created in the template cache")
    }
    let manager = FileManager.default
    guard !manager.fileExists(atPath: destination.path) else { throw CocoaError(.fileWriteFileExists) }
    // Validate the immutable source before creating any staging directories.
    try SlopPackage(rootURL: source).validateAsTemplate()
    let parent = destination.deletingLastPathComponent()
    try manager.createDirectory(at: parent, withIntermediateDirectories: true)
    let staging = parent.appendingPathComponent(".hitslop-import-" + UUID().uuidString, isDirectory: true)
    try manager.createDirectory(at: staging, withIntermediateDirectories: false, attributes: [.posixPermissions: 0o700])
    defer { try? manager.removeItem(at: staging) }
    let package = staging.appendingPathComponent("Document.slop", isDirectory: true)
    try DocumentFactory().create(fromLocalPackage: source, at: package)
    let snapshot = try await DocumentCommand.run(method: "snapshot", url: package)
    guard let state = try JSONSerialization.jsonObject(with: snapshot) as? [String: Any],
      let version = state["version"] as? String else { throw ValidationError("Missing destination version") }
    _ = try await DocumentCommand.run(method: "import", url: package, importData: data, expectedVersion: version, fresh: true)
    // The helper has flushed and closed the staging session. Publish without replacing any path.
    guard renameatx_np(AT_FDCWD, package.path, AT_FDCWD, destination.path, UInt32(RENAME_EXCL)) == 0 else {
      throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO)
    }
    await SlopPreviewWriter.installExistingPreviewAsync(for: destination)
    do {
      return try await DocumentCommand.run(method: "snapshot", url: destination)
    } catch {
      throw ValidationError("Created \(destination.path), but could not read its snapshot: \(error.localizedDescription). Inspect the destination before another import.")
    }
  }
}

import AppKit
import ArgumentParser
import Foundation
import HitSlopCore
import HitSlopHost
import HitSlopRuntime

@main struct NativeCLI: AsyncParsableCommand {
  static let configuration = CommandConfiguration(
    commandName: "hitslop-native", abstract: "Native rendering companion for @hitslop/cli.",
    subcommands: [
      Screenshot.self, Export.self, OpenDev.self, Inspect.self, Apply.self, Create.self, Open.self,
    ])
}

struct Screenshot: AsyncParsableCommand {
  enum Target: String, ExpressibleByArgument { case preview, icon }
  @Argument(transform: URL.init(fileURLWithPath:)) var package: URL
  @Option(transform: URL.init(fileURLWithPath:)) var output: URL
  @Option var target: Target = .preview
  @Flag var ifPresent = false
  @MainActor func run() async throws {
    let data: Data?
    switch target {
    case .preview: data = try await SlopRenderer.previewPNGData(packageURL: package)
    case .icon: data = try await SlopRenderer.targetPNGData(packageURL: package, target: .icon)
    }
    guard let data else {
      if ifPresent { return }
      throw ValidationError("The slop does not define a \(target.rawValue) render target.")
    }
    try data.write(to: output, options: .atomic)
    print(output.path)
  }
}
struct Export: AsyncParsableCommand {
  enum Format: String, ExpressibleByArgument { case png, pdf }
  @Argument(transform: URL.init(fileURLWithPath:)) var package: URL
  @Option var format: Format
  @Option(transform: URL.init(fileURLWithPath:)) var output: URL
  @MainActor func run() async throws {
    let data =
      format == .png
      ? try await SlopRenderer.exportPNGData(packageURL: package)
      : try await SlopRenderer.exportPDFData(packageURL: package)
    try data.write(to: output, options: .atomic)
    print(output.path)
  }
}
struct Inspect: AsyncParsableCommand {
  @Argument(transform: URL.init(fileURLWithPath:)) var package: URL
  @MainActor func run() async throws {
    let opened = try SlopPackage(rootURL: package)
    guard let document = try SlopCommandDocument.open(package: opened) else {
      throw ValidationError("This slop does not use a collaborative document.")
    }
    try await document.start()
    let frame = try await document.frame()
    print(frame.data)
    try await document.close()
  }
}

struct Apply: AsyncParsableCommand {
  @Argument(transform: URL.init(fileURLWithPath:)) var package: URL
  @Option(name: .customLong("json")) var json: String
  @MainActor func run() async throws {
    let opened = try SlopPackage(rootURL: package)
    guard let document = try SlopCommandDocument.open(package: opened) else {
      throw ValidationError("This slop does not use a collaborative document.")
    }
    guard let bytes = json.data(using: .utf8) else { throw ValidationError("--json must be UTF-8") }
    try await document.start()
    let frame = try await document.frame()
    let opening = try await document.openGuest()
    let request: String = try document.engine.call(
      "replace",
      [frame.snapshot.json, try StateEngine.utf8(bytes), opening.lease.json, UUID().uuidString])
    let result = try await document.apply(request)
    guard result.ok else { throw ValidationError(result.error?.message ?? "Document edit failed") }
    try await document.close()
    print(package.path)
  }
}

struct Create: AsyncParsableCommand {
  @Option(name: .customLong("from"), transform: URL.init(fileURLWithPath:)) var source: URL?
  @Option(transform: URL.init(fileURLWithPath:)) var catalogEntry: URL?
  @Option(transform: URL.init(fileURLWithPath:)) var output: URL
  struct Entry: Decodable {
    let publisherKeyID: String
    let slug: String
    let release: Int
    let artifactKey: String
    let artifactSha256: String
    let catalogURL: URL
  }
  @MainActor func run() async throws {
    let output =
      self.output.pathExtension.lowercased() == "slop"
      ? self.output : self.output.appendingPathExtension("slop")
    let templatesRoot =
      ProcessInfo.processInfo.environment["HITSLOP_TEMPLATES_ROOT"].map { URL(fileURLWithPath: $0) }
      ?? DocumentFactory.defaultTemplatesRoot
    guard (source == nil) != (catalogEntry == nil) else {
      throw ValidationError("Provide --from or --catalog-entry")
    }
    guard !DocumentFactory.isManagedTemplatePackage(output),
      !DocumentFactory.isManagedTemplatePackage(output, templatesRoot: templatesRoot)
    else { throw ValidationError("A document cannot be created in the template cache") }
    try FileManager.default.createDirectory(
      at: output.deletingLastPathComponent(), withIntermediateDirectories: true)
    if let source {
      try DocumentFactory(catalogURL: URL(string: "https://api.hitslop.com")!).create(
        fromLocalPackage: source, at: output)
    } else if let catalogEntry {
      let entry = try JSONDecoder().decode(Entry.self, from: Data(contentsOf: catalogEntry))
      guard
        entry.publisherKeyID.range(of: "^[a-zA-Z0-9_-]{16,64}$", options: .regularExpression)
          != nil,
        entry.slug.range(of: "^[a-z0-9]+(?:-[a-z0-9]+)*$", options: .regularExpression) != nil,
        entry.artifactSha256.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil,
        entry.release > 0, ["http", "https"].contains(entry.catalogURL.scheme ?? ""),
        entry.artifactKey == "artifacts/sha256/\(entry.artifactSha256).slop.zip"
      else { throw ValidationError("Invalid catalog entry") }
      _ = try await DocumentFactory(catalogURL: entry.catalogURL, templatesRoot: templatesRoot)
        .create(
          from: SlopRemoteTemplate(
            publisherKeyID: entry.publisherKeyID, slug: entry.slug, release: entry.release,
            artifactKey: entry.artifactKey, artifactSha256: entry.artifactSha256
          ), at: output)
      try? await SlopCloudAPI(origin: entry.catalogURL).recordCreation(
        templateId: "\(entry.publisherKeyID)_\(entry.slug)")
    }
    await SlopPreviewWriter.installExistingPreviewAsync(for: output)
    print(output.path)
  }
}

struct Open: AsyncParsableCommand {
  @Argument(transform: URL.init(fileURLWithPath:)) var package: URL
  @MainActor func run() async throws {
    _ = try SlopPackage(rootURL: package)
    guard !DocumentFactory.isManagedTemplatePackage(package) else {
      throw ValidationError("Create a writable copy of this template first")
    }
    guard let app = NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.hitslop.app")
    else {
      throw ValidationError("Install hitSlop.app to open documents")
    }
    let configuration = NSWorkspace.OpenConfiguration()
    configuration.activates = true
    try await NSWorkspace.shared.open(
      [package], withApplicationAt: app, configuration: configuration)
    print(package.path)
  }
}

struct OpenDev: AsyncParsableCommand {
  @Argument var address: String
  @Option var width: Double = 800
  @Option var height: Double = 600
  func run() async throws {
    guard let url = URL(string: address) else { throw ValidationError("Invalid development URL") }
    await MainActor.run {
      let application = NSApplication.shared
      application.setActivationPolicy(.regular)
      SlopRenderer.openDevelopmentURL(url, size: .init(width: width, height: height))
      application.run()
    }
  }
}

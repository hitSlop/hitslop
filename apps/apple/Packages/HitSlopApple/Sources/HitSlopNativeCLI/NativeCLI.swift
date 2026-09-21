import AppKit
import ArgumentParser
import Foundation
import HitSlopCore
import HitSlopHost
import HitSlopRuntime
import HitSlopWasm

@main struct NativeCLI: AsyncParsableCommand {
  static let configuration = CommandConfiguration(
    commandName: "hitslop-native", abstract: "Read, edit, open, and export hitSlop documents.",
    subcommands: [
      RuntimeInfo.self, Theme.self, StorageProbe.self, Screenshot.self, Export.self, OpenDev.self,
      Get.self, Schema.self,
      Apply.self, Batch.self, Compact.self, Create.self, Open.self,
    ])
}

struct Screenshot: AsyncParsableCommand {
  enum Target: String, ExpressibleByArgument { case preview, icon }
  @Argument(transform: URL.init(fileURLWithPath:)) var package: URL
  @Option(transform: URL.init(fileURLWithPath:)) var output: URL
  @Option var target: Target = .preview
  @Flag var ifPresent = false
  @MainActor func run() async throws {
    initializeNativeApplication()
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
    initializeNativeApplication()
    try await SlopRenderer.exportDocument(
      packageURL: package, format: format.rawValue, output: output)
    print(output.path)
  }
}
struct DocumentArguments: ParsableArguments {
  @Argument(transform: URL.init(fileURLWithPath:)) var package: URL
}
@MainActor private func initializeNativeApplication() {
  _ = NSApplication.shared
  NSApp.setActivationPolicy(.prohibited)
}
@MainActor private func printDocument(
  _ method: String, _ arguments: DocumentArguments, operation: String? = nil,
  operations: String? = nil
) async throws {
  if method != "schema" { initializeNativeApplication() }
  let result = try await DocumentCommand.run(
    method: method, url: arguments.package,
    operation: operation.map { Data($0.utf8) }, operations: operations.map { Data($0.utf8) })
  print(String(decoding: result, as: UTF8.self))
}
struct Get: AsyncParsableCommand {
  @OptionGroup var document: DocumentArguments
  @MainActor func run() async throws { try await printDocument("get", document) }
}
struct Schema: AsyncParsableCommand {
  @OptionGroup var document: DocumentArguments
  @MainActor func run() async throws { try await printDocument("schema", document) }
}
struct Apply: AsyncParsableCommand {
  @OptionGroup var document: DocumentArguments
  @Option var op: String
  @MainActor func run() async throws { try await printDocument("apply", document, operation: op) }
}
struct Batch: AsyncParsableCommand {
  @OptionGroup var document: DocumentArguments
  @Option var ops: String
  @MainActor func run() async throws { try await printDocument("batch", document, operations: ops) }
}
struct Compact: AsyncParsableCommand {
  @OptionGroup var document: DocumentArguments
  @MainActor func run() async throws { try await printDocument("compact", document) }
}
struct Create: AsyncParsableCommand {
  @Option(name: .customLong("from"), transform: URL.init(fileURLWithPath:)) var source: URL
  @Option(transform: URL.init(fileURLWithPath:)) var output: URL
  @MainActor func run() async throws {
    let output =
      self.output.pathExtension.lowercased() == "slop"
      ? self.output : self.output.appendingPathExtension("slop")
    let templatesRoot =
      ProcessInfo.processInfo.environment["HITSLOP_TEMPLATES_ROOT"].map { URL(fileURLWithPath: $0) }
      ?? DocumentFactory.defaultTemplatesRoot
    guard !DocumentFactory.isManagedTemplatePackage(output),
      !DocumentFactory.isManagedTemplatePackage(output, templatesRoot: templatesRoot)
    else { throw ValidationError("A document cannot be created in the template cache") }
    try FileManager.default.createDirectory(
      at: output.deletingLastPathComponent(), withIntermediateDirectories: true)
    try DocumentFactory().create(
      fromLocalPackage: source, at: output)
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

struct StorageProbe: ParsableCommand {
  static let configuration = CommandConfiguration(shouldDisplay: false)
  @Argument var root: String
  @Argument var phase: String
  @Argument var marker: String
  @Argument var payload: String
  func run() throws {
    #if DEBUG
      try DebugStorageProbe.run([root, phase, marker, payload])
    #else
      throw ValidationError("Debug-only probe")
    #endif
  }
}

struct RuntimeInfo: AsyncParsableCommand {
  static let configuration = CommandConfiguration(commandName: "runtime-info")
  @MainActor func run() async throws {
    print(String(decoding: try WasmSession.runtimeCapabilitiesData(), as: UTF8.self))
  }
}
struct Theme: AsyncParsableCommand {
  static let configuration = CommandConfiguration(subcommands: [
    ThemeGet.self, ThemeSet.self, ThemeReset.self,
  ])
}
struct ThemeGet: AsyncParsableCommand {
  static let configuration = CommandConfiguration(commandName: "get")
  @Argument(transform: URL.init(fileURLWithPath:)) var document: URL
  @MainActor func run() async throws {
    initializeNativeApplication()
    print(
      String(
        decoding: try await DocumentCommand.run(method: "theme.get", url: document), as: UTF8.self))
  }
}
struct ThemeSet: AsyncParsableCommand {
  static let configuration = CommandConfiguration(commandName: "set")
  @Argument(transform: URL.init(fileURLWithPath:)) var document: URL
  @Option var values: String
  @MainActor func run() async throws {
    initializeNativeApplication()
    print(
      String(
        decoding: try await DocumentCommand.run(
          method: "theme.set", url: document, themeValues: Data(values.utf8)), as: UTF8.self))
  }
}
struct ThemeReset: AsyncParsableCommand {
  static let configuration = CommandConfiguration(commandName: "reset")
  @Argument(transform: URL.init(fileURLWithPath:)) var document: URL
  @Option var token: String?
  @MainActor func run() async throws {
    initializeNativeApplication()
    print(
      String(
        decoding: try await DocumentCommand.run(
          method: "theme.reset", url: document, themeToken: token), as: UTF8.self))
  }
}

import AppKit
import ArgumentParser
import Foundation
import HitSlopHost

@main struct NativeCLI: AsyncParsableCommand {
    static let configuration = CommandConfiguration(commandName: "hitslop-native", abstract: "Native rendering companion for @hitslop/cli.", subcommands: [Screenshot.self, Export.self, OpenDev.self])
}

struct Screenshot: AsyncParsableCommand {
    @Argument(transform: URL.init(fileURLWithPath:)) var package: URL
    @Option(transform: URL.init(fileURLWithPath:)) var output: URL
    @MainActor func run() async throws { try await SlopRenderer.previewPNGData(packageURL: package).write(to: output, options: .atomic); print(output.path) }
}
struct Export: AsyncParsableCommand {
    enum Format: String, ExpressibleByArgument { case png, pdf }
    @Argument(transform: URL.init(fileURLWithPath:)) var package: URL
    @Option var format: Format
    @Option(transform: URL.init(fileURLWithPath:)) var output: URL
    @MainActor func run() async throws { let data = format == .png ? try await SlopRenderer.exportPNGData(packageURL: package) : try await SlopRenderer.exportPDFData(packageURL: package); try data.write(to: output, options: .atomic); print(output.path) }
}
struct OpenDev: AsyncParsableCommand {
    @Argument var address: String; @Option var width: Double = 800; @Option var height: Double = 600
    func run() async throws {
        guard let url = URL(string: address) else { throw ValidationError("Invalid development URL") }
        await MainActor.run { let application = NSApplication.shared; application.setActivationPolicy(.regular); SlopRenderer.openDevelopmentURL(url, size: .init(width: width, height: height)); application.run() }
    }
}

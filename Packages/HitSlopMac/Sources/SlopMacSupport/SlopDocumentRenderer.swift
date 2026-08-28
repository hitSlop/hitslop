import AppKit
import SlopCore
import SlopWebRuntime
import WebKit

@MainActor
public enum SlopDocumentRenderer {
    public enum Format: String, Sendable { case png, pdf }

    public static func render(packageURL: URL, format: Format) async throws -> Data {
        let context = try RenderContext(packageURL: packageURL)
        defer { context.close() }
        try await context.prepare(fullContent: true)
        switch format {
        case .png:
            let configuration = WKSnapshotConfiguration()
            configuration.rect = context.session.webView.bounds
            let image = try await context.session.webView.takeSnapshot(configuration: configuration)
            guard let data = image.pngData else {
                throw SlopHostError.invalidPackage("Could not encode the rendered document as PNG")
            }
            return data
        case .pdf:
            let configuration = WKPDFConfiguration()
            configuration.rect = context.session.webView.bounds
            return try await context.session.webView.pdf(configuration: configuration)
        }
    }

    public static func preview(packageURL: URL) async throws -> Data {
        let context = try RenderContext(packageURL: packageURL)
        defer { context.close() }
        try await context.prepare(fullContent: false)
        let configuration = WKSnapshotConfiguration()
        configuration.rect = context.session.webView.bounds
        configuration.snapshotWidth = 430
        let image = try await context.session.webView.takeSnapshot(configuration: configuration)
        guard let data = image.pngData else {
            throw SlopHostError.invalidPackage("Could not encode the document preview")
        }
        return data
    }
}

@MainActor
private final class RenderContext {
    let session: SlopRuntimeSession
    private let window: NSWindow

    init(packageURL: URL) throws {
        if !NSApplication.shared.isRunning {
            NSApplication.shared.setActivationPolicy(.prohibited)
            NSApplication.shared.finishLaunching()
        }
        session = try SlopRuntimeSession(packageURL: packageURL)
        let size = NSSize(width: session.package.manifest.window.width, height: session.package.manifest.window.height)
        window = NSWindow(
            contentRect: NSRect(origin: .zero, size: size),
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        session.webView.frame = NSRect(origin: .zero, size: size)
        window.contentView = session.webView
        window.setFrameOrigin(NSPoint(x: -20_000, y: -20_000))
        window.orderBack(nil)
    }

    func prepare(fullContent: Bool) async throws {
        session.load()
        try await session.waitUntilReady()
        let width = session.package.manifest.window.width
        var height = session.package.manifest.window.height
        if fullContent {
            let value = try await session.webView.evaluateJavaScript(
                "Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0, window.innerHeight)"
            )
            if let number = value as? NSNumber { height = max(height, number.doubleValue) }
        }
        guard height <= 32_767, width * height <= 80_000_000 else {
            throw SlopHostError.invalidPackage("The full document is too large to export as one page")
        }
        let size = NSSize(width: width, height: height.rounded(.up))
        session.webView.frame = NSRect(origin: .zero, size: size)
        window.setContentSize(size)
        try await Task.sleep(for: .milliseconds(120))
    }

    func close() {
        session.close()
        window.orderOut(nil)
    }

}

private extension NSImage {
    var pngData: Data? {
        guard let tiffRepresentation, let bitmap = NSBitmapImageRep(data: tiffRepresentation) else { return nil }
        return bitmap.representation(using: .png, properties: [:])
    }
}

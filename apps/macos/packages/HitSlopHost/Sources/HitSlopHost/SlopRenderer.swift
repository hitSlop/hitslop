import AppKit
import Foundation
import HitSlopCore
import WebKit

@MainActor public enum SlopRenderer {
    public static func pngData(packageURL: URL) async throws -> Data {
        let session = try SlopRuntimeSession(packageURL: packageURL)
        defer { session.close() }
        let window = NSWindow(contentRect: session.webView.frame, styleMask: [.borderless], backing: .buffered, defer: false)
        window.contentView = session.webView; window.orderOut(nil); session.load(); try await session.waitUntilReady()
        let image = try await session.webView.takeSnapshot(configuration: nil)
        return try SlopPreviewImage.png(from: image, package: session.package)
    }
    public static func pdfData(packageURL: URL) async throws -> Data {
        let png = try await pngData(packageURL: packageURL)
        guard let image = NSImage(data: png) else {
            throw SlopPackageError.invalid("could not prepare masked PDF")
        }
        var proposedRect = NSRect(origin: .zero, size: image.size)
        guard let cgImage = image.cgImage(forProposedRect: &proposedRect, context: nil, hints: nil) else { throw SlopPackageError.invalid("could not prepare masked PDF") }
        let data = NSMutableData()
        guard let consumer = CGDataConsumer(data: data as CFMutableData) else { throw SlopPackageError.invalid("could not create PDF consumer") }
        var mediaBox = CGRect(origin: .zero, size: image.size)
        guard let context = CGContext(consumer: consumer, mediaBox: &mediaBox, nil) else { throw SlopPackageError.invalid("could not create PDF context") }
        context.beginPDFPage(nil); context.draw(cgImage, in: mediaBox); context.endPDFPage(); context.closePDF()
        return data as Data
    }
    public static func openDevelopmentURL(_ url: URL, size: CGSize) {
        let view = WKWebView(frame: .init(origin: .zero, size: size)); view.load(URLRequest(url: url)); let window = NSWindow(contentRect: view.frame, styleMask: [.titled, .closable, .resizable], backing: .buffered, defer: false); window.title = "hitSlop Dev"; window.contentView = view; window.makeKeyAndOrderFront(nil); NSApplication.shared.activate(ignoringOtherApps: true)
    }
}

import AppKit
import Foundation
import HitSlopCore
import WebKit

@MainActor public enum SlopRenderer {
    public static func pngData(packageURL: URL) async throws -> Data {
        let package = try SlopPackage(rootURL: packageURL); let (view, bridge) = try SlopWebViewFactory.make(packageURL: packageURL); _ = bridge
        let window = NSWindow(contentRect: view.frame, styleMask: [.borderless], backing: .buffered, defer: false); window.contentView = view; window.orderOut(nil)
        try await Task.sleep(for: .milliseconds(900)); let image = try await view.takeSnapshot(configuration: nil); guard let tiff = image.tiffRepresentation, let bitmap = NSBitmapImageRep(data: tiff), let png = bitmap.representation(using: .png, properties: [:]) else { throw SlopPackageError.invalid("could not encode screenshot") }; _ = package; return png
    }
    public static func pdfData(packageURL: URL) async throws -> Data { let (view, bridge) = try SlopWebViewFactory.make(packageURL: packageURL); _ = bridge; try await Task.sleep(for: .milliseconds(900)); return try await view.pdf(configuration: .init()) }
    public static func openDevelopmentURL(_ url: URL, size: CGSize) {
        let view = WKWebView(frame: .init(origin: .zero, size: size)); view.load(URLRequest(url: url)); let window = NSWindow(contentRect: view.frame, styleMask: [.titled, .closable, .resizable], backing: .buffered, defer: false); window.title = "hitSlop Dev"; window.contentView = view; window.makeKeyAndOrderFront(nil); NSApplication.shared.activate(ignoringOtherApps: true)
    }
}

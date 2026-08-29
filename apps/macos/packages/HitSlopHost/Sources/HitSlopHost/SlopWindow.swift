import AppKit
import HitSlopCore
import SwiftUI

public struct SlopWindowScene: View {
    public let packageURL: URL
    public init(packageURL: URL) { self.packageURL = packageURL }

    public var body: some View {
        let package = try? SlopPackage(rootURL: packageURL)
        let window = package?.manifest.window
        SlopDocumentView(packageURL: packageURL)
            .frame(minWidth: 240, minHeight: 180)
            .frame(width: CGFloat(window?.width ?? 720), height: CGFloat(window?.height ?? 520))
            .background(SlopWindowChrome(packageURL: packageURL))
            .navigationTitle(package?.manifest.title ?? packageURL.deletingPathExtension().lastPathComponent)
    }
}

struct SlopWindowChrome: NSViewRepresentable {
    let packageURL: URL
    func makeNSView(context: Context) -> NSView { let view = NSView(); apply(view); return view }
    func updateNSView(_ view: NSView, context: Context) { apply(view) }

    private func apply(_ view: NSView) {
        DispatchQueue.main.async {
            guard let window = view.window, let package = try? SlopPackage(rootURL: packageURL) else { return }
            let size = NSSize(width: package.manifest.window.width, height: package.manifest.window.height)
            if window.contentView?.frame.size != size { window.setContentSize(size) }
            window.minSize = NSSize(width: 240, height: 180)
            if package.manifest.window.resizable == false {
                window.styleMask.remove(.resizable)
            } else {
                window.styleMask.insert(.resizable)
            }
            window.title = package.manifest.title
            applyShape(window, package.manifest.window)
        }
    }

    private func applyShape(_ window: NSWindow, _ spec: SlopWindow) {
        window.titlebarAppearsTransparent = spec.shape != nil
        window.isOpaque = spec.shape == nil
        window.backgroundColor = spec.shape == nil ? .windowBackgroundColor : .clear
        window.contentView?.wantsLayer = true
        let radius: CGFloat
        switch spec.shape?.kind {
        case .circle: radius = CGFloat(min(spec.width, spec.height)) / 2
        case .capsule: radius = CGFloat(spec.height) / 2
        case .roundedRect: radius = CGFloat(spec.shape?.radius ?? 0)
        case nil: radius = 0
        }
        window.contentView?.layer?.cornerRadius = radius
        window.contentView?.layer?.masksToBounds = radius > 0
        window.invalidateShadow()
    }
}

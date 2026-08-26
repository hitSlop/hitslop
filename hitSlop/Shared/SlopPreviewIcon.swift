import AppKit
import Foundation

/// Finder sees a `.slop` as a package. Quick Look extensions are unreliable for
/// package icons, so a preview is also written as `QuickLook/Preview.png`
/// (raw screenshot) and a square rounded `QuickLook/Thumbnail.png` applied
/// with `NSWorkspace.setIcon`.
public enum SlopPreviewIcon {
    public static let iconPixelSize = 1024

    public static func install(_ png: Data, into packageURL: URL, cornerRadius: CGFloat = 22) throws {
        let folder = packageURL.appendingPathComponent("QuickLook", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        try png.write(to: folder.appendingPathComponent("Preview.png"), options: .atomic)
        try png.write(to: packageURL.appendingPathComponent("preview.png"), options: .atomic)

        if let icon = documentIcon(from: png, cornerRadius: cornerRadius),
           let iconPNG = icon.pngData {
            try iconPNG.write(to: folder.appendingPathComponent("Thumbnail.png"), options: .atomic)
            NSWorkspace.shared.setIcon(icon, forFile: packageURL.path, options: [])
            var iconURL = packageURL.appendingPathComponent("Icon\r")
            var values = URLResourceValues()
            values.isHidden = true
            try? iconURL.setResourceValues(values)
        } else {
            try png.write(to: folder.appendingPathComponent("Thumbnail.png"), options: .atomic)
        }

        try FileManager.default.setAttributes([.modificationDate: Date()], ofItemAtPath: packageURL.path)
        NSWorkspace.shared.noteFileSystemChanged(packageURL.path)
    }

    public static func installFromDatabase(_ database: SlopDatabase, into packageURL: URL) throws {
        guard let asset = try database.asset(path: "/preview.png") else { return }
        let radius = (try? database.metadata().cornerRadius) ?? 22
        try install(asset.data, into: packageURL, cornerRadius: radius)
    }

    public static func png(inPackage packageURL: URL) -> Data? {
        previewFileURL(inPackage: packageURL).flatMap { try? Data(contentsOf: $0) }
    }

    public static func previewFileURL(inPackage packageURL: URL) -> URL? {
        let candidates = [
            packageURL.appendingPathComponent("preview.png"),
            packageURL.appendingPathComponent("QuickLook/Preview.png"),
            packageURL.appendingPathComponent("QuickLook/Thumbnail.png"),
        ]
        return candidates.first { FileManager.default.fileExists(atPath: $0.path) }
    }

    /// Square macOS icon: transparent canvas, document screenshot centered and
    /// clipped to a continuous rounded rect. `setIcon` rejects non-square sizes.
    public static func documentIcon(from png: Data, cornerRadius: CGFloat = 22) -> NSImage? {
        guard let source = NSImage(data: png) else { return nil }
        let sourceSize = source.size
        guard sourceSize.width >= 16, sourceSize.height >= 16 else { return nil }

        let canvas = CGFloat(iconPixelSize)
        guard let rep = NSBitmapImageRep(
            bitmapDataPlanes: nil,
            pixelsWide: iconPixelSize,
            pixelsHigh: iconPixelSize,
            bitsPerSample: 8,
            samplesPerPixel: 4,
            hasAlpha: true,
            isPlanar: false,
            colorSpaceName: .deviceRGB,
            bytesPerRow: 0,
            bitsPerPixel: 0
        ) else { return nil }
        rep.size = NSSize(width: canvas, height: canvas)

        NSGraphicsContext.saveGraphicsState()
        guard let context = NSGraphicsContext(bitmapImageRep: rep) else {
            NSGraphicsContext.restoreGraphicsState()
            return nil
        }
        NSGraphicsContext.current = context
        context.imageInterpolation = .high

        let padding = canvas * 0.08
        let maxCard = canvas - padding * 2
        let scale = min(maxCard / sourceSize.width, maxCard / sourceSize.height)
        let card = NSSize(width: sourceSize.width * scale, height: sourceSize.height * scale)
        let rect = NSRect(
            x: (canvas - card.width) / 2,
            y: (canvas - card.height) / 2,
            width: card.width,
            height: card.height
        )
        let radius = min(max(card.width, card.height) * (cornerRadius / 430), min(card.width, card.height) / 3)

        let path = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
        let shadow = NSShadow()
        shadow.shadowBlurRadius = canvas * 0.028
        shadow.shadowOffset = NSSize(width: 0, height: -canvas * 0.012)
        shadow.shadowColor = NSColor.black.withAlphaComponent(0.28)
        shadow.set()
        NSColor.white.withAlphaComponent(0.001).setFill()
        path.fill()

        context.saveGraphicsState()
        path.addClip()
        shadow.shadowColor = nil
        shadow.set()
        source.draw(in: rect, from: .zero, operation: .sourceOver, fraction: 1)
        context.restoreGraphicsState()

        NSGraphicsContext.restoreGraphicsState()

        let image = NSImage(size: NSSize(width: canvas, height: canvas))
        image.addRepresentation(rep)
        return image
    }
}

private extension NSImage {
    var pngData: Data? {
        guard let tiffRepresentation, let bitmap = NSBitmapImageRep(data: tiffRepresentation) else { return nil }
        return bitmap.representation(using: .png, properties: [:])
    }
}

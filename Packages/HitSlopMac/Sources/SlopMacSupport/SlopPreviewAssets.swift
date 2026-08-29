import AppKit
import Foundation
import SlopCore

public enum SlopPreviewAssets {
    static let iconPointSize: CGFloat = 512
    static let iconPixelSize = 1024

    public static func install(
        _ png: Data,
        into packageURL: URL,
        shape: SlopManifest.WindowShape,
        cornerRadius: CGFloat = 22
    ) throws {
        let folder = packageURL.appendingPathComponent("QuickLook", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let displayedPNG = maskedPreview(from: png, shape: shape) ?? png
        try displayedPNG.write(to: folder.appendingPathComponent("Preview.png"), options: .atomic)
        if let icon = icon(from: displayedPNG, cornerRadius: cornerRadius), let iconPNG = icon.pngData {
            try iconPNG.write(to: folder.appendingPathComponent("Thumbnail.png"), options: .atomic)
            NSWorkspace.shared.setIcon(icon, forFile: packageURL.path)
        } else {
            try displayedPNG.write(to: folder.appendingPathComponent("Thumbnail.png"), options: .atomic)
        }
        try FileManager.default.setAttributes([.modificationDate: Date()], ofItemAtPath: packageURL.path)
        NSWorkspace.shared.noteFileSystemChanged(packageURL.path)
    }

    static func maskedPreview(from png: Data, shape: SlopManifest.WindowShape) -> Data? {
        guard let source = NSImage(data: png),
              let rep = NSBitmapImageRep(
                bitmapDataPlanes: nil,
                pixelsWide: max(1, Int(source.size.width.rounded())),
                pixelsHigh: max(1, Int(source.size.height.rounded())),
                bitsPerSample: 8,
                samplesPerPixel: 4,
                hasAlpha: true,
                isPlanar: false,
                colorSpaceName: .deviceRGB,
                bytesPerRow: 0,
                bitsPerPixel: 0
              ),
              let context = NSGraphicsContext(bitmapImageRep: rep)
        else { return nil }
        let size = source.size
        rep.size = size
        let rect = NSRect(origin: .zero, size: size)
        let path: NSBezierPath
        switch shape.kind {
        case .roundedRect:
            let radius = min(CGFloat(shape.radius ?? 0), min(size.width, size.height) / 2)
            path = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
        case .capsule:
            let radius = min(size.width, size.height) / 2
            path = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
        case .circle:
            path = NSBezierPath(ovalIn: rect)
        }
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = context
        context.cgContext.clear(rect)
        path.addClip()
        source.draw(in: rect)
        NSGraphicsContext.restoreGraphicsState()
        return rep.representation(using: .png, properties: [:])
    }

    public static func previewURL(in packageURL: URL) -> URL? {
        ["QuickLook/Preview.png", "QuickLook/Thumbnail.png"]
            .map(packageURL.appendingPathComponent)
            .first { FileManager.default.fileExists(atPath: $0.path) }
    }

    public static func thumbnailURL(in packageURL: URL) -> URL? {
        ["QuickLook/Thumbnail.png", "QuickLook/Preview.png"]
            .map(packageURL.appendingPathComponent)
            .first { FileManager.default.fileExists(atPath: $0.path) }
    }

    static func icon(from png: Data, cornerRadius: CGFloat) -> NSImage? {
        guard let source = NSImage(data: png), source.size.width >= 16, source.size.height >= 16,
              let rep = NSBitmapImageRep(
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
        rep.size = NSSize(width: iconPointSize, height: iconPointSize)
        NSGraphicsContext.saveGraphicsState()
        defer { NSGraphicsContext.restoreGraphicsState() }
        guard let context = NSGraphicsContext(bitmapImageRep: rep) else { return nil }
        NSGraphicsContext.current = context
        context.imageInterpolation = .high
        let maxCard: CGFloat = 430
        let scale = min(maxCard / source.size.width, maxCard / source.size.height)
        let size = NSSize(width: source.size.width * scale, height: source.size.height * scale)
        let rect = NSRect(
            x: (iconPointSize - size.width) / 2,
            y: (iconPointSize - size.height) / 2,
            width: size.width,
            height: size.height
        )
        let radius = min(max(size.width, size.height) * cornerRadius / 480, min(size.width, size.height) / 3)
        let path = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
        let shadow = NSShadow()
        shadow.shadowBlurRadius = 14
        shadow.shadowOffset = NSSize(width: 0, height: -6)
        shadow.shadowColor = NSColor.black.withAlphaComponent(0.28)
        shadow.set()
        NSColor.white.withAlphaComponent(0.001).setFill()
        path.fill()
        context.saveGraphicsState()
        path.addClip()
        shadow.shadowColor = nil
        shadow.set()
        source.draw(in: rect)
        context.restoreGraphicsState()
        let image = NSImage(size: NSSize(width: iconPointSize, height: iconPointSize))
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

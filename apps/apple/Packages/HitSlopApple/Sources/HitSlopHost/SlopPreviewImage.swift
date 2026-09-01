import AppKit
import Foundation
import HitSlopCore

@MainActor enum SlopPreviewImage {
    static func png(from image: NSImage) throws -> Data {
        let width = max(1, Int(image.size.width.rounded()))
        let height = max(1, Int(image.size.height.rounded()))
        guard let bitmap = NSBitmapImageRep(
            bitmapDataPlanes: nil,
            pixelsWide: width,
            pixelsHigh: height,
            bitsPerSample: 8,
            samplesPerPixel: 4,
            hasAlpha: true,
            isPlanar: false,
            colorSpaceName: .deviceRGB,
            bytesPerRow: 0,
            bitsPerPixel: 0
        ), let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
            throw SlopPackageError.invalid("could not encode rendered image")
        }
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = context
        image.draw(in: NSRect(x: 0, y: 0, width: width, height: height))
        context.flushGraphics()
        NSGraphicsContext.restoreGraphicsState()
        guard let png = bitmap.representation(using: .png, properties: [:]) else {
            throw SlopPackageError.invalid("could not encode rendered image")
        }
        return png
    }

    static func png(from image: NSImage, package: SlopPackage, scale: CGFloat = 1) throws -> Data {
        try SlopWindowMask(package: package).png(from: image, scale: scale)
    }
}

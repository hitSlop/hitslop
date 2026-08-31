import AppKit
import HitSlopCore
import ImageIO

@MainActor final class SlopWindowMask {
    private enum Content {
        case geometry(Shape)
        case image(CGImage, AlphaMap)
    }

    private struct AlphaMap {
        let width: Int
        let height: Int
        let bytes: [UInt8]

        init(image: CGImage) throws {
            width = image.width
            height = image.height
            var rgba = [UInt8](repeating: 0, count: width * height * 4)
            guard let context = CGContext(
                data: &rgba,
                width: width,
                height: height,
                bitsPerComponent: 8,
                bytesPerRow: width * 4,
                space: CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
            ) else { throw SlopPackageError.invalid("could not read window image mask alpha") }
            context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
            bytes = stride(from: 3, to: rgba.count, by: 4).map { rgba[$0] }
        }

        func contains(_ point: CGPoint, in bounds: CGRect) -> Bool {
            guard bounds.width > 0, bounds.height > 0, bounds.contains(point) else { return false }
            let x = min(width - 1, max(0, Int((point.x / bounds.width) * CGFloat(width))))
            let appKitY = min(height - 1, max(0, Int((point.y / bounds.height) * CGFloat(height))))
            let y = height - 1 - appKitY
            return bytes[y * width + x] >= 26 // 10% alpha: soft edges look smooth without catching empty pixels.
        }
    }

    private let content: Content

    init(package: SlopPackage) throws {
        if let url = try package.skinURL() {
            guard let source = CGImageSourceCreateWithURL(url as CFURL, nil), let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
                throw SlopPackageError.invalid("could not decode window skin")
            }
            content = .image(image, try AlphaMap(image: image))
        } else {
            content = .geometry(package.shape)
        }
    }

    func installBacking(on layer: CALayer?) {
        guard let layer else { return }
        switch content {
        case .geometry:
            layer.backgroundColor = NSColor.windowBackgroundColor.cgColor
        case .image(let image, _):
            layer.contents = image; layer.contentsGravity = .resize
            layer.isGeometryFlipped = true; layer.magnificationFilter = .linear; layer.minificationFilter = .linear
        }
    }

    func makeLayer() -> CALayer {
        switch content {
        case .geometry:
            return CAShapeLayer()
        case .image(let image, _):
            let layer = CALayer()
            layer.contents = image
            layer.contentsGravity = .resize
            layer.isGeometryFlipped = true
            layer.magnificationFilter = .linear
            layer.minificationFilter = .linear
            return layer
        }
    }

    func update(_ layer: CALayer, bounds: CGRect) {
        layer.frame = bounds
        guard case .geometry(let shape) = content, let shapeLayer = layer as? CAShapeLayer else { return }
        shapeLayer.path = Self.path(for: shape, in: bounds).cgPath
    }

    func contains(_ point: CGPoint, in bounds: CGRect) -> Bool {
        switch content {
        case .geometry(let shape):
            return Self.path(for: shape, in: bounds).contains(point)
        case .image(_, let alpha):
            return alpha.contains(point, in: bounds)
        }
    }

    func png(from image: NSImage) throws -> Data {
        let size = image.size
        let masked = NSImage(size: size, flipped: false) { [content] rect in
            switch content {
            case .geometry(let shape):
                Self.path(for: shape, in: rect).addClip()
                image.draw(in: rect)
            case .image(let mask, _):
                image.draw(in: rect)
                NSGraphicsContext.saveGraphicsState()
                if let context = NSGraphicsContext.current?.cgContext {
                    context.setBlendMode(.destinationIn)
                    context.draw(mask, in: rect)
                }
                NSGraphicsContext.restoreGraphicsState()
            }
            return true
        }
        guard let tiff = masked.tiffRepresentation,
              let bitmap = NSBitmapImageRep(data: tiff),
              let png = bitmap.representation(using: .png, properties: [:]) else {
            throw SlopPackageError.invalid("could not encode screenshot")
        }
        return png
    }

    private static func path(for shape: Shape, in rect: CGRect) -> NSBezierPath {
        switch shape {
        case .ellipse:
            return NSBezierPath(ovalIn: rect)
        case .capsule:
            let radius = min(rect.width, rect.height) / 2
            return NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
        case .rounded:
            let radius = min(CGFloat(22), min(rect.width, rect.height) / 2)
            return NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
        }
    }
}

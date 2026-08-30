import AppKit
import Foundation
import HitSlopCore

@MainActor enum SlopPreviewImage {
    static func png(from image: NSImage, package: SlopPackage) throws -> Data {
        try SlopWindowMask(package: package).png(from: image)
    }
}

import AppKit
import Foundation
import HitSlopCore

public extension Notification.Name {
    static let hitSlopPreviewDidChange = Notification.Name("com.hitslop.preview-did-change")
}

@MainActor public enum SlopPreviewWriter {
    public static func write(_ png: Data, to packageURL: URL) throws {
        let directory = packageURL.appendingPathComponent("QuickLook", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try png.write(to: directory.appendingPathComponent("Preview.png"), options: .atomic)
        try png.write(to: directory.appendingPathComponent("Thumbnail.png"), options: .atomic)
        installFinderIcon(png, packageURL: packageURL)
        announce(packageURL)
    }

    public static func installExistingPreview(for packageURL: URL) {
        guard let package = try? SlopPackage(rootURL: packageURL),
              let png = (try? Data(contentsOf: package.thumbnailURL)) ?? (try? Data(contentsOf: package.previewURL)) else { return }
        installFinderIcon(png, packageURL: packageURL)
        announce(packageURL)
    }

    private static func installFinderIcon(_ png: Data, packageURL: URL) {
        guard let image = NSImage(data: png) else { return }
        NSWorkspace.shared.setIcon(image, forFile: packageURL.path, options: [])
    }

    private static func announce(_ packageURL: URL) {
        NSWorkspace.shared.noteFileSystemChanged(packageURL.path)
        NotificationCenter.default.post(name: .hitSlopPreviewDidChange, object: packageURL.standardizedFileURL)
    }
}

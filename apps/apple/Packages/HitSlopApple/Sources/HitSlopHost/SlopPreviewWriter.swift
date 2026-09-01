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
        announce(packageURL)
    }

    public static func installExistingPreview(for packageURL: URL) {
        guard (try? SlopPackage(rootURL: packageURL)) != nil else { return }
        installFinderIcon(for: packageURL)
        announce(packageURL)
    }

    public static func installFinderIcon(_ png: Data, for packageURL: URL) {
        guard (try? SlopPackage(rootURL: packageURL)) != nil else { return }
        guard let image = NSImage(data: png) else {
            print("[hitSlop preview] Could not decode icon PNG for \(packageURL.lastPathComponent)")
            return
        }
        if !NSWorkspace.shared.setIcon(image, forFile: packageURL.path, options: []) {
            print("[hitSlop preview] Finder rejected custom icon for \(packageURL.lastPathComponent)")
        }
        announce(packageURL)
    }

    /// Finder list rows use a document custom icon rather than the package's
    /// Quick Look thumbnail. Keep that macOS-only metadata derived from the
    /// immutable author-supplied thumbnail until an authored live icon is
    /// rendered. Never use the live full-document preview.
    private static func installFinderIcon(for packageURL: URL) {
        let finderMetadataURL = packageURL.appendingPathComponent("Icon\r")
        guard !FileManager.default.fileExists(atPath: finderMetadataURL.path) else { return }
        let thumbnailURL = packageURL
            .appendingPathComponent("QuickLook", isDirectory: true)
            .appendingPathComponent("Thumbnail.png")
        guard let image = NSImage(contentsOf: thumbnailURL) else { return }
        if !NSWorkspace.shared.setIcon(image, forFile: packageURL.path, options: []) {
            print("[hitSlop preview] Finder rejected thumbnail icon for \(packageURL.lastPathComponent)")
        }
    }

    private static func announce(_ packageURL: URL) {
        NSWorkspace.shared.noteFileSystemChanged(packageURL.path)
        NotificationCenter.default.post(name: .hitSlopPreviewDidChange, object: packageURL.standardizedFileURL)
    }
}

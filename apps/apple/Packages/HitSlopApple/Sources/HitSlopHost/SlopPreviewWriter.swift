import AppKit
import Foundation
import HitSlopCore
import HitSlopRuntime

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
        guard let package = try? SlopPackage(rootURL: packageURL) else { return }
        installExistingPreview(for: package)
    }

    public static func installExistingPreview(for package: SlopPackage) {
        installFinderIcon(for: package.rootURL)
        announce(package.rootURL)
    }

    public static func installExistingPreviewAsync(for packageURL: URL) async {
        guard let package = try? await SlopPreparation.run({ try SlopPackage(rootURL: packageURL) }),
              !Task.isCancelled else { return }
        installExistingPreview(for: package)
    }

    public static func installFinderIconAsync(
        _ png: Data, for packageURL: URL, isCurrent: () -> Bool = { true }
    ) async {
        guard let package = try? await SlopPreparation.run({ try SlopPackage(rootURL: packageURL) }),
              !Task.isCancelled, isCurrent() else { return }
        installFinderIcon(png, for: package)
    }

    public static func installFinderIcon(_ png: Data, for packageURL: URL) {
        guard let package = try? SlopPackage(rootURL: packageURL) else { return }
        installFinderIcon(png, for: package)
    }

    private static func installFinderIcon(_ png: Data, for package: SlopPackage) {
        let packageURL = package.rootURL
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
    /// Quick Look preview. Keep that macOS-only metadata derived from the
    /// immutable author-supplied icon until an authored close-time icon is
    /// rendered. Never use the live full-document preview.
    private static func installFinderIcon(for packageURL: URL) {
        let finderMetadataURL = packageURL.appendingPathComponent("Icon\r")
        guard !FileManager.default.fileExists(atPath: finderMetadataURL.path) else { return }
        let iconURL = packageURL
            .appendingPathComponent("QuickLook", isDirectory: true)
            .appendingPathComponent("Icon.png")
        guard let image = NSImage(contentsOf: iconURL) else { return }
        if !NSWorkspace.shared.setIcon(image, forFile: packageURL.path, options: []) {
            print("[hitSlop preview] Finder rejected package icon for \(packageURL.lastPathComponent)")
        }
    }

    private static func announce(_ packageURL: URL) {
        NSWorkspace.shared.noteFileSystemChanged(packageURL.path)
        NotificationCenter.default.post(name: .hitSlopPreviewDidChange, object: packageURL.standardizedFileURL)
    }
}

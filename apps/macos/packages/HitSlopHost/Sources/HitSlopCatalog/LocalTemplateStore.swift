import Combine
import Darwin
import Foundation
import HitSlopCore

public struct LocalTemplate: Identifiable, Sendable {
    public let rootURL: URL
    public let packageURL: URL
    public let previewURL: URL
    public let install: LocalTemplateInstall
    public let manifest: SlopManifest

    public var id: String { "local:\(manifest.slug):\(install.artifactSha256)" }
}

@MainActor public final class LocalTemplateStore: ObservableObject {
    @Published public private(set) var templates: [LocalTemplate] = []
    @Published public private(set) var issues: [String] = []
    public let templatesURL: URL

    private var watcher: DispatchSourceFileSystemObject?
    private var descriptor: Int32 = -1

    public init(templatesURL: URL = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".hitslop/templates", isDirectory: true)) {
        self.templatesURL = templatesURL
        refresh()
        startWatching()
    }

    deinit {
        watcher?.cancel()
    }

    public func refresh() {
        do {
            try FileManager.default.createDirectory(at: templatesURL, withIntermediateDirectories: true)
            let children = try FileManager.default.contentsOfDirectory(at: templatesURL, includingPropertiesForKeys: [.isDirectoryKey], options: [.skipsHiddenFiles])
            var next: [LocalTemplate] = []
            var nextIssues: [String] = []
            for child in children.sorted(by: { $0.lastPathComponent.localizedStandardCompare($1.lastPathComponent) == .orderedAscending }) {
                let marker = child.appendingPathComponent("install.json")
                guard FileManager.default.fileExists(atPath: marker.path) else { continue }
                do {
                    let install = try JSONDecoder().decode(LocalTemplateInstall.self, from: Data(contentsOf: marker))
                    let packageURL = try SlopPackage.containedURL(root: child, relativePath: install.package.rawValue)
                    let previewURL = try SlopPackage.containedURL(root: child, relativePath: install.preview.rawValue)
                    guard FileManager.default.fileExists(atPath: previewURL.path) else { throw SlopPackageError.missing(install.preview.rawValue) }
                    let package = try SlopPackage(rootURL: packageURL)
                    guard child.lastPathComponent == package.manifest.slug else { throw SlopPackageError.invalid("install directory must match manifest slug") }
                    next.append(LocalTemplate(rootURL: child, packageURL: packageURL, previewURL: previewURL, install: install, manifest: package.manifest))
                } catch {
                    nextIssues.append("\(child.lastPathComponent): \(error.localizedDescription)")
                }
            }
            templates = next
            issues = nextIssues
        } catch {
            templates = []
            issues = [error.localizedDescription]
        }
    }

    private func startWatching() {
        descriptor = open(templatesURL.path, O_EVTONLY)
        guard descriptor >= 0 else { return }
        let source = DispatchSource.makeFileSystemObjectSource(fileDescriptor: descriptor, eventMask: [.write, .rename, .delete, .extend], queue: .main)
        source.setEventHandler { [weak self] in self?.refresh() }
        source.setCancelHandler { [descriptor] in if descriptor >= 0 { close(descriptor) } }
        watcher = source
        source.resume()
    }
}

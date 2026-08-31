import Combine
import Darwin
import Foundation
import HitSlopCore

public struct LocalTemplate: Identifiable, Sendable {
    public let packageURL: URL
    public let previewURL: URL
    public let manifest: SlopManifest
    public var id: String { "local:\(manifest.slug)" }
}

@MainActor public final class LocalTemplateStore: ObservableObject {
    @Published public private(set) var templates: [LocalTemplate] = []
    @Published public private(set) var issues: [String] = []
    public let templatesURL: URL
    public var installedURL: URL { templatesURL.appendingPathComponent("installed", isDirectory: true) }
    private var watcher: DispatchSourceFileSystemObject?; private var descriptor: Int32 = -1

    public init(templatesURL: URL = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".hitslop/templates", isDirectory: true)) {
        self.templatesURL = templatesURL; refresh(); startWatching()
    }
    deinit { watcher?.cancel() }

    public func refresh() {
        do {
            try FileManager.default.createDirectory(at: installedURL, withIntermediateDirectories: true)
            let children = try FileManager.default.contentsOfDirectory(at: installedURL, includingPropertiesForKeys: [.isDirectoryKey], options: [.skipsHiddenFiles])
            var next: [LocalTemplate] = [], nextIssues: [String] = []
            for child in children.sorted(by: { $0.lastPathComponent.localizedStandardCompare($1.lastPathComponent) == .orderedAscending }) where child.pathExtension.lowercased() == "slop" {
                do {
                    let package = try SlopPackage(rootURL: child); try package.validateAsTemplate()
                    guard child.deletingPathExtension().lastPathComponent == package.manifest.slug else { throw SlopPackageError.invalid("installed filename must match manifest slug") }
                    next.append(LocalTemplate(packageURL: child, previewURL: package.previewURL, manifest: package.manifest))
                } catch { nextIssues.append("\(child.lastPathComponent): \(error.localizedDescription)") }
            }
            let legacy = try FileManager.default.contentsOfDirectory(at: templatesURL, includingPropertiesForKeys: nil, options: [.skipsHiddenFiles]).filter { $0.lastPathComponent != "installed" && $0.lastPathComponent != "cache" }
            if !legacy.isEmpty { nextIssues.append("Legacy template installs were found. Reinstall them with `slop install`.") }
            templates = next; issues = nextIssues
        } catch { templates = []; issues = [error.localizedDescription] }
    }

    private func startWatching() {
        descriptor = open(installedURL.path, O_EVTONLY); guard descriptor >= 0 else { return }
        let source = DispatchSource.makeFileSystemObjectSource(fileDescriptor: descriptor, eventMask: [.write, .rename, .delete, .extend], queue: .main)
        source.setEventHandler { [weak self] in self?.refresh() }; source.setCancelHandler { [descriptor] in if descriptor >= 0 { close(descriptor) } }
        watcher = source; source.resume()
    }
}

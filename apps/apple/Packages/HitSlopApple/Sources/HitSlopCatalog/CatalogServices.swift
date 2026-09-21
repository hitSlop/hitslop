import AppKit
import Combine
import ComposableArchitecture
import HitSlopCore
import HitSlopFeatures
import HitSlopHost
import HitSlopRuntime

@MainActor final class CatalogServices {
    let templatesURL: URL
    private let telemetry: SlopTelemetry
    private let bundledRoot: URL?
    private let chooseDestination: (String) async -> URL?
    private let recordRecent: (URL) -> Void
    private let scanner = CatalogScanner()
    private weak var localStore: LocalTemplateStore?
    init(
        templatesURL: URL,
        bundledRoot: URL? = Bundle.main.resourceURL?.appendingPathComponent("StarterTemplates"),
        telemetry: SlopTelemetry = .disabled,
        chooseDestination: @escaping (String) async -> URL? = CatalogServices.chooseDestination,
        recordRecent: @escaping (URL) -> Void = { NSDocumentController.shared.noteNewRecentDocumentURL($0) }
    ) {
        self.templatesURL = templatesURL; self.bundledRoot = bundledRoot
        self.telemetry = telemetry; self.chooseDestination = chooseDestination; self.recordRecent = recordRecent
    }

    var client: CatalogClient {
        CatalogClient(
            local: { [self] in await local() },
            refreshLocal: { [self] in await localStore?.refresh() },
            recents: { [self] in await recents() },
            create: { [self] entry in
                do { return try await create(entry) }
                catch let error as CancellationError { throw error }
                catch { await telemetry.send(.failed(.create)); throw error }
            }
        )
    }

    private func local() async -> AsyncStream<CatalogSnapshot> {
        let bundled: LocalTemplateSnapshot
        if let bundledRoot, FileManager.default.fileExists(atPath: bundledRoot.path) {
            do { bundled = try await scanner.local(at: bundledRoot, makeImmutable: false) }
            catch { bundled = LocalTemplateSnapshot(issues: ["Could not load built-in templates: \(error.localizedDescription)"]) }
        } else { bundled = LocalTemplateSnapshot() }
        let store = LocalTemplateStore(templatesURL: templatesURL)
        localStore = store
        return AsyncStream(bufferingPolicy: .bufferingNewest(1)) { continuation in
            let token = store.$snapshot.sink { snapshot in
                let starters = bundled.templates.map { template in
                    var entry = Self.localEntry(template)
                    entry.isBundled = true
                    return entry
                }
                continuation.yield(CatalogSnapshot(entries: starters + snapshot.templates.map(Self.localEntry), issues: bundled.issues + snapshot.issues))
            }
            let lifetime = LocalSubscription(store: store, token: token)
            continuation.onTermination = { _ in Task { @MainActor in lifetime.cancel() } }
        }
    }

    func recents() async -> [CatalogEntry] {
        let urls = NSDocumentController.shared.recentDocumentURLs
        return (try? await scanner.recents(urls, templatesRoot: templatesURL)) ?? []
    }

    private func create(_ entry: CatalogEntry) async throws -> URL? {
        guard case .local(let source) = entry.source else { return nil }
        let slug = try await SlopPreparation.run { try SlopPackage(rootURL: source).manifest.slug }
        guard let url = await chooseDestination(slug) else { return nil }
        let factory = DocumentFactory(templatesRoot: templatesURL)
        try await factory.createLocal(from: source, at: url)
        await SlopPreviewWriter.installExistingPreviewAsync(for: url)
        telemetry.send(.created(entry.isBundled ? .bundled : .installed))
        recordRecent(url)
        return url.standardizedFileURL.resolvingSymlinksInPath()
    }

    private static func chooseDestination(_ slug: String) async -> URL? {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.slop]; panel.canCreateDirectories = true
        panel.directoryURL = FileManager.default.urls(for: .desktopDirectory, in: .userDomainMask)[0]; panel.nameFieldStringValue = "\(slug).slop"
        let response = await withCheckedContinuation { continuation in
            panel.begin { continuation.resume(returning: $0) }
        }
        return response == .OK ? panel.url : nil
    }

    static func localEntry(_ template: LocalTemplate) -> CatalogEntry {
        var entry = CatalogEntry(id: "local:\(template.packageURL.path)", source: .local(template.packageURL), title: template.manifest.title)
        apply(template.manifest, to: &entry)
        entry.iconURLs = [template.iconURL, template.previewURL]
        entry.previewURLs = [template.previewURL, template.iconURL]
        entry.packageBytes = template.packageBytes
        entry.createdAt = template.createdAt
        entry.updatedAt = template.updatedAt
        return entry
    }

    nonisolated static func apply(_ manifest: SlopManifest, to entry: inout CatalogEntry) {
        entry.description = manifest.description
        entry.categories = manifest.categories.map(\.rawValue)
        entry.authorName = manifest.author.name
        entry.authorURL = manifest.author.url.flatMap(URL.init(string:))
        entry.initialSize = "\(manifest.presentation.width) × \(manifest.presentation.height)"
    }
}

@MainActor private final class LocalSubscription {
    private var store: LocalTemplateStore?
    private var token: AnyCancellable?
    init(store: LocalTemplateStore, token: AnyCancellable) { self.store = store; self.token = token }
    func cancel() { token?.cancel(); token = nil; store?.stop(); store = nil }
}

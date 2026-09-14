import AppKit
import Combine
import ComposableArchitecture
import HitSlopCore
import HitSlopFeatures
import HitSlopHost
import HitSlopRegistry
import HitSlopRuntime

@MainActor final class CatalogServices {
    let catalogURL: URL
    let templatesURL: URL
    private let scanner = CatalogScanner()
    private weak var localStore: LocalTemplateStore?
    private var hostedGeneration = 0
    private var hostedTemplates: [String: RegistryTemplate] = [:]
    init(catalogURL: URL, templatesURL: URL) { self.catalogURL = catalogURL; self.templatesURL = templatesURL }

    var client: CatalogClient {
        CatalogClient(
            hosted: { [self] category, sort in await hosted(category: category, sort: sort) },
            local: { [self] in await local() },
            refreshLocal: { [self] in await localStore?.refresh() },
            recents: { [self] in await recents() },
            create: { [self] entry in try await create(entry) }
        )
    }
    private func hosted(category: String?, sort: CatalogSort) -> AsyncStream<CatalogSnapshot> {
        hostedGeneration += 1
        let generation = hostedGeneration
        let registry = RegistryModel(catalogURL: catalogURL, subscribeImmediately: false)
        let snapshots = registry.snapshots(category: category, sort: sort == .popular ? .popular : .new)
        return AsyncStream(bufferingPolicy: .bufferingNewest(1)) { continuation in
            let task = Task { @MainActor [self] in
                for await snapshot in snapshots {
                    guard !Task.isCancelled, generation == hostedGeneration else { break }
                    hostedTemplates = Dictionary(snapshot.templates.map { (Self.creationKey($0), $0) }, uniquingKeysWith: { _, new in new })
                    continuation.yield(CatalogSnapshot(entries: snapshot.templates.map(hostedEntry), issues: snapshot.errorMessage.map { [$0] } ?? []))
                }
                registry.stop()
                continuation.finish()
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
    private func local() -> AsyncStream<CatalogSnapshot> {
        let store = LocalTemplateStore(templatesURL: templatesURL)
        localStore = store
        return AsyncStream(bufferingPolicy: .bufferingNewest(1)) { continuation in
            let token = store.$snapshot.sink { snapshot in
                continuation.yield(CatalogSnapshot(entries: snapshot.templates.map(Self.localEntry), issues: snapshot.issues))
            }
            // Retain the watcher for precisely the lifetime of its subscription.
            let lifetime = LocalSubscription(store: store, token: token)
            continuation.onTermination = { _ in Task { @MainActor in lifetime.cancel() } }
        }
    }
    func recents() async -> [CatalogEntry] {
        let urls = NSDocumentController.shared.recentDocumentURLs
        return (try? await scanner.recents(urls, templatesRoot: templatesURL)) ?? []
    }
    private func create(_ entry: CatalogEntry) async throws -> URL? {
        let template: RegistryTemplate?
        let slug: String
        switch entry.source {
        case .hosted(let id):
            guard let value = hostedTemplates[id] else { throw SlopPackageError.invalid("The selected template is no longer available. Refresh the catalog and try again.") }
            template = value; slug = value.slug
        case .local(let url): template = nil; slug = try SlopPackage(rootURL: url).manifest.slug
        case .recent: return nil
        }
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.slop]; panel.canCreateDirectories = true
        panel.directoryURL = SlopLocalDocuments.defaultCreationDirectory(); panel.nameFieldStringValue = "\(slug).slop"
        let response = await withCheckedContinuation { continuation in
            panel.begin { continuation.resume(returning: $0) }
        }
        guard response == .OK, let url = panel.url else { return nil }
        let factory = DocumentFactory(catalogURL: catalogURL, templatesRoot: templatesURL)
        if let template {
            _ = try await factory.create(from: template.remoteTemplate(), at: url)
            SlopPreviewWriter.installExistingPreview(for: url)
            await RegistryModel(catalogURL: catalogURL, subscribeImmediately: false).recordCreation(template: template)
        } else if case .local(let source) = entry.source {
            try factory.create(fromLocalPackage: source, at: url)
            SlopPreviewWriter.installExistingPreview(for: url)
        }
        NSDocumentController.shared.noteNewRecentDocumentURL(url)
        return url.standardizedFileURL.resolvingSymlinksInPath()
    }
    private static func creationKey(_ template: RegistryTemplate) -> String { "\(template.id)@\(template.currentRelease.number)" }
    private func hostedEntry(_ template: RegistryTemplate) -> CatalogEntry {
        var entry = CatalogEntry(id: "hosted:\(template.id)", source: .hosted(Self.creationKey(template)), title: template.title)
        entry.description = template.description
        let known = Set(SlopCategory.allCases.map(\.rawValue))
        var seen = Set<String>()
        entry.categories = template.categories.map { known.contains($0) ? $0 : "other" }.filter { seen.insert($0).inserted }
        entry.authorName = template.authorName; entry.authorURL = template.authorURL.flatMap(URL.init(string:))
        entry.packageBytes = Int64(template.currentRelease.artifact.bytes); entry.updatedAt = template.currentRelease.publishedAt
        entry.releaseNumber = template.currentRelease.number; entry.creationCount = template.creationCount
        entry.iconURLs = [template.currentRelease.icon.key, template.currentRelease.preview.key].compactMap(artifactURL)
        entry.previewURLs = [template.currentRelease.preview.key, template.currentRelease.icon.key].compactMap(artifactURL)
        if let spec = template.currentManifest?.presentation { entry.initialSize = "\(spec.width) × \(spec.height)" }
        return entry
    }
    static func localEntry(_ template: LocalTemplate) -> CatalogEntry {
        var entry = CatalogEntry(id: "local:\(template.manifest.slug)", source: .local(template.packageURL), title: template.manifest.title)
        apply(template.manifest, to: &entry)
        entry.iconURLs = [template.iconURL, template.previewURL]; entry.previewURLs = [template.previewURL, template.iconURL]
        entry.packageBytes = template.packageBytes; entry.createdAt = template.createdAt; entry.updatedAt = template.updatedAt
        return entry
    }
    nonisolated static func apply(_ manifest: SlopManifest, to entry: inout CatalogEntry) {
        entry.description = manifest.description; entry.categories = manifest.categories.map(\.rawValue)
        entry.authorName = manifest.author.name; entry.authorURL = manifest.author.url.flatMap(URL.init(string:))
        entry.initialSize = "\(manifest.presentation.width) × \(manifest.presentation.height)"
    }
    private func artifactURL(_ key: String) -> URL? {
        var components = URLComponents(url: catalogURL.appendingPathComponent("api/artifact"), resolvingAgainstBaseURL: false)
        components?.queryItems = [URLQueryItem(name: "key", value: key)]
        return components?.url
    }
}

@MainActor private final class LocalSubscription {
    private var store: LocalTemplateStore?
    private var token: AnyCancellable?
    init(store: LocalTemplateStore, token: AnyCancellable) { self.store = store; self.token = token }
    func cancel() { token?.cancel(); token = nil; store?.stop(); store = nil }
}

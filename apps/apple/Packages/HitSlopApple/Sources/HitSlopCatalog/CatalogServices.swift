import AppKit
import Combine
import ComposableArchitecture
import HitSlopCore
import HitSlopFeatures
import HitSlopHost
import HitSlopRuntime

@MainActor final class CatalogServices {
    let catalogURL: URL
    let templatesURL: URL
    private let scanner = CatalogScanner()
    private weak var localStore: LocalTemplateStore?
    private var hostedTemplates: [String: SlopCatalogTemplate] = [:]
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
        AsyncStream { continuation in
            continuation.yield(CatalogSnapshot())
            continuation.finish()
        }
    }

    private func fetchHosted(category: String?, sort: CatalogSort) async throws -> CatalogSnapshot {
        var templates = try await SlopCloudAPI(origin: catalogURL).catalog()
        try Task.checkCancellation()
        if let category { templates = templates.filter { $0.categories.contains { $0.rawValue == category } } }
        templates.sort {
            if sort == .popular {
                if $0.creationCount != $1.creationCount { return $0.creationCount > $1.creationCount }
            } else if $0.release.publishedAt != $1.release.publishedAt {
                return $0.release.publishedAt > $1.release.publishedAt
            }
            return $0.id < $1.id
        }
        try Task.checkCancellation()
        hostedTemplates = Dictionary(templates.map { (Self.creationKey($0), $0) }, uniquingKeysWith: { _, new in new })
        return CatalogSnapshot(entries: templates.map(hostedEntry))
    }

    private func local() -> AsyncStream<CatalogSnapshot> {
        let store = LocalTemplateStore(templatesURL: templatesURL)
        localStore = store
        return AsyncStream(bufferingPolicy: .bufferingNewest(1)) { continuation in
            let token = store.$snapshot.sink { snapshot in
                continuation.yield(CatalogSnapshot(entries: snapshot.templates.map(Self.localEntry), issues: snapshot.issues))
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
        let template: SlopCatalogTemplate?
        let slug: String
        switch entry.source {
        case .hosted(let id):
            guard let value = hostedTemplates[id] else { throw SlopPackageError.invalid("The selected template is no longer available. Refresh the catalog and try again.") }
            template = value; slug = value.slug
        case .local(let url):
            template = nil
            slug = try await SlopPreparation.run { try SlopPackage(rootURL: url).manifest.slug }
        case .recent: return nil
        }
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.slop]; panel.canCreateDirectories = true
        panel.directoryURL = FileManager.default.urls(for: .desktopDirectory, in: .userDomainMask)[0]; panel.nameFieldStringValue = "\(slug).slop"
        let response = await withCheckedContinuation { continuation in
            panel.begin { continuation.resume(returning: $0) }
        }
        guard response == .OK, let url = panel.url else { return nil }
        let factory = DocumentFactory(catalogURL: catalogURL, templatesRoot: templatesURL)
        if let template {
            _ = try await factory.create(from: template.remoteTemplate(), at: url)
            await SlopPreviewWriter.installExistingPreviewAsync(for: url)
            try? await SlopCloudAPI(origin: catalogURL).recordCreation(templateId: template.id)
        } else if case .local(let source) = entry.source {
            try await factory.createLocal(from: source, at: url)
            await SlopPreviewWriter.installExistingPreviewAsync(for: url)
        }
        NSDocumentController.shared.noteNewRecentDocumentURL(url)
        return url.standardizedFileURL.resolvingSymlinksInPath()
    }

    private static func creationKey(_ template: SlopCatalogTemplate) -> String { "\(template.id)@\(template.release.number)" }

    private func hostedEntry(_ template: SlopCatalogTemplate) -> CatalogEntry {
        var entry = CatalogEntry(id: "hosted:\(template.id)", source: .hosted(Self.creationKey(template)), title: template.title)
        entry.description = template.description
        let known = Set(SlopCategory.allCases.map(\.rawValue))
        var seen = Set<String>()
        entry.categories = template.categories.map { known.contains($0.rawValue) ? $0.rawValue : "other" }.filter { seen.insert($0).inserted }
        entry.authorName = template.author.name
        entry.authorURL = template.author.url.flatMap(URL.init(string:))
        entry.packageBytes = Int64(template.download.bytes)
        entry.releaseNumber = template.release.number
        entry.creationCount = template.creationCount
        if let preview = URL(string: template.preview.url), let icon = URL(string: template.icon.url) {
            entry.iconURLs = [icon, preview]
            entry.previewURLs = [preview, icon]
        }
        return entry
    }

    static func localEntry(_ template: LocalTemplate) -> CatalogEntry {
        var entry = CatalogEntry(id: "local:\(template.manifest.slug)", source: .local(template.packageURL), title: template.manifest.title)
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

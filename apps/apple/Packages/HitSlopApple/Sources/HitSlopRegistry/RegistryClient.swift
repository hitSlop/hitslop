import Combine
import FirebaseFirestore
import FirebaseFunctions
import Foundation
import HitSlopCore
import HitSlopFirebase

public struct RegistryAsset: Decodable, Sendable {
    public let key: String
    public let sha256: String
    public let bytes: Int
}

public struct RegistryRelease: Decodable, Sendable {
    public let id: String
    public let number: Int
    public let publishedAt: Date
    public let artifact: RegistryAsset
    public let preview: RegistryAsset
    public let icon: RegistryAsset
    public let manifestJSON: String
}

public struct RegistryTemplate: Decodable, Identifiable, Sendable {
    public let id: String
    public let publisherKeyId: String
    public let slug: String
    public let title: String
    public let description: String
    public let categories: [String]
    public let authorName: String
    public let authorURL: String?
    public let currentRelease: RegistryRelease
    public let creationCount: Int
    public let firstPublishedAt: Date
    public let visibility: String
    public let searchText: String

    public var currentManifest: SlopManifest? {
        guard let data = currentRelease.manifestJSON.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(SlopManifest.self, from: data)
    }

    public func remoteTemplate() -> SlopRemoteTemplate {
        SlopRemoteTemplate(
            publisherKeyID: publisherKeyId,
            slug: slug,
            release: currentRelease.number,
            artifactKey: currentRelease.artifact.key,
            artifactSha256: currentRelease.artifact.sha256
        )
    }
}

public enum RegistrySort: String, CaseIterable, Identifiable, Sendable {
    case popular
    case new

    public var id: String { rawValue }
    public var title: String { self == .popular ? "Popular" : "New" }
}

@MainActor public final class RegistryModel: ObservableObject {
    @Published public private(set) var templates: [RegistryTemplate] = []
    @Published public private(set) var errorMessage: String?
    public let catalogURL: URL

    private let firestore: Firestore
    private let functions: Functions
    private var listener: ListenerRegistration?
    private var catalog: [RegistryTemplate] = []
    private var term = ""
    private var category: String?
    private var sort: RegistrySort = .popular

    public init(catalogURL: URL) {
        self.catalogURL = HitSlopFirebase.catalogURL(default: catalogURL)
        firestore = Firestore.firestore()
        functions = Functions.functions(region: "us-central1")
        if HitSlopFirebase.usesEmulators {
        firestore.useEmulator(withHost: "127.0.0.1", port: 8080)
        let settings = firestore.settings
        settings.cacheSettings = MemoryCacheSettings()
        settings.isSSLEnabled = false
        firestore.settings = settings
        functions.useEmulator(withHost: "127.0.0.1", port: 5001)
        }
        subscribe()
    }

    public func search(_ term: String, category: String? = nil) {
        let categoryChanged = self.category != category
        self.term = term.trimmingCharacters(in: .whitespacesAndNewlines).localizedLowercase
        self.category = category
        if categoryChanged { subscribe() } else { applyFilters() }
    }

    public func list(category: String? = nil, sort: RegistrySort = .popular) {
        term = ""
        let queryChanged = self.category != category || self.sort != sort
        self.category = category
        self.sort = sort
        if queryChanged { subscribe() } else { applyFilters() }
    }

    public func recordCreation(template: RegistryTemplate) async {
        do {
            _ = try await functions.httpsCallable("recordCreation").call(["templateId": template.id])
            HitSlopFirebase.log("template_created", parameters: ["template_slug": template.slug])
        } catch {
            HitSlopFirebase.record(error)
        }
    }

    private func subscribe() {
        listener?.remove()
        var query: Query = firestore.collection("templates")
            .whereField("visibility", isEqualTo: "public")
        if let category {
            query = query.whereField("categories", arrayContains: category)
        }
        switch sort {
        case .popular:
            query = query
                .order(by: "creationCount", descending: true)
                .order(by: "firstPublishedAt", descending: true)
        case .new:
            query = query.order(by: "firstPublishedAt", descending: true)
        }
        listener = query
            .limit(to: 200)
            .addSnapshotListener { [weak self] snapshot, error in
                Task { @MainActor in
                    guard let self else { return }
                    if let error {
                        self.errorMessage = error.localizedDescription
                        HitSlopFirebase.record(error)
                        HitSlopFirebase.log("catalog_load_failed")
                        return
                    }
                    var invalidCount = 0
                    self.catalog = (snapshot?.documents ?? []).compactMap { document in
                        do { return try document.data(as: RegistryTemplate.self) }
                        catch {
                            invalidCount += 1
                            HitSlopFirebase.record(error)
                            return nil
                        }
                    }
                    self.errorMessage = invalidCount == 0 ? nil : "Skipped \(invalidCount) invalid catalog entries."
                    self.applyFilters()
                    HitSlopFirebase.log("catalog_loaded", parameters: ["template_count": self.catalog.count, "catalog_sort": self.sort.rawValue])
                }
            }
    }

    private func applyFilters() {
        templates = catalog.filter { template in
            term.isEmpty || template.searchText.localizedLowercase.contains(term)
        }
    }
}

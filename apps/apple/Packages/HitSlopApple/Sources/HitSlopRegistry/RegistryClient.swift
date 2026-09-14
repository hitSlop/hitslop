import Combine
import FirebaseFirestore
import FirebaseFunctions
import Foundation
import HitSlopCore
import HitSlopFirebase

extension RegistryTemplate: Identifiable {
    public var searchText: String {
        ([title, description, authorName] + categories).joined(separator: " ").localizedLowercase
    }

    public var currentManifest: SlopManifest? {
        guard let data = currentRelease.manifestJSON.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(SlopManifest.self, from: data)
    }

    public func remoteTemplate() -> SlopRemoteTemplate {
        SlopRemoteTemplate(
            publisherKeyID: publisherKeyID,
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
    private var catalog: [(template: RegistryTemplate, searchText: String)] = []
    private var snapshotSink: ((RegistrySnapshot) -> Void)?
    private var generation = 0
    private var term = ""
    private var category: String?
    private var sort: RegistrySort = .popular

    public init(catalogURL: URL, subscribeImmediately: Bool = true) {
        self.catalogURL = HitSlopFirebase.catalogURL(default: catalogURL)
        firestore = Self.sharedFirestore
        functions = Self.sharedFunctions
        if subscribeImmediately { subscribe() }
    }

    private static let sharedFirestore: Firestore = {
        let firestore = Firestore.firestore()
        if HitSlopFirebase.usesEmulators {
            firestore.useEmulator(withHost: "127.0.0.1", port: 8080)
            let settings = firestore.settings
            settings.cacheSettings = MemoryCacheSettings()
            settings.isSSLEnabled = false
            firestore.settings = settings
        }
        return firestore
    }()
    private static let sharedFunctions: Functions = {
        let functions = Functions.functions(region: "us-central1")
        if HitSlopFirebase.usesEmulators { functions.useEmulator(withHost: "127.0.0.1", port: 5001) }
        return functions
    }()

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
        if queryChanged || listener == nil { subscribe() } else { applyFilters() }
    }

    public func recordCreation(template: RegistryTemplate) async {
        do {
            _ = try await functions.httpsCallable("recordCreation").call(["templateId": template.id])
            HitSlopFirebase.log("template_created", parameters: ["template_slug": template.slug])
        } catch {
            HitSlopFirebase.record(error)
        }
    }

    public func snapshots(category: String? = nil, sort: RegistrySort = .popular) -> AsyncStream<RegistrySnapshot> {
        AsyncStream(bufferingPolicy: .bufferingNewest(1)) { continuation in
            snapshotSink = { continuation.yield($0) }
            continuation.onTermination = { [self] _ in Task { @MainActor in self.stop() } }
            list(category: category, sort: sort)
        }
    }

    public func stop() {
        generation += 1
        listener?.remove(); listener = nil; snapshotSink = nil
    }

    private func subscribe() {
        generation += 1
        let requestedGeneration = generation
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
                    guard let self, self.generation == requestedGeneration else { return }
                    if let error {
                        self.errorMessage = error.localizedDescription
                        HitSlopFirebase.record(error)
                        self.snapshotSink?(RegistrySnapshot(templates: self.templates, errorMessage: self.errorMessage))
                        HitSlopFirebase.log("catalog_load_failed")
                        return
                    }
                    var invalidCount = 0
                    self.catalog = (snapshot?.documents ?? []).compactMap { document in
                        do {
                            let template = try document.data(as: RegistryTemplate.self)
                            guard template.id == document.documentID else {
                                throw DecodingError.dataCorrupted(.init(codingPath: [], debugDescription: "Registry template id does not match document id"))
                            }
                            return (template: template, searchText: template.searchText)
                        }
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
        templates = catalog.filter { term.isEmpty || $0.searchText.contains(term) }.map(\.template)
        snapshotSink?(RegistrySnapshot(templates: templates, errorMessage: errorMessage))
    }
}

public struct RegistrySnapshot: Sendable {
    public let templates: [RegistryTemplate]
    public let errorMessage: String?
}

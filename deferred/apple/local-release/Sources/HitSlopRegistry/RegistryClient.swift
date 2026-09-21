import Combine
import Foundation
import HitSlopRuntime

public typealias RegistryTemplate = SlopCatalogTemplate

extension RegistryTemplate: Identifiable {}

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
    private let api: SlopCloudAPI
    private var loadTask: Task<Void, Never>?
    private var catalog: [RegistryTemplate] = []
    private var term = ""
    private var category: String?
    private var sort: RegistrySort = .popular

    public init(catalogURL: URL) {
        self.catalogURL = catalogURL
        self.api = SlopCloudAPI(origin: catalogURL)
        refresh()
    }

    deinit { loadTask?.cancel() }

    public func refresh() {
        loadTask?.cancel()
        loadTask = Task { [weak self, api] in
            do {
                let templates = try await api.catalog()
                try Task.checkCancellation()
                guard let self else { return }
                catalog = templates
                errorMessage = nil
                applyFilters()
            } catch {
                guard !Task.isCancelled else { return }
                self?.errorMessage = error.localizedDescription
            }
        }
    }

    public func search(_ term: String, category: String? = nil) {
        self.term = term.trimmingCharacters(in: .whitespacesAndNewlines).localizedLowercase
        self.category = category
        applyFilters()
    }

    public func list(category: String? = nil, sort: RegistrySort = .popular) {
        term = ""
        self.category = category
        self.sort = sort
        applyFilters()
    }

    public func recordCreation(template: RegistryTemplate) async {
        try? await api.recordCreation(templateId: template.id)
    }

    private func applyFilters() {
        templates = catalog.filter { template in
            (term.isEmpty || template.searchText.contains(term)) &&
            (category == nil || template.categories.contains { $0.rawValue == category })
        }.sorted {
            if sort == .popular, $0.creationCount != $1.creationCount { return $0.creationCount > $1.creationCount }
            if $0.release.publishedAt != $1.release.publishedAt { return $0.release.publishedAt > $1.release.publishedAt }
            return $0.id < $1.id
        }
    }
}

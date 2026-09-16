import ComposableArchitecture
import Foundation

public enum CatalogFilter: Hashable, Sendable {
    case all, myTemplates, recents, category(String)
    public var title: String {
        switch self {
        case .all: "All Slops"
        case .myTemplates: "Mine"
        case .recents: "Recents"
        case .category(let id): id == "developer-tools" ? "Developer Tools" : id.capitalized
        }
    }
    public var category: String? { if case .category(let id) = self { id } else { nil } }
    public var isHosted: Bool { switch self { case .all, .category: true; default: false } }
}

public enum CatalogSort: String, CaseIterable, Identifiable, Sendable {
    case popular, new
    public var id: String { rawValue }
    public var title: String { self == .popular ? "Popular" : "New" }
}

/// Display and creation metadata only; no package reads occur when rendering a view.
public struct CatalogEntry: Equatable, Identifiable, Sendable {
    public enum Source: Equatable, Sendable { case hosted(String), local(URL), recent(URL) }
    public var id: String
    public var source: Source
    public var title: String
    public var description = ""
    public var categories: [String] = []
    public var authorName: String?
    public var authorURL: URL?
    public var iconURLs: [URL] = []
    public var previewURLs: [URL] = []
    public var packageBytes: Int64 = 0
    public var createdAt: Date?
    public var updatedAt: Date?
    public var releaseNumber: Int?
    public var creationCount: Int?
    public var initialSize: String?
    public init(id: String, source: Source, title: String) { self.id = id; self.source = source; self.title = title }
    public var isRecent: Bool { if case .recent = source { true } else { false } }
    public var isLocal: Bool { if case .hosted = source { false } else { true } }
    public var searchableText: String { ([title, description, authorName ?? ""] + categories).joined(separator: " ").localizedLowercase }
}

public struct CatalogSnapshot: Equatable, Sendable {
    public var entries: [CatalogEntry]
    public var issues: [String]
    public init(entries: [CatalogEntry] = [], issues: [String] = []) { self.entries = entries; self.issues = issues }
}

@DependencyClient
public struct CatalogClient: Sendable {
    public var hosted: @Sendable (String?, CatalogSort) async -> AsyncStream<CatalogSnapshot> = { _, _ in .finished }
    public var local: @Sendable () async -> AsyncStream<CatalogSnapshot> = { .finished }
    public var refreshLocal: @Sendable () async -> Void
    public var recents: @Sendable () async -> [CatalogEntry] = { [] }
    /// Returns nil when the destination picker is cancelled. Records successful hosted creations internally.
    public var create: @Sendable (CatalogEntry) async throws -> URL?

}
extension CatalogClient: DependencyKey {
    public static let liveValue = Self(
        hosted: { _, _ in preconditionFailure("Install CatalogClient at the application root") },
        local: { preconditionFailure("Install CatalogClient at the application root") },
        refreshLocal: { preconditionFailure("Install CatalogClient at the application root") },
        recents: { preconditionFailure("Install CatalogClient at the application root") },
        create: { _ in preconditionFailure("Install CatalogClient at the application root") }
    )
    public static let testValue = Self()
    /// Explicit fixture for native integration tests that do not display a catalog.
    public static let empty = Self(
        hosted: { _, _ in .finished }, local: { .finished }, refreshLocal: {},
        recents: { [] }, create: { _ in nil }
    )
}
public extension DependencyValues {
    var catalogClient: CatalogClient { get { self[CatalogClient.self] } set { self[CatalogClient.self] = newValue } }
}

@Reducer public struct CatalogFeature: Sendable {
    @ObservableState public struct State: Equatable {
        public var query = ""
        public var searchTerm = ""
        public var filter: CatalogFilter = .all
        public var sort: CatalogSort = .popular
        public var selectedID: String?
        public var hosted: [CatalogEntry] = []
        public var local: [CatalogEntry] = []
        public var recents: [CatalogEntry] = []
        public var hostedIssues: [String] = []
        public var localIssues: [String] = []
        public var isLoading = false
        public var isStarted = false
        public var creating: CatalogEntry?
        @Presents public var alert: AlertState<ErrorAlertAction>?
        public var isQuitting = false
        public var subscription = 0
        public var recentsGeneration = 0
        public init() {}
        public var visibleEntries: [CatalogEntry] {
            let items = switch filter { case .all, .category: hosted; case .myTemplates: local; case .recents: recents }
            return searchTerm.isEmpty ? items : items.filter { $0.searchableText.contains(searchTerm) }
        }
        public var selectedEntry: CatalogEntry? { visibleEntries.first { $0.id == selectedID } }
        mutating func synchronizeSelection() {
            if let selectedID, visibleEntries.contains(where: { $0.id == selectedID }) { return }
            selectedID = visibleEntries.first?.id
        }
    }
    public enum Action {
        case start, refreshRecents, refreshSources
        case queryChanged(String), searchDebounced(String), filterChanged(CatalogFilter), sortChanged(CatalogSort), selected(String?)
        case hostedReceived(Int, CatalogSnapshot), localReceived(CatalogSnapshot), recentsReceived(Int, [CatalogEntry])
        case primaryAction(CatalogEntry), creationFinished(URL?), creationFailed(String)
        case alert(PresentationAction<ErrorAlertAction>)
        case openDocument(URL)
    }
    private enum CancelID { case search, hosted, local, recents, refreshLocal }
    @Dependency(\.catalogClient) var client
    @Dependency(\.continuousClock) var clock
    public init() {}
    public var body: some ReducerOf<Self> {
        Reduce { state, action in
            switch action {
            case .start:
                guard !state.isStarted else { return .none }
                state.isStarted = true
                return .merge(subscribe(&state), .run { send in
                    for await snapshot in await client.local() { await send(.localReceived(snapshot)) }
                }.cancellable(id: CancelID.local), recents(&state))
            case .refreshSources:
                guard state.isStarted else { return .none }
                return .merge(recents(&state), subscribe(&state), .run { _ in
                    await client.refreshLocal()
                }.cancellable(id: CancelID.refreshLocal, cancelInFlight: true))
            case .refreshRecents: return recents(&state)
            case .queryChanged(let query):
                guard state.query != query else { return .none }
                state.query = query
                if query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    state.searchTerm = ""
                    state.synchronizeSelection()
                    return .cancel(id: CancelID.search)
                }
                return .run { send in
                    try await clock.sleep(for: .milliseconds(180))
                    await send(.searchDebounced(query))
                }.cancellable(id: CancelID.search, cancelInFlight: true)
            case .searchDebounced(let query):
                guard state.query == query else { return .none }
                state.searchTerm = query.trimmingCharacters(in: .whitespacesAndNewlines).localizedLowercase
                state.synchronizeSelection()
                return .none
            case .filterChanged(let filter):
                guard state.filter != filter else { return .none }
                if filter.isHosted {
                    state.hosted = []
                    state.hostedIssues = []
                }
                state.filter = filter
                state.searchTerm = state.query.trimmingCharacters(in: .whitespacesAndNewlines).localizedLowercase
                state.selectedID = nil
                state.synchronizeSelection()
                return .merge(.cancel(id: CancelID.search), subscribe(&state))
            case .sortChanged(let sort):
                guard state.sort != sort else { return .none }
                state.sort = sort
                return subscribe(&state)
            case .selected(let id): state.selectedID = id; return .none
            case .hostedReceived(let generation, let snapshot):
                guard generation == state.subscription else { return .none }
                state.isLoading = false
                state.hosted = snapshot.entries; state.hostedIssues = snapshot.issues
                state.synchronizeSelection(); return .none
            case .localReceived(let snapshot):
                state.local = snapshot.entries; state.localIssues = snapshot.issues
                state.synchronizeSelection(); return .none
            case .recentsReceived(let generation, let entries):
                guard generation == state.recentsGeneration else { return .none }
                state.recents = entries; state.synchronizeSelection(); return .none
            case .primaryAction(let entry):
                guard !state.isQuitting, state.creating == nil else { return .none }
                if case .recent(let url) = entry.source { return .send(.openDocument(url)) }
                state.creating = entry
                return .run { send in
                    do { await send(.creationFinished(try await client.create(entry))) }
                    catch { await send(.creationFailed(error.localizedDescription)) }
                }
            case .creationFinished:
                state.creating = nil
                return recents(&state)
            case .creationFailed(let message): state.creating = nil; state.alert = .operationFailure(message, title: "Could not create slop"); return .none
            case .alert: return .none
            case .openDocument: return .none
            }
        }
        .ifLet(\.$alert, action: \.alert)
    }
    private func recents(_ state: inout State) -> Effect<Action> {
        state.recentsGeneration += 1
        let generation = state.recentsGeneration
        return .run { send in await send(.recentsReceived(generation, await client.recents())) }.cancellable(id: CancelID.recents, cancelInFlight: true)
    }
    private func subscribe(_ state: inout State) -> Effect<Action> {
        state.subscription += 1
        guard state.filter.isHosted else { state.isLoading = false; return .cancel(id: CancelID.hosted) }
        state.isLoading = true
        let generation = state.subscription, category = state.filter.category, sort = state.sort
        return .run { send in
            for await snapshot in await client.hosted(category, sort) { await send(.hostedReceived(generation, snapshot)) }
        }.cancellable(id: CancelID.hosted, cancelInFlight: true)
    }
}

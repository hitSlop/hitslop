import ComposableArchitecture
import Foundation

@Reducer public struct AppFeature: Sendable {
    public enum QuitPhase: Equatable, Sendable { case running, waiting, preparing, finished }
    @ObservableState public struct State: Equatable {
        public var catalog = CatalogFeature.State()
        public var account = AccountFeature.State()
        public var documents: IdentifiedArrayOf<DocumentFeature.State> = []
        public var activeDocumentID: UUID?
        public var quitPhase: QuitPhase = .running
        @Presents public var alert: AlertState<ErrorAlertAction>?
        public init() {}
    }
    public enum Action {
        case account(AccountFeature.Action)
        case catalog(CatalogFeature.Action)
        case documents(IdentifiedActionOf<DocumentFeature>)
        /// Caller resolves symlinks before dispatching; the reducer performs no filesystem access.
        case openDocument(URL)
        case openFinished(UUID, String), openFailed(UUID, String)
        case focused(UUID?)
        case quitRequested, quitFinished, quitFailed(String), externalFailure(String)
        case alert(PresentationAction<ErrorAlertAction>)
    }
    @Dependency(\.documentClient) var client
    @Dependency(\.uuid) var uuid
    public init() {}
    public var body: some ReducerOf<Self> {
        Scope(state: \.account, action: \.account) { AccountFeature() }
        Scope(state: \.catalog, action: \.catalog) { CatalogFeature() }
        Reduce { state, action in
            var effect: Effect<Action> = .none
            switch action {
            case .openDocument(let url), .catalog(.openDocument(let url)):
                guard state.quitPhase == .running else { return .none }
                effect = open(url, state: &state)
            case .catalog(.creationFinished(let url)):
                // Insert the document before advancing quit so a completed creation cannot be missed.
                if let url { effect = open(url, state: &state) }
            case .openFinished(let id, let title):
                guard state.documents[id: id] != nil else { return .none }
                state.documents[id: id]?.isOpening = false
                state.documents[id: id]?.title = title
                effect = .send(.catalog(.refreshRecents))
            case .openFailed(let id, let message):
                guard state.documents.remove(id: id) != nil else { return .none }
                state.alert = .operationFailure(message)
            case .focused(let id): state.activeDocumentID = id.flatMap { state.documents[id: $0] == nil ? nil : $0 }
            case .documents(.element(let id, .operationFinished(.close, _))):
                state.documents.remove(id: id)
                if state.activeDocumentID == id { state.activeDocumentID = nil }
            case .documents(.element(_, .operationFinished(.duplicate, let url))):
                if let url { effect = open(url, state: &state) }
            case .documents(.element(let id, .operationFailed(.close, let message))):
                if state.quitPhase == .waiting {
                    state.documents[id: id]?.alert = nil
                    return cancelQuit(&state, message: message)
                }
            case .quitRequested:
                guard state.quitPhase == .running else { return .none }
                state.quitPhase = .waiting
                state.catalog.isQuitting = true
                for id in state.documents.ids { state.documents[id: id]?.isQuitting = true }
            case .quitFinished:
                state.quitPhase = .finished
                return .run { _ in await client.replyToQuit(true) }
            case .quitFailed(let message): return cancelQuit(&state, message: message)
            case .externalFailure(let message): state.alert = .operationFailure(message)
            case .alert: break
            case .account, .catalog, .documents: break
            }
            return .merge(effect, advanceQuit(&state))
        }
        .ifLet(\.$alert, action: \.alert)
        .forEach(\.documents, action: \.documents) { DocumentFeature() }
    }
    private func open(_ url: URL, state: inout State) -> Effect<Action> {
        if let existing = state.documents.first(where: { $0.url == url }) {
            guard !existing.isOpening else { return .none }
            let id = existing.id
            return .run { _ in await client.focus(id) }
        }
        let id = uuid()
        var document = DocumentFeature.State(id: id, url: url)
        document.isQuitting = state.quitPhase != .running
        state.documents.append(document)
        return .run { send in
            do { await send(.openFinished(id, try await client.open(id, url))) }
            catch { await send(.openFailed(id, error.localizedDescription)) }
        }
    }
    private func advanceQuit(_ state: inout State) -> Effect<Action> {
        guard state.quitPhase == .waiting, state.catalog.creating == nil,
              state.documents.allSatisfy({ !$0.isOpening && $0.operation == nil && !$0.closeRequested }) else { return .none }
        state.quitPhase = .preparing
        let ids = Array(state.documents.ids)
        return .run { send in
            do {
                for id in ids { try await client.prepareToQuit(id) }
                await client.finishAssetRefreshes()
                await send(.quitFinished)
            } catch { await send(.quitFailed(error.localizedDescription)) }
        }
    }
    private func cancelQuit(_ state: inout State, message: String) -> Effect<Action> {
        state.quitPhase = .running; state.alert = .operationFailure(message); state.catalog.isQuitting = false
        for id in state.documents.ids { state.documents[id: id]?.isQuitting = false }
        return .run { _ in await client.replyToQuit(false) }
    }
}

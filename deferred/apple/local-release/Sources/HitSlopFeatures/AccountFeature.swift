import ComposableArchitecture
import Foundation

public struct AccountUser: Equatable, Sendable {
    public var id: String
    public var name: String?
    public var email: String?
    public var photoURL: URL?
    public init(id: String, name: String?, email: String?, photoURL: URL? = nil) {
        self.id = id; self.name = name; self.email = email; self.photoURL = photoURL
    }
}

@DependencyClient public struct AccountClient: Sendable {
    public var sessions: @Sendable () async -> AsyncStream<AccountUser?> = { .finished }
    public var signIn: @Sendable () async throws -> Void
    public var signOut: @Sendable () async throws -> Void
}
extension AccountClient: DependencyKey {
    public static let liveValue = Self(
        sessions: { preconditionFailure("Install AccountClient at the application root") },
        signIn: { preconditionFailure("Install AccountClient at the application root") },
        signOut: { preconditionFailure("Install AccountClient at the application root") }
    )
    public static let testValue = Self()
    public static let empty = Self(sessions: { .finished }, signIn: {}, signOut: {})
}
public extension DependencyValues {
    var accountClient: AccountClient { get { self[AccountClient.self] } set { self[AccountClient.self] = newValue } }
}

@Reducer public struct AccountFeature: Sendable {
    @ObservableState public struct State: Equatable {
        public var user: AccountUser?
        public var isRestoring = true
        public var isWorking = false
        public var error: String?
        public var isStarted = false
        public init() {}
    }
    public enum Action {
        case start, sessionChanged(AccountUser?), signIn, signOut, finished, failed(String)
    }
    @Dependency(\.accountClient) var client
    public init() {}
    public var body: some ReducerOf<Self> {
        Reduce { state, action in
            switch action {
            case .start:
                guard !state.isStarted else { return .none }
                state.isStarted = true
                return .run { send in
                    for await user in await client.sessions() { await send(.sessionChanged(user)) }
                }
            case .sessionChanged(let user):
                state.user = user; state.isRestoring = false
                return .none
            case .signIn:
                guard !state.isWorking, !state.isRestoring, state.user == nil else { return .none }
                state.isWorking = true; state.error = nil
                return .run { send in
                    do { try await client.signIn(); await send(.finished) }
                    catch is CancellationError { await send(.finished) }
                    catch { await send(.failed(error.localizedDescription)) }
                }
            case .signOut:
                guard !state.isWorking, state.user != nil else { return .none }
                state.isWorking = true; state.error = nil
                return .run { send in
                    do { try await client.signOut(); await send(.finished) }
                    catch { await send(.failed(error.localizedDescription)) }
                }
            case .finished: state.isWorking = false; return .none
            case .failed(let message): state.isWorking = false; state.error = message; return .none
            }
        }
    }
}

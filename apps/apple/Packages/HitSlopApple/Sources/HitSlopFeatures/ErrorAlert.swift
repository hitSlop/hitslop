import ComposableArchitecture
import HitSlopCore

public enum ErrorAlertAction: Equatable, Sendable { case checkForUpdates }

@DependencyClient public struct UpdateClient: Sendable {
    public var checkForUpdates: @Sendable () async -> Void
}
extension UpdateClient: DependencyKey {
    public static let liveValue = Self(checkForUpdates: { preconditionFailure("Install UpdateClient at the application root") })
    public static let testValue = Self()
}
public extension DependencyValues {
    var updateClient: UpdateClient { get { self[UpdateClient.self] } set { self[UpdateClient.self] = newValue } }
}

public extension AlertState where Action == ErrorAlertAction {
    static func unsupportedRuntime(_ error: SlopRuntimeCompatibilityError) -> Self {
        Self { TextState("Update hitSlop to open this document") } actions: {
            ButtonState(action: .checkForUpdates) { TextState("Check for Updates…") }
            ButtonState(role: .cancel) { TextState("Cancel") }
        } message: { TextState(error.localizedDescription) }
    }
    static func operationFailure(_ message: String, title: String = "Could not complete operation") -> Self {
        Self {
            TextState(title)
        } actions: {
            ButtonState(role: .cancel) { TextState("OK") }
        } message: {
            TextState(message)
        }
    }
}

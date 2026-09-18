import ComposableArchitecture

public enum ErrorAlertAction: Equatable, Sendable {}

public extension AlertState where Action == ErrorAlertAction {
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

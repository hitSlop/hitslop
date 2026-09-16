import Foundation

public struct SlopRuntimeCompatibilityError: LocalizedError, Equatable, Sendable {
    public let required: String
    public let available: [String]
    public init(required: String, available: [String]) { self.required = required; self.available = available }
    public var errorDescription: String? {
        "This version of hitSlop cannot open this document. It requires runtime \(required) or a newer compatible release. Installed runtimes: \(available.isEmpty ? "none" : available.joined(separator: ", ")). Check for a hitSlop update."
    }
}

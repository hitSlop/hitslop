import Foundation

/// A guest diagnostic. It never changes document authority or durability state.
public struct SlopRuntimeIssue: Decodable, Sendable {
    public enum Source: String, Decodable, Sendable {
        case document, media, render, unhandled
    }
    public let source: Source
    public let code: String?
    public let message: String
    public init(source: Source, code: String? = nil, message: String) { self.source = source; self.code = code; self.message = message }
}

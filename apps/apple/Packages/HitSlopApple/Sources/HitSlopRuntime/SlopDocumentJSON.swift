import Foundation
import Loro
import HitSlopCore

public struct SlopDocumentError: LocalizedError, Sendable {
    public let message: String
    let limitMessage: String?
    public init(_ message: String) { self.message = message; limitMessage = nil }
    init(limit: SlopLimitError) { message = limit.message; limitMessage = limit.message }
    public var errorDescription: String? { message }
}

/// JSON projection values, deliberately independent of a particular slop model.
public enum SlopDocumentJSON: Codable, Equatable, Sendable {
    case null, bool(Bool), number(Double), string(String), array([SlopDocumentJSON]), object([String: SlopDocumentJSON])

    public init(from decoder: any Decoder) throws {
        guard decoder.codingPath.count <= SlopJSONLimits.maximumDepth else { throw SlopLimitError("JSON exceeds 64 nesting levels") }
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let v = try? c.decode(Bool.self) { self = .bool(v) }
        else if let v = try? c.decode(Double.self), v.isFinite { self = .number(v) }
        else if let v = try? c.decode(String.self) { self = .string(v) }
        else if let v = try? c.decode([SlopDocumentJSON].self) { self = .array(v) }
        else { self = .object(try c.decode([String: SlopDocumentJSON].self)) }
    }
    public func encode(to encoder: any Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .null: try c.encodeNil()
        case .bool(let v): try c.encode(v)
        case .number(let v): try c.encode(v)
        case .string(let v): try c.encode(v)
        case .array(let v): try c.encode(v)
        case .object(let v): try c.encode(v)
        }
    }
    public init(data: Data) throws {
        try SlopJSONLimits.check(data, maximumBytes: SlopFile.maximumBytes)
        self = try JSONDecoder().decode(Self.self, from: data)
    }
    public func validateBounds(maximumBytes: Int = SlopJSONLimits.documentBytes) throws {
        var bytes = 0
        func walk(_ value: Self, depth: Int) throws {
            guard depth <= SlopJSONLimits.maximumDepth else { throw SlopLimitError("Document exceeds 64 nesting levels") }
            switch value {
            case .string(let value): bytes += value.utf8.count + 2
            case .object(let value):
                bytes += 2
                for (key, child) in value { bytes += key.utf8.count + 4; try walk(child, depth: depth + 1) }
            case .array(let value):
                bytes += 2
                for child in value { bytes += 1; try walk(child, depth: depth + 1) }
            default: bytes += 1
            }
            guard bytes <= maximumBytes else { throw SlopLimitError("JSON exceeds \(SlopJSONLimits.byteLimitLabel(maximumBytes)); reduce the size of the edit") }
        }
        try walk(self, depth: 0)
    }
    public func encoded() throws -> Data {
        try validateBounds(maximumBytes: SlopFile.maximumBytes)
        let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return try encoder.encode(self)
    }
    public var object: [String: SlopDocumentJSON] { if case .object(let v) = self { v } else { [:] } }
    public var array: [SlopDocumentJSON] { if case .array(let v) = self { v } else { [] } }
    public var string: String? { if case .string(let v) = self { v } else { nil } }
    public var number: Double? { if case .number(let v) = self { v } else { nil } }
    public subscript(_ key: String) -> SlopDocumentJSON {
        get { object[key] ?? .null }
        set { var v = object; v[key] = newValue; self = .object(v) }
    }
    public var loro: LoroValue {
        switch self {
        case .null: .null
        case .bool(let v): .bool(value: v)
        case .number(let v): .double(value: v)
        case .string(let v): .string(value: v)
        case .array(let v): .list(value: v.map(\.loro))
        case .object(let v): .map(value: v.mapValues(\.loro))
        }
    }
    public init(loro: LoroValue) throws {
        self = try Self(loro: loro, depth: 0)
        try validateBounds()
    }
    private init(loro: LoroValue, depth: Int) throws {
        guard depth <= SlopJSONLimits.maximumDepth else { throw SlopLimitError("Document exceeds 64 nesting levels") }
        switch loro {
        case .null: self = .null
        case .bool(let v): self = .bool(v)
        case .i64(let v):
            guard abs(Double(v)) <= 9_007_199_254_740_991 else { throw SlopDocumentError("Integer exceeds JavaScript's exact range") }
            self = .number(Double(v))
        case .double(let v):
            guard v.isFinite else { throw SlopDocumentError("Non-finite JSON number") }; self = .number(v)
        case .string(let v): self = .string(v)
        case .list(let v): self = .array(try v.map { try Self(loro: $0, depth: depth + 1) })
        case .map(let v): self = .object(try v.mapValues { try Self(loro: $0, depth: depth + 1) })
        case .binary, .container: throw SlopDocumentError("Expected a plain JSON projection")
        }
    }
}

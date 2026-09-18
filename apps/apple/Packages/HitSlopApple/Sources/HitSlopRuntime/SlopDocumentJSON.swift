import CoreFoundation
import Foundation
import HitSlopCore

public struct SlopDocumentError: LocalizedError, Sendable {
    public let message: String
    let limitMessage: String?
    public init(_ message: String) {
        self.message = message
        limitMessage = nil
    }
    init(limit: SlopLimitError) {
        message = limit.message
        limitMessage = limit.message
    }
    public var errorDescription: String? { message }
}

/// JSON projection values, deliberately independent of a particular slop model.
public enum SlopDocumentJSON: Codable, Equatable, Sendable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([SlopDocumentJSON])
    case object([String: SlopDocumentJSON])

    // JavaScript compares strings by their exact encoding, not Unicode canonical equivalence.
    public static func == (lhs: Self, rhs: Self) -> Bool {
        switch (lhs, rhs) {
        case (.null, .null): return true
        case (.bool(let a), .bool(let b)): return a == b
        case (.number(let a), .number(let b)): return a == b
        case (.string(let a), .string(let b)): return a.utf8.elementsEqual(b.utf8)
        case (.array(let a), .array(let b)): return a == b
        case (.object(let a), .object(let b)):
            guard a.count == b.count else { return false }
            return a.allSatisfy { key, value in
                guard let index = b.index(forKey: key), key.utf8.elementsEqual(b[index].key.utf8) else { return false }
                return value == b[index].value
            }
        default: return false
        }
    }

    public init(from decoder: any Decoder) throws {
        guard decoder.codingPath.count <= SlopJSONLimits.framedDepth else {
            throw SlopLimitError("JSON exceeds \(SlopJSONLimits.framedDepth) nesting levels")
        }
        let c = try decoder.singleValueContainer()
        if c.decodeNil() {
            self = .null
        } else if let v = try? c.decode(Bool.self) {
            self = .bool(v)
        } else if let v = try? c.decode(Double.self), v.isFinite {
            self = .number(v)
        } else if let v = try? c.decode(String.self) {
            self = .string(v)
        } else if let v = try? c.decode([SlopDocumentJSON].self) {
            self = .array(v)
        } else {
            self = .object(try c.decode([String: SlopDocumentJSON].self))
        }
        switch self {
        case .array, .object:
            guard decoder.codingPath.count < SlopJSONLimits.framedDepth else {
                throw SlopLimitError("JSON exceeds \(SlopJSONLimits.framedDepth) nesting levels")
            }
        default: break
        }
    }
    public func encode(to encoder: any Encoder) throws {
        let isContainer: Bool
        switch self { case .array, .object: isContainer = true; default: isContainer = false }
        guard encoder.codingPath.count + (isContainer ? 1 : 0) <= SlopJSONLimits.framedDepth else {
            throw SlopLimitError("JSON exceeds \(SlopJSONLimits.framedDepth) nesting levels")
        }
        var c = encoder.singleValueContainer()
        switch self {
        case .null: try c.encodeNil()
        case .bool(let v): try c.encode(v)
        case .number(let v): try c.encode(v == 0 ? 0 : v)
        case .string(let v): try c.encode(v)
        case .array(let v): try c.encode(v)
        case .object(let v): try c.encode(v)
        }
    }
    public init(data: Data, maximumBytes: Int = SlopFile.maximumBytes, maximumDepth: Int = SlopJSONLimits.framedDepth) throws {
        try SlopJSONLimits.check(data, maximumBytes: maximumBytes, maximumDepth: maximumDepth)
        self = try Self.foundation(JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed]))
    }
    /// Parse once. Trying each Codable scalar/container type throws repeatedly for every node.
    private static func foundation(_ value: Any) throws -> Self {
        if value is NSNull { return .null }
        if let number = value as? NSNumber {
            if CFGetTypeID(number) == CFBooleanGetTypeID() { return .bool(number.boolValue) }
            guard number.doubleValue.isFinite else { throw SlopDocumentError("Non-finite JSON number") }
            return .number(number.doubleValue)
        }
        if let string = value as? String { return .string(string) }
        if let array = value as? [Any] { return .array(try array.map(Self.foundation)) }
        if let object = value as? [String: Any] { return .object(try object.mapValues(Self.foundation)) }
        throw SlopDocumentError("Expected plain JSON")
    }
    /// Conservative preflight; encoded() enforces the exact UTF-8 byte budget.
    public func validateBounds(maximumBytes: Int = SlopJSONLimits.documentBytes, maximumDepth: Int = SlopJSONLimits.maximumDepth) throws {
        var bytes = 0
        func walk(_ value: Self, depth: Int) throws {
            switch value {
            case .string(let value): bytes += value.utf8.count + 2
            case .object(let value):
                guard depth < maximumDepth else { throw SlopLimitError("Document exceeds \(maximumDepth) nesting levels") }
                bytes += 2 + max(0, value.count - 1)
                for (key, child) in value {
                    bytes += key.utf8.count + 3
                    try walk(child, depth: depth + 1)
                }
            case .array(let value):
                guard depth < maximumDepth else { throw SlopLimitError("Document exceeds \(maximumDepth) nesting levels") }
                bytes += 2 + max(0, value.count - 1)
                for child in value {
                    try walk(child, depth: depth + 1)
                }
            default: bytes += 1
            }
            guard bytes <= maximumBytes else {
                throw SlopLimitError(
                    "JSON exceeds \(SlopJSONLimits.byteLimitLabel(maximumBytes)); reduce the size of the edit")
            }
        }
        try walk(self, depth: 0)
    }
    public func encoded(maximumBytes: Int = SlopFile.maximumBytes, maximumDepth: Int = SlopJSONLimits.framedDepth) throws -> Data {
        try validateBounds(maximumBytes: maximumBytes, maximumDepth: maximumDepth)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        let bytes = try encoder.encode(self)
        try SlopJSONLimits.check(bytes, maximumBytes: maximumBytes, maximumDepth: maximumDepth)
        return bytes
    }
    public func jsonValue() throws -> Any {
        switch self {
        case .null: NSNull()
        case .bool(let value): value
        case .number(let value): value
        case .string(let value): value
        case .array(let value): try value.map { try $0.jsonValue() }
        case .object(let value): try value.mapValues { try $0.jsonValue() }
        }
    }
    public var object: [String: SlopDocumentJSON] { if case .object(let v) = self { v } else { [:] } }
    public var array: [SlopDocumentJSON] { if case .array(let v) = self { v } else { [] } }
    public var string: String? { if case .string(let v) = self { v } else { nil } }
    public var number: Double? { if case .number(let v) = self { v } else { nil } }
    public subscript(_ key: String) -> SlopDocumentJSON {
        get { object[key] ?? .null }
        set {
            var v = object
            v[key] = newValue
            self = .object(v)
        }
    }
}

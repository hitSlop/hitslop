import Foundation
import Loro

package struct SpikeFailure: LocalizedError, Sendable {
    package let message: String
    package init(_ message: String) { self.message = message }
    package var errorDescription: String? { message }
}

/// JSON projection values, deliberately independent of a particular slop model.
package enum SpikeJSON: Codable, Equatable, Sendable {
    case null, bool(Bool), number(Double), string(String), array([SpikeJSON]), object([String: SpikeJSON])

    package init(from decoder: any Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let v = try? c.decode(Bool.self) { self = .bool(v) }
        else if let v = try? c.decode(Double.self), v.isFinite { self = .number(v) }
        else if let v = try? c.decode(String.self) { self = .string(v) }
        else if let v = try? c.decode([SpikeJSON].self) { self = .array(v) }
        else { self = .object(try c.decode([String: SpikeJSON].self)) }
    }
    package func encode(to encoder: any Encoder) throws {
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
    package init(data: Data) throws { self = try JSONDecoder().decode(Self.self, from: data) }
    package func encoded() throws -> Data {
        let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return try encoder.encode(self)
    }
    package var object: [String: SpikeJSON] { if case .object(let v) = self { v } else { [:] } }
    package var array: [SpikeJSON] { if case .array(let v) = self { v } else { [] } }
    package var string: String? { if case .string(let v) = self { v } else { nil } }
    package var number: Double? { if case .number(let v) = self { v } else { nil } }
    package subscript(_ key: String) -> SpikeJSON {
        get { object[key] ?? .null }
        set { var v = object; v[key] = newValue; self = .object(v) }
    }
    package var loro: LoroValue {
        switch self {
        case .null: .null
        case .bool(let v): .bool(value: v)
        case .number(let v): .double(value: v)
        case .string(let v): .string(value: v)
        case .array(let v): .list(value: v.map(\.loro))
        case .object(let v): .map(value: v.mapValues(\.loro))
        }
    }
    package init(loro: LoroValue) throws {
        switch loro {
        case .null: self = .null
        case .bool(let v): self = .bool(v)
        case .i64(let v):
            guard abs(Double(v)) <= 9_007_199_254_740_991 else { throw SpikeFailure("Integer exceeds JavaScript's exact range") }
            self = .number(Double(v))
        case .double(let v):
            guard v.isFinite else { throw SpikeFailure("Non-finite JSON number") }; self = .number(v)
        case .string(let v): self = .string(v)
        case .list(let v): self = .array(try v.map { try Self(loro: $0) })
        case .map(let v): self = .object(try v.mapValues { try Self(loro: $0) })
        case .binary, .container: throw SpikeFailure("Expected a plain JSON projection")
        }
    }
}

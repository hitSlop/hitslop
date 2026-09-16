import Foundation
import DynamicJSON
import HitSlopCore

package indirect enum SpikeMapping {
    case map([String: SpikeMapping]), record(SpikeMapping), list(String, SpikeMapping), text, atomic

    init(_ schema: SpikeJSON) throws {
        let meta = schema["x-hitslop"]
        switch meta["container"].string {
        case "atomic": self = .atomic
        case "text": self = .text
        case "map": self = .map(try schema["properties"].object.mapValues(Self.init))
        case "record":
            let patterns = schema["patternProperties"].object
            guard patterns.count == 1, let value = patterns["^.*$"] else { throw SpikeFailure("Unsupported record mapping") }
            self = .record(try Self(value))
        case "movable-list":
            guard let key = meta["key"].string, !key.isEmpty else { throw SpikeFailure("List requires a key") }
            self = .list(key, try Self(schema["items"]))
        case nil:
            if schema["type"].string == "object", !schema["properties"].object.isEmpty {
                self = .map(try schema["properties"].object.mapValues(Self.init))
            } else { self = .atomic }
        default: throw SpikeFailure("Unsupported x-hitslop container")
        }
    }

    func validateIDs(_ value: SpikeJSON) throws {
        switch self {
        case .map(let fields): for (key, node) in fields { try node.validateIDs(value[key]) }
        case .record(let node): for child in value.object.values { try node.validateIDs(child) }
        case .list(let key, let node):
            var seen = Set<String>()
            for child in value.array {
                guard let id = child[key].string, !id.isEmpty, seen.insert(id).inserted else { throw SpikeFailure("List IDs must be non-empty and unique") }
                try node.validateIDs(child)
            }
        case .atomic, .text: break
        }
    }
}

/// TypeBox's emitted document schema is read at open; no generated Swift models.
package final class SpikeSchema {
    package let source: SpikeJSON
    let mapping: SpikeMapping
    private let validator: JSONSchema

    package init(_ envelope: SpikeJSON) throws {
        source = envelope["x-hitslop"]["version"] == .number(1) ? envelope : envelope["properties"]["data"]
        guard source["x-hitslop"]["version"] == .number(1), source["x-hitslop"]["container"].string == "map" else {
            throw SpikeFailure("Expected an S.Document schema")
        }
        mapping = try SpikeMapping(source)
        validator = try JSONSchema(data: source.encoded())
    }
    package func validate(_ value: SpikeJSON) throws {
        let result = try JSON(data: value.encoded()).validate(with: validator, dialect: SlopJSONValidation.dialect)
        guard result.isValid else { throw SpikeFailure("Document failed JSON Schema validation: \(result)") }
        try mapping.validateIDs(value)
    }
}

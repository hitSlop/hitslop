import Foundation
import DynamicJSON
import HitSlopCore

public indirect enum SlopDocumentMapping {
    case map([String: SlopDocumentMapping]), record(SlopDocumentMapping), list(String, SlopDocumentMapping), text, atomic

    init(_ schema: SlopDocumentJSON) throws {
        let meta = schema["x-hitslop"]
        switch meta["container"].string {
        case "atomic": self = .atomic
        case "text": self = .text
        case "map": self = .map(try schema["properties"].object.mapValues(Self.init))
        case "record":
            let patterns = schema["patternProperties"].object
            guard patterns.count == 1, let value = patterns["^.*$"] else { throw SlopDocumentError("Unsupported record mapping") }
            self = .record(try Self(value))
        case "movable-list":
            guard let key = meta["key"].string, !key.isEmpty else { throw SlopDocumentError("List requires a key") }
            self = .list(key, try Self(schema["items"]))
        case nil:
            if schema["type"].string == "object", !schema["properties"].object.isEmpty {
                self = .map(try schema["properties"].object.mapValues(Self.init))
            } else { self = .atomic }
        default: throw SlopDocumentError("Unsupported x-hitslop container")
        }
    }

    func validateIDs(_ value: SlopDocumentJSON) throws {
        switch self {
        case .map(let fields): for (key, node) in fields { try node.validateIDs(value[key]) }
        case .record(let node): for child in value.object.values { try node.validateIDs(child) }
        case .list(let key, let node):
            var seen = Set<String>()
            for child in value.array {
                guard let id = child[key].string, !id.isEmpty, seen.insert(id).inserted else { throw SlopDocumentError("List IDs must be non-empty and unique") }
                try node.validateIDs(child)
            }
        case .atomic, .text: break
        }
    }
}

/// TypeBox's emitted document schema is read at open; no generated Swift models.
public final class SlopDocumentSchema {
    public let source: SlopDocumentJSON
    let mapping: SlopDocumentMapping
    private let validator: JSONSchema

    public init(_ application: SlopDocumentJSON) throws {
        source = application
        guard source["x-hitslop"]["version"] == .number(1), source["x-hitslop"]["container"].string == "map" else {
            throw SlopDocumentError("Expected an S.Document schema")
        }
        mapping = try SlopDocumentMapping(source)
        validator = try JSONSchema(data: source.encoded())
    }
    public func validate(_ value: SlopDocumentJSON) throws {
        try value.validateBounds()
        let bytes = try value.encoded()
        try SlopJSONLimits.check(bytes)
        let result = try JSON(data: bytes).validate(with: validator, dialect: SlopJSONValidation.dialect)
        guard result.isValid else { throw SlopDocumentError("Document failed JSON Schema validation: \(result)") }
        try mapping.validateIDs(value)
    }
}

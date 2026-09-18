import DynamicJSON
import Foundation
import HitSlopCore

public indirect enum SlopDocumentMapping {
    case map([String: SlopDocumentMapping])
    case record(SlopDocumentMapping)
    case list(String, SlopDocumentMapping)
    case atomic

    init(_ schema: SlopDocumentJSON) throws {
        let meta = schema["x-hitslop"]
        if schema.object["x-hitslop"] != nil, meta["container"].string == nil {
            throw SlopDocumentError("Unsupported x-hitslop container")
        }
        switch meta["container"].string {
        case "atomic": self = .atomic
        case "map": self = .map(try schema["properties"].object.mapValues(Self.init))
        case "record":
            let patterns = schema["patternProperties"].object
            guard patterns.count == 1, let value = patterns[SlopDocumentSchema.recordKeyPattern] else {
                throw SlopDocumentError("Record schema requires rebuilding with the current S.Record")
            }
            self = .record(try Self(value))
        case "list":
            guard let key = meta["key"].string, !key.isEmpty else { throw SlopDocumentError("List requires a key") }
            self = .list(key, try Self(schema["items"]))
        case nil: self = .atomic
        default: throw SlopDocumentError("Unsupported x-hitslop container")
        }
    }

    func validateIDs(_ value: SlopDocumentJSON) throws {
        switch self {
        case .map(let fields): for (key, node) in fields { try node.validateIDs(value[key]) }
        case .record(let node): for child in value.object.values { try node.validateIDs(child) }
        case .list(let key, let node):
            var seen = Set<Data>()
            for child in value.array {
                guard let id = child[key].string, !id.isEmpty, seen.insert(Data(id.utf8)).inserted else {
                    throw SlopDocumentError("List IDs must be non-empty and unique")
                }
                try node.validateIDs(child)
            }
        case .atomic: break
        }
    }
}

/// TypeBox's emitted document schema is read at open; no generated Swift models.
public final class SlopDocumentSchema {
    static let recordKeyPattern = #"^[\s\S]*$"#
    public let source: SlopDocumentJSON
    let mapping: SlopDocumentMapping
    private let validator: any JSONSchemaValidator

    public init(_ application: SlopDocumentJSON) throws {
        source = application
        guard source["x-hitslop"]["version"] == .number(1), source["x-hitslop"]["container"].string == "map" else {
            throw SlopDocumentError("Expected an S.Document schema")
        }
        mapping = try SlopDocumentMapping(source)
        let resource = try JSONSchemaResource(root: JSONSchema(data: source.encoded()))
        let registry = try JSONSchemaRegistry(defaultDialect: SlopJSONValidation.dialect).register(resource: resource)
        validator = try registry.validator(for: resource, dialect: SlopJSONValidation.dialect)
    }
    public struct Prepared: Sendable {
        public let data: SlopDocumentJSON
        public let bytes: Data
    }
    public func validate(_ value: SlopDocumentJSON) throws { _ = try prepare(value) }
    public func prepare(_ value: SlopDocumentJSON) throws -> Prepared {
        let bytes = try value.encoded(maximumBytes: SlopJSONLimits.documentBytes, maximumDepth: SlopJSONLimits.maximumDepth)
        let result = validator.validate(value.validationValue)
        guard result.isValid else { throw SlopDocumentError("Document failed JSON Schema validation: \(result)") }
        try mapping.validateIDs(value)
        return Prepared(data: value, bytes: bytes)
    }
}

extension SlopDocumentJSON {
    fileprivate var validationValue: JSON {
        switch self {
        case .null: .null
        case .bool(let value): .boolean(value)
        case .number(let value): Int64(exactly: value).map(JSON.integer) ?? .float(value)
        case .string(let value): .string(value)
        case .array(let values): .array(values.map(\.validationValue))
        case .object(let values): .object(values.mapValues(\.validationValue))
        }
    }
}

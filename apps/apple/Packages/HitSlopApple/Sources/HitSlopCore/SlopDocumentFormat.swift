import DynamicJSON
import Foundation

/// Decodes the fixed v1 projection envelope; the existing JSON Schema engine
/// validates the arbitrary application schema and document instances.
public enum SlopDocumentFormat {
    public static func applicationSchema(_ bytes: Data) throws -> Data {
        try SlopJSONLimits.check(bytes, maximumBytes: SlopFile.maximumBytes)
        do {
            let envelope = try JSONDecoder().decode(ObjectSchema<EnvelopeProperties>.self, from: bytes)
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
            return try encoder.encode(envelope.properties.data.value)
        } catch let error as DecodingError {
            let context: DecodingError.Context
            var missingKey: (any CodingKey)?
            switch error {
            case .dataCorrupted(let value), .typeMismatch(_, let value), .valueNotFound(_, let value):
                context = value
            case .keyNotFound(let key, let value):
                context = value
                missingKey = key
            @unknown default:
                throw error
            }
            let path = (context.codingPath + (missingKey.map { [$0] } ?? []))
                .map(\.stringValue).joined(separator: ".")
            throw SlopPackageError.invalid("Invalid v1 document schema at \(path.isEmpty ? "$" : path): \(context.debugDescription)")
        }
    }
}

private enum SchemaKey: String, CodingKey {
    case type, additionalProperties, required, properties, data, format, baseRevision
    case minLength, version, container
    case slop = "$slop"
    case constant = "const"
    case sync = "x-hitslop"
}

private protocol SchemaProperties: Decodable {
    static var names: Set<String> { get }
}

private struct ObjectSchema<Properties: SchemaProperties>: Decodable {
    let properties: Properties

    init(from decoder: any Decoder) throws {
        let fields = try decoder.container(keyedBy: SchemaKey.self)
        try fields.expect(String.self, .type, "object")
        try fields.expect(Bool.self, .additionalProperties, false)
        let required = try fields.decode([String].self, forKey: .required)
        guard required.count == Properties.names.count, Set(required) == Properties.names else {
            throw fields.invalid(.required, "Expected exactly \(Properties.names.sorted()) without duplicates")
        }
        properties = try fields.decode(Properties.self, forKey: .properties)
    }
}

private struct EnvelopeProperties: SchemaProperties {
    static let names: Set<String> = ["$slop", "data"]
    let data: ApplicationSchema

    init(from decoder: any Decoder) throws {
        try decoder.requireKeys(Self.names)
        let fields = try decoder.container(keyedBy: SchemaKey.self)
        _ = try fields.decode(ObjectSchema<MetadataProperties>.self, forKey: .slop)
        data = try fields.decode(ApplicationSchema.self, forKey: .data)
    }
}

private struct MetadataProperties: SchemaProperties {
    static let names: Set<String> = ["format", "baseRevision"]

    init(from decoder: any Decoder) throws {
        try decoder.requireKeys(Self.names)
        let fields = try decoder.container(keyedBy: SchemaKey.self)
        _ = try fields.decode(FormatSchema.self, forKey: .format)
        _ = try fields.decode(RevisionSchema.self, forKey: .baseRevision)
    }
}

private struct FormatSchema: Decodable {
    init(from decoder: any Decoder) throws {
        try decoder.container(keyedBy: SchemaKey.self).expect(Int.self, .constant, 1)
    }
}

private struct RevisionSchema: Decodable {
    init(from decoder: any Decoder) throws {
        let fields = try decoder.container(keyedBy: SchemaKey.self)
        try fields.expect(String.self, .type, "string")
        try fields.expect(Int.self, .minLength, 1)
    }
}

private struct ApplicationSchema: Decodable {
    let value: JSON

    init(from decoder: any Decoder) throws {
        let fields = try decoder.container(keyedBy: SchemaKey.self)
        try fields.expect(String.self, .type, "object")
        _ = try fields.decode(SyncMarker.self, forKey: .sync)
        // Preserve all application keywords, annotations and nested schemas.
        value = try JSON(from: decoder)
    }
}

private struct SyncMarker: Decodable {
    init(from decoder: any Decoder) throws {
        let fields = try decoder.container(keyedBy: SchemaKey.self)
        try fields.expect(Int.self, .version, 1)
        try fields.expect(String.self, .container, "map")
    }
}

private extension KeyedDecodingContainer where Key == SchemaKey {
    func expect<T: Decodable & Equatable>(_ type: T.Type, _ key: Key, _ expected: T) throws {
        guard try decode(type, forKey: key) == expected else {
            throw invalid(key, "Expected \(expected)")
        }
    }

    func invalid(_ key: Key, _ description: String) -> DecodingError {
        .dataCorrupted(.init(codingPath: codingPath + [key], debugDescription: description))
    }
}

private struct FieldName: CodingKey {
    let stringValue: String
    var intValue: Int? { nil }
    init(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { return nil }
}

private extension Decoder {
    func requireKeys(_ expected: Set<String>) throws {
        let fields = try container(keyedBy: FieldName.self)
        let actual = Set(fields.allKeys.map(\.stringValue))
        if let unexpected = actual.subtracting(expected).sorted().first {
            throw DecodingError.dataCorrupted(.init(
                codingPath: codingPath + [FieldName(stringValue: unexpected)],
                debugDescription: "Unexpected property; expected exactly \(expected.sorted())"
            ))
        }
        // Typed decoding reports missing keys at their exact paths.
    }
}

import Foundation
import DynamicJSON
import JSONSchema

enum Engine: String, CaseIterable, Codable {
    case current = "dynamic-current"
    case cached = "dynamic-reused"
    case candidate = "jsonschema-reused"

    func parse(_ bytes: Data) throws -> Value {
        switch self {
        case .current, .cached: return .dynamic(try JSON(data: bytes))
        case .candidate: return .ordered(try JSONValue.parse(bytes))
        }
    }

    func prepare(_ text: String, formats: Bool) throws -> Prepared {
        switch self {
        case .current:
            let schema = try DynamicJSON.JSONSchema(data: Data(text.utf8))
            return Prepared(
                validate: { value in
                    let result = try value.dynamic.validate(with: schema, dialect: dynamicDialect(formats))
                    return Outcome(valid: result.isValid, complete: true)
                },
                diagnostics: { value in
                    String(describing: try value.dynamic.validate(with: schema, dialect: dynamicDialect(formats)))
                },
                schemaJSON: { try JSONEncoder().encode(schema) }
            )
        case .cached:
            let schema = try DynamicJSON.JSONSchema(data: Data(text.utf8))
            let resource = try JSONSchemaResource(root: schema)
            let registry = try JSONSchemaRegistry(defaultDialect: dynamicDialect(formats)).register(resource: resource)
            let validator = try registry.validator(for: resource)
            return Prepared(
                validate: { value in
                    let result = validator.validate(try value.dynamic)
                    return Outcome(valid: result.isValid, complete: true)
                },
                diagnostics: { value in String(describing: validator.validate(try value.dynamic)) },
                schemaJSON: { try JSONEncoder().encode(schema) }
            )
        case .candidate:
            let validators: [any FormatValidator] = formats
                ? DefaultFormatValidators.all.filter { !["uri", "uri-reference"].contains($0.formatName) }
                    + [StrictURI(reference: false), StrictURI(reference: true)]
                : []
            let schema = try Schema(instance: text, formatValidators: validators)
            let meta = try schema.validateAgainstMetaSchema()
            guard meta.isValid else {
                throw SpikeError("Invalid schema: \(try meta.renderedOutput(level: .basic).serialized())")
            }
            return Prepared(
                validate: { value in
                    let result = schema.validate(try value.ordered)
                    return Outcome(valid: result.isValid, complete: result.isEvaluationComplete)
                },
                diagnostics: { value in
                    try schema.validate(value.ordered).renderedOutput(level: .basic).serialized(options: .pretty)
                },
                schemaJSON: { try schema.jsonValue.serializedData() }
            )
        }
    }
}

struct SpikeError: Error, CustomStringConvertible {
    let description: String
    init(_ description: String) { self.description = description }
}
struct Outcome { let valid: Bool; let complete: Bool }
struct Prepared {
    let validate: (Value) throws -> Outcome
    let diagnostics: (Value) throws -> String
    let schemaJSON: () throws -> Data
}
enum Value {
    case dynamic(JSON), ordered(JSONValue)
    var dynamic: JSON {
        get throws {
            guard case .dynamic(let value) = self else { throw SpikeError("Wrong adapter value") }
            return value
        }
    }
    var ordered: JSONValue {
        get throws {
            guard case .ordered(let value) = self else { throw SpikeError("Wrong adapter value") }
            return value
        }
    }
    func bytes() throws -> Data {
        switch self {
        case .dynamic(let value): return try JSONEncoder().encode(value)
        case .ordered(let value): return try value.serializedData()
        }
    }
}

// Matches SlopJSONValidation.swift, scoped to this standalone experiment.
func strictURI(_ value: String, reference: Bool) -> Bool {
    if reference && value.isEmpty { return true }
    guard value.allSatisfy(\.isASCII), !value.contains("\\"),
          let url = URL(string: value, encodingInvalidCharacters: false) else { return false }
    return reference || url.scheme != nil
}
struct StrictURI: FormatValidator {
    let reference: Bool
    var formatName: String { reference ? "uri-reference" : "uri" }
    func validate(_ value: String) -> Bool { strictURI(value, reference: reference) }
}
func dynamicDialect(_ asserting: Bool) -> JSONSchemaDraft2020.Dialect {
    var formats = JSONSchemaFormatValidators.draft2020
    if asserting {
        formats["uri"] = { strictURI($0, reference: false) }
        formats["uri-reference"] = { strictURI($0, reference: true) }
    }
    return .init(vocabulary: .init(formatValid: asserting, formatValidators: formats))
}

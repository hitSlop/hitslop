public indirect enum SlopJSONValue: Equatable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([SlopJSONValue])
    case object([String: SlopJSONValue])

    public var objectValue: [String: SlopJSONValue]? { if case .object(let value) = self { value } else { nil } }
    public var arrayValue: [SlopJSONValue]? { if case .array(let value) = self { value } else { nil } }
    public var stringValue: String? { if case .string(let value) = self { value } else { nil } }
    public var boolValue: Bool? { if case .bool(let value) = self { value } else { nil } }
    public var numberValue: Double? { if case .number(let value) = self { value } else { nil } }
    public var intValue: Int? {
        if case .number(let value) = self,
           value.isFinite,
           value.rounded() == value,
           value >= Double(Int.min),
           value <= Double(Int.max) {
            Int(value)
        } else {
            nil
        }
    }
}

public extension Dictionary where Key == String, Value == SlopJSONValue {
    func required(_ key: String) -> SlopJSONValue? { self[key] }
}

public protocol SlopJSONValueCodable {
    static func decodeSlopValue(_ value: SlopJSONValue?) -> Self?
    var slopValue: SlopJSONValue { get }
}

public enum SlopValueCoding {
    public static func decode<Value: SlopJSONValueCodable>(
        _ value: SlopJSONValue?,
        as type: Value.Type = Value.self
    ) -> Value? {
        Value.decodeSlopValue(value)
    }

    public static func encode<Value: SlopJSONValueCodable>(_ value: Value) -> SlopJSONValue {
        value.slopValue
    }
}

extension String: SlopJSONValueCodable {
    public static func decodeSlopValue(_ value: SlopJSONValue?) -> String? { value?.stringValue }
    public var slopValue: SlopJSONValue { .string(self) }
}

extension Bool: SlopJSONValueCodable {
    public static func decodeSlopValue(_ value: SlopJSONValue?) -> Bool? {
        if let value = value?.boolValue { return value }
        if let value = value?.intValue, value == 0 || value == 1 { return value == 1 }
        return nil
    }
    public var slopValue: SlopJSONValue { .bool(self) }
}

extension Int: SlopJSONValueCodable {
    public static func decodeSlopValue(_ value: SlopJSONValue?) -> Int? { value?.intValue }
    public var slopValue: SlopJSONValue { .number(Double(self)) }
}

extension Double: SlopJSONValueCodable {
    public static func decodeSlopValue(_ value: SlopJSONValue?) -> Double? {
        guard let value = value?.numberValue, value.isFinite else { return nil }
        return value
    }
    public var slopValue: SlopJSONValue { .number(self) }
}

extension Optional: SlopJSONValueCodable where Wrapped: SlopJSONValueCodable {
    public static func decodeSlopValue(_ value: SlopJSONValue?) -> Optional<Wrapped>? {
        guard let value else { return .some(nil) }
        if case .null = value { return .some(nil) }
        guard let decoded = Wrapped.decodeSlopValue(value) else { return nil }
        return .some(decoded)
    }

    public var slopValue: SlopJSONValue {
        switch self {
        case .some(let value): value.slopValue
        case .none: .null
        }
    }
}

extension Array: SlopJSONValueCodable where Element: SlopJSONValueCodable {
    public static func decodeSlopValue(_ value: SlopJSONValue?) -> [Element]? {
        guard let values = value?.arrayValue else { return nil }
        let decoded = values.compactMap { Element.decodeSlopValue($0) }
        return decoded.count == values.count ? decoded : nil
    }

    public var slopValue: SlopJSONValue { .array(map { $0.slopValue }) }
}

extension Dictionary: SlopJSONValueCodable where Key == String, Value: SlopJSONValueCodable {
    public static func decodeSlopValue(_ value: SlopJSONValue?) -> [String: Value]? {
        guard let values = value?.objectValue else { return nil }
        var result: [String: Value] = [:]
        for (key, encoded) in values {
            guard let decoded = Value.decodeSlopValue(encoded) else { return nil }
            result[key] = decoded
        }
        return result
    }

    public var slopValue: SlopJSONValue { .object(mapValues { $0.slopValue }) }
}

public protocol SlopJSONCodable: SlopJSONValueCodable {
    init?(json: SlopJSONValue)
    var json: SlopJSONValue { get }
}

public extension SlopJSONCodable {
    static func decodeSlopValue(_ value: SlopJSONValue?) -> Self? {
        guard let value else { return nil }
        return Self(json: value)
    }

    var slopValue: SlopJSONValue { json }
}

public struct SlopStatement: Equatable {
    public var sql: String
    public var parameters: [SlopJSONValue]

    public init(sql: String, parameters: [SlopJSONValue] = []) {
        self.sql = sql
        self.parameters = parameters
    }
}

public struct SlopError: Error, Equatable, CustomStringConvertible {
    public var message: String

    public init(_ message: String) { self.message = message }
    public var description: String { message }
}

import JavaScriptKit

extension SlopJSONValue {
    init?(_ value: JSValue) {
        if value.isNull || value.isUndefined { self = .null; return }
        if let bool = value.boolean { self = .bool(bool); return }
        if let number = value.number { self = .number(number); return }
        if let string = value.string { self = .string(string); return }
        guard let object = value.object else { return nil }
        if JSObject.global.Array.isArray(object).boolean == true {
            let count = Int(object.length.number ?? 0)
            let values = (0..<count).compactMap { SlopJSONValue(object[$0]) }
            guard values.count == count else { return nil }
            self = .array(values)
        } else {
            let keys = JSObject.global.Object.keys(object).object!
            let count = Int(keys.length.number ?? 0)
            var result: [String: SlopJSONValue] = [:]
            for index in 0..<count {
                guard let key = keys[index].string else { continue }
                guard let value = SlopJSONValue(object[key]) else { return nil }
                result[key] = value
            }
            self = .object(result)
        }
    }

    var jsValue: JSValue {
        switch self {
        case .null: return .null
        case .bool(let value): return value.jsValue
        case .number(let value): return value.jsValue
        case .string(let value): return value.jsValue
        case .array(let values):
            let array = JSObject.global.Array.function!().object!
            for value in values { _ = array.push!(value.jsValue) }
            return .object(array)
        case .object(let values):
            let object = JSObject.global.Object.function!().object!
            for (key, value) in values { object[key] = value.jsValue }
            return .object(object)
        }
    }
}

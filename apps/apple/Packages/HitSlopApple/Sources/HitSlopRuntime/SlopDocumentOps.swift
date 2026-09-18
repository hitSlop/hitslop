import Foundation

public struct SlopCommandError: LocalizedError, Sendable {
    public let code: String
    public let message: String
    public init(_ code: String, _ message: String) {
        self.code = code
        self.message = message
    }
    public var errorDescription: String? { message }
}

public enum SlopPathStep: Codable, Equatable, Sendable {
    case key(String)
    case item(String)
    public init(from decoder: any Decoder) throws {
        try self.init(SlopDocumentJSON(from: decoder))
    }
    init(_ value: SlopDocumentJSON) throws {
        guard value.object.count == 1 else {
            throw SlopCommandError("invalid_request", "Path steps have exactly one key or item")
        }
        if let key = value.object["key"]?.string {
            self = .key(key)
        } else if let id = value.object["item"]?.string, !id.isEmpty {
            self = .item(id)
        } else {
            throw SlopCommandError("invalid_request", "Invalid path step")
        }
    }
    public func encode(to encoder: any Encoder) throws {
        switch self {
        case .key(let key): try SlopDocumentJSON.object(["key": .string(key)]).encode(to: encoder)
        case .item(let id): try SlopDocumentJSON.object(["item": .string(id)]).encode(to: encoder)
        }
    }
}

/// Schema-directed commands. Every batch mutates a private candidate, then validates once.
public enum SlopDocumentOps {
    public static func apply(_ operations: SlopDocumentJSON, to before: SlopDocumentJSON, schema: SlopDocumentSchema)
        throws -> SlopDocumentJSON
    {
        try apply(parse(operations), to: before, schema: schema).data
    }
    static func apply(_ parsed: [(SlopDocumentJSON, [SlopPathStep])], to before: SlopDocumentJSON, schema: SlopDocumentSchema) throws -> SlopDocumentSchema.Prepared {
        var candidate = before
        for (operation, path) in parsed {
            try edit(&candidate, schema: schema.source, path: path[...], operation: operation, root: true)
        }
        do { return try schema.prepare(candidate) } catch { throw SlopCommandError("validation", error.localizedDescription) }
    }

    static func parse(_ operations: SlopDocumentJSON) throws -> [(SlopDocumentJSON, [SlopPathStep])] {
        guard case .array(let ops) = operations, !ops.isEmpty, ops.count <= 20_000 else {
            throw SlopCommandError("invalid_request", "Expected 1–20000 operations")
        }
        return try ops.map { operation in
            try validateShape(operation)
            let path = try operation["path"].array.map(SlopPathStep.init)
            return (operation, path)
        }
    }

    private static func validateShape(_ op: SlopDocumentJSON) throws {
        guard let name = op["op"].string, case .array(let path) = op["path"], path.count <= 64 else {
            throw SlopCommandError("invalid_request", "Invalid operation")
        }
        let required: Set<String>
        var allowed: Set<String>
        switch name {
        case "set": required = ["op", "path", "value"]
        case "unset", "toggle": required = ["op", "path"]
        case "increment": required = ["op", "path", "amount"]
        case "insert": required = ["op", "path", "value"]
        case "remove": required = ["op", "path", "id"]
        case "move": required = ["op", "path", "id", "position"]
        default: throw SlopCommandError("invalid_request", "Unknown operation")
        }
        allowed = required
        if name == "insert" { allowed.insert("position") }
        guard required.isSubset(of: Set(op.object.keys)), Set(op.object.keys).isSubset(of: allowed) else {
            throw SlopCommandError("invalid_request", "Unexpected operation fields")
        }
        if name == "increment", op["amount"].number?.isFinite != true {
            throw SlopCommandError("invalid_request", "Increment amount must be finite")
        }
        if name == "remove" || name == "move", op["id"].string?.isEmpty != false {
            throw SlopCommandError("invalid_request", "Expected an item identity")
        }
        if let position = op.object["position"] {
            guard position.object.count == 1,
                position["before"].string?.isEmpty == false || position["after"].string?.isEmpty == false
            else { throw SlopCommandError("invalid_request", "Position needs before or after identity") }
        }
    }

    private static func edit(
        _ value: inout SlopDocumentJSON, schema: SlopDocumentJSON, path: ArraySlice<SlopPathStep>,
        operation: SlopDocumentJSON, root: Bool = false, identity: String? = nil, removable: Bool = false
    ) throws {
        if let step = path.first {
            switch step {
            case .key(let key):
                guard case .object(var object) = value else {
                    throw SlopCommandError("missing_target", "Object for \(key) is missing")
                }
                if key == identity { throw SlopCommandError("identity_change", "List identity is immutable") }
                let container = schema["x-hitslop"]["container"].string
                let record = container == "record"
                guard record || container == "map" else {
                    throw SlopCommandError("invalid_path", "This value is atomic")
                }
                guard let child = record ? schema["patternProperties"].object[SlopDocumentSchema.recordKeyPattern] : schema["properties"].object[key]
                else { throw SlopCommandError("invalid_path", "Undeclared field: \(key)") }
                let optional = record || !schema["required"].array.contains(.string(key))
                if path.count == 1 && operation["op"].string == "unset" {
                    guard optional else {
                        throw SlopCommandError(
                            "invalid_operation", "Only optional fields and record entries may be unset")
                    }
                    object.removeValue(forKey: key)
                } else {
                    var next = object[key] ?? .null
                    try edit(&next, schema: child, path: path.dropFirst(), operation: operation, removable: optional)
                    object[key] = next
                }
                value = .object(object)
            case .item(let id):
                guard schema["x-hitslop"]["container"].string == "list",
                    let key = schema["x-hitslop"]["key"].string, case .array(var list) = value
                else { throw SlopCommandError("invalid_path", "item requires an identity list") }
                guard let index = list.firstIndex(where: { $0[key] == .string(id) }) else {
                    throw SlopCommandError("missing_target", "Item \(id) no longer exists")
                }
                try edit(
                    &list[index], schema: schema["items"], path: path.dropFirst(), operation: operation, identity: key)
                value = .array(list)
            }
            return
        }
        switch operation["op"].string {
        case "set":
            guard !root else { throw SlopCommandError("invalid_path", "Cannot set the document root") }
            let replacement = operation["value"]
            if let identity, replacement[identity] != value[identity] {
                throw SlopCommandError("identity_change", "List identity is immutable")
            }
            value = replacement
        case "unset":
            throw SlopCommandError("invalid_operation", "Only optional fields and record entries may be unset")
        case "toggle":
            guard case .bool(let old) = value else {
                throw SlopCommandError("invalid_operation", "toggle requires an existing boolean")
            }
            value = .bool(!old)
        case "increment":
            guard let old = value.number, let amount = operation["amount"].number, (old + amount).isFinite else {
                throw SlopCommandError("invalid_operation", "increment requires a finite number")
            }
            value = .number(old + amount)
        case "insert", "remove", "move":
            guard schema["x-hitslop"]["container"].string == "list",
                let key = schema["x-hitslop"]["key"].string, case .array(var list) = value
            else { throw SlopCommandError("invalid_operation", "Operation requires an identity list") }
            if operation["op"].string == "insert" {
                let item = operation["value"]
                guard let id = item[key].string, !id.isEmpty else {
                    throw SlopCommandError("invalid_operation", "Insert requires \(key)")
                }
                guard !list.contains(where: { $0[key] == .string(id) }) else {
                    throw SlopCommandError("duplicate_id", "Item \(id) already exists")
                }
                let index = try placement(list, key: key, position: operation.object["position"])
                list.insert(item, at: index)
            } else {
                let id = operation["id"].string!
                guard let index = list.firstIndex(where: { $0[key] == .string(id) }) else {
                    throw SlopCommandError("missing_target", "Item \(id) no longer exists")
                }
                if operation["op"].string == "move",
                    operation["position"]["before"] == .string(id) || operation["position"]["after"] == .string(id)
                {
                    throw SlopCommandError("invalid_operation", "Cannot position an item relative to itself")
                }
                let item = list.remove(at: index)
                if operation["op"].string == "move" {
                    list.insert(item, at: try placement(list, key: key, position: operation["position"]))
                }
            }
            value = .array(list)
        default: throw SlopCommandError("invalid_request", "Unknown operation")
        }
    }

    private static func placement(_ list: [SlopDocumentJSON], key: String, position: SlopDocumentJSON?) throws -> Int {
        guard let position else { return list.count }
        let before = position["before"].string
        let id = before ?? position["after"].string!
        guard let index = list.firstIndex(where: { $0[key] == .string(id) }) else {
            throw SlopCommandError("missing_anchor", "Positioning item \(id) no longer exists")
        }
        return index + (before == nil ? 1 : 0)
    }
}

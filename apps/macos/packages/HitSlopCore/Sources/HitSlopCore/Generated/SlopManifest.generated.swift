// This file was generated from JSON Schema using quicktype, do not modify it directly.
// To parse the JSON, add this file to your project and do:
//
//   let slopManifest = try SlopManifest(json)

import Foundation

/// The framework-neutral manifest for hitslop/1 web documents.
// MARK: - SlopManifest
public struct SlopManifest: Codable {
    public let schema: String?
    public let author: Schema6
    public let categories: [String]
    public let description: String
    public let format: Schema1
    public let runtime: Schema2
    public let slug: String
    public let stores: [Schema12]
    public let tags: [String]?
    public let title: String
    public let window: Schema13

    public enum CodingKeys: String, CodingKey {
        case schema = "$schema"
        case author = "author"
        case categories = "categories"
        case description = "description"
        case format = "format"
        case runtime = "runtime"
        case slug = "slug"
        case stores = "stores"
        case tags = "tags"
        case title = "title"
        case window = "window"
    }

    public init(schema: String?, author: Schema6, categories: [String], description: String, format: Schema1, runtime: Schema2, slug: String, stores: [Schema12], tags: [String]?, title: String, window: Schema13) {
        self.schema = schema
        self.author = author
        self.categories = categories
        self.description = description
        self.format = format
        self.runtime = runtime
        self.slug = slug
        self.stores = stores
        self.tags = tags
        self.title = title
        self.window = window
    }
}

// MARK: SlopManifest convenience initializers and mutators

public extension SlopManifest {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(SlopManifest.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        schema: String?? = nil,
        author: Schema6? = nil,
        categories: [String]? = nil,
        description: String? = nil,
        format: Schema1? = nil,
        runtime: Schema2? = nil,
        slug: String? = nil,
        stores: [Schema12]? = nil,
        tags: [String]?? = nil,
        title: String? = nil,
        window: Schema13? = nil
    ) -> SlopManifest {
        return SlopManifest(
            schema: schema ?? self.schema,
            author: author ?? self.author,
            categories: categories ?? self.categories,
            description: description ?? self.description,
            format: format ?? self.format,
            runtime: runtime ?? self.runtime,
            slug: slug ?? self.slug,
            stores: stores ?? self.stores,
            tags: tags ?? self.tags,
            title: title ?? self.title,
            window: window ?? self.window
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - Schema6
public struct Schema6: Codable {
    public let name: String
    public let url: String?

    public enum CodingKeys: String, CodingKey {
        case name = "name"
        case url = "url"
    }

    public init(name: String, url: String?) {
        self.name = name
        self.url = url
    }
}

// MARK: Schema6 convenience initializers and mutators

public extension Schema6 {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Schema6.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        name: String? = nil,
        url: String?? = nil
    ) -> Schema6 {
        return Schema6(
            name: name ?? self.name,
            url: url ?? self.url
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum Schema1: String, Codable {
    case hitslop1 = "hitslop/1"
}

public enum Schema2: String, Codable {
    case web = "web"
}

// MARK: - Schema12
public struct Schema12: Codable {
    public let id: String
    public let kind: StoreKind
    public let maxBytes: Int?
    public let path: String

    public enum CodingKeys: String, CodingKey {
        case id = "id"
        case kind = "kind"
        case maxBytes = "maxBytes"
        case path = "path"
    }

    public init(id: String, kind: StoreKind, maxBytes: Int?, path: String) {
        self.id = id
        self.kind = kind
        self.maxBytes = maxBytes
        self.path = path
    }
}

// MARK: Schema12 convenience initializers and mutators

public extension Schema12 {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Schema12.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        id: String? = nil,
        kind: StoreKind? = nil,
        maxBytes: Int?? = nil,
        path: String? = nil
    ) -> Schema12 {
        return Schema12(
            id: id ?? self.id,
            kind: kind ?? self.kind,
            maxBytes: maxBytes ?? self.maxBytes,
            path: path ?? self.path
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum StoreKind: String, Codable {
    case json = "json"
    case sqlite = "sqlite"
}

// MARK: - Schema13
public struct Schema13: Codable {
    public let height: Int
    public let resizable: Bool
    public let shape: Shape?
    public let width: Int

    public enum CodingKeys: String, CodingKey {
        case height = "height"
        case resizable = "resizable"
        case shape = "shape"
        case width = "width"
    }

    public init(height: Int, resizable: Bool, shape: Shape?, width: Int) {
        self.height = height
        self.resizable = resizable
        self.shape = shape
        self.width = width
    }
}

// MARK: Schema13 convenience initializers and mutators

public extension Schema13 {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Schema13.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        height: Int? = nil,
        resizable: Bool? = nil,
        shape: Shape?? = nil,
        width: Int? = nil
    ) -> Schema13 {
        return Schema13(
            height: height ?? self.height,
            resizable: resizable ?? self.resizable,
            shape: shape ?? self.shape,
            width: width ?? self.width
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

// MARK: - Shape
public struct Shape: Codable {
    public let kind: ShapeKind
    public let radius: Double?

    public enum CodingKeys: String, CodingKey {
        case kind = "kind"
        case radius = "radius"
    }

    public init(kind: ShapeKind, radius: Double?) {
        self.kind = kind
        self.radius = radius
    }
}

// MARK: Shape convenience initializers and mutators

public extension Shape {
    init(data: Data) throws {
        self = try newJSONDecoder().decode(Shape.self, from: data)
    }

    init(_ json: String, using encoding: String.Encoding = .utf8) throws {
        guard let data = json.data(using: encoding) else {
            throw NSError(domain: "JSONDecoding", code: 0, userInfo: nil)
        }
        try self.init(data: data)
    }

    init(fromURL url: URL) throws {
        try self.init(data: try Data(contentsOf: url))
    }

    func with(
        kind: ShapeKind? = nil,
        radius: Double?? = nil
    ) -> Shape {
        return Shape(
            kind: kind ?? self.kind,
            radius: radius ?? self.radius
        )
    }

    func jsonData() throws -> Data {
        return try newJSONEncoder().encode(self)
    }

    func jsonString(encoding: String.Encoding = .utf8) throws -> String? {
        return String(data: try self.jsonData(), encoding: encoding)
    }
}

public enum ShapeKind: String, Codable {
    case capsule = "capsule"
    case circle = "circle"
    case roundedRect = "roundedRect"
}

// MARK: - Helper functions for creating encoders and decoders

func newJSONDecoder() -> JSONDecoder {
    let decoder = JSONDecoder()
    if #available(iOS 10.0, OSX 10.12, tvOS 10.0, watchOS 3.0, *) {
        decoder.dateDecodingStrategy = .iso8601
    }
    return decoder
}

func newJSONEncoder() -> JSONEncoder {
    let encoder = JSONEncoder()
    if #available(iOS 10.0, OSX 10.12, tvOS 10.0, watchOS 3.0, *) {
        encoder.dateEncodingStrategy = .iso8601
    }
    return encoder
}

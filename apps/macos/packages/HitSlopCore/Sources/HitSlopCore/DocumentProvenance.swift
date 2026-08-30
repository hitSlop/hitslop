import Foundation

public struct DocumentProvenance: Codable, Sendable {
    public struct Template: Codable, Sendable {
        public let publisherKeyId: String; public let slug: String; public let release: Int; public let artifactSha256: String
        public init(publisherKeyId: String, slug: String, release: Int, artifactSha256: String) { self.publisherKeyId = publisherKeyId; self.slug = slug; self.release = release; self.artifactSha256 = artifactSha256 }
    }
    public let format: String; public let id: UUID; public let template: Template?
    public init(template: Template? = nil) { format = "hitslop-document/1"; id = UUID(); self.template = template }
    public func write(to packageURL: URL) throws { try JSONEncoder.pretty.encode(self).write(to: packageURL.appendingPathComponent("document.json"), options: .atomic) }
    public static func read(from packageURL: URL) throws -> DocumentProvenance {
        try JSONDecoder().decode(Self.self, from: Data(contentsOf: packageURL.appendingPathComponent("document.json")))
    }
}

private extension JSONEncoder {
    static var pretty: JSONEncoder { let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]; return encoder }
}

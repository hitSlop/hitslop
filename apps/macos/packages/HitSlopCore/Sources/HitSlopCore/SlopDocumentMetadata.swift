import Foundation

public enum SlopDocumentMetadata {
    public static func write(to packageURL: URL, template: SlopTemplateLineage? = nil) throws {
        let manifestURL = packageURL.appendingPathComponent("manifest.json")
        let manifest = try JSONDecoder().decode(SlopManifest.self, from: Data(contentsOf: manifestURL))
        let document = SlopDocument(id: UUID().uuidString.lowercased(), template: template)
        let updated = SlopManifest(
            schema: manifest.schema,
            author: manifest.author,
            categories: manifest.categories,
            description: manifest.description,
            document: document,
            slug: manifest.slug,
            stores: manifest.stores,
            tags: manifest.tags,
            title: manifest.title,
            window: manifest.window
        )
        try JSONEncoder.pretty.encode(updated).write(to: manifestURL, options: .atomic)
    }
}

extension JSONEncoder {
    static var pretty: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        return encoder
    }
}

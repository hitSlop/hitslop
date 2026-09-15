import Foundation
import HitSlopCore

/// Versions are app resources, never executable URLs supplied by a document.
struct SlopDocumentRuntime {
    let version: String
    let scriptURL: URL
    var resourcePath: String { "/__hitslop_runtime__/document-runtime-\(version).js" }

    init(required: String) throws {
        struct Catalog: Decodable { let versions: [String] }
        guard let root = Bundle.module.resourceURL?.appendingPathComponent("document-runtimes") else {
            throw SlopPackageError.missing("installed document runtime")
        }
        let catalog = try JSONDecoder().decode(Catalog.self, from: Data(contentsOf: root.appendingPathComponent("catalog.json")))
        version = try SlopRuntimeVersion.select(required: required, available: catalog.versions)
        scriptURL = root.appendingPathComponent("document-runtime-\(version).js")
        guard FileManager.default.fileExists(atPath: scriptURL.path) else { throw SlopPackageError.missing("installed document runtime \(version)") }
    }
    var bootstrap: String {
        // Both values derive from the validated numeric version, not package text.
        "window.__hitslopRuntimeConfig = {version:'\(version)',scriptURL:'\(resourcePath)'};"
    }
}

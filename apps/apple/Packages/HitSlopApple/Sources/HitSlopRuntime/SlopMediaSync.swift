import Foundation
import HitSlopCore

public enum SlopMediaSync {
    public static func hashes(in json: SlopDocumentJSON, schema: SlopDocumentJSON) -> Set<String> {
        let source = schema["properties"]["data"]
        var found = Set<String>()
        walk(json, schema: source, into: &found)
        return found
    }

    public static func localHashes(in package: SlopPackage) -> Set<String> {
        let directory = package.mediaStoresURL
        guard let urls = try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil) else { return [] }
        return Set(urls.map(\.lastPathComponent).filter { SlopMediaStore.isValidName($0) && $0.count == 64 })
    }

    @discardableResult public static func uploadMissing(package: SlopPackage, api: SlopCloudAPI, needed: Set<String>, excluding: Set<String> = []) async throws -> Set<String> {
        var uploaded = Set<String>()
        let store = SlopMediaStore(directoryURL: package.mediaStoresURL, rootURL: package.rootURL)
        for name in localHashes(in: package).intersection(needed).subtracting(excluding) {
            let url = try store.url(for: name)
            guard let data = try? Data(contentsOf: url) else { continue }
            let mime = (try? SlopMediaStore.mediaMIMEType(data)) ?? "application/octet-stream"
            guard SlopLoroBatch.digest(data) == name else { throw SlopDocumentError("Media hash mismatch") }
            let hash = try await api.putMedia(data, mime: mime)
            guard hash == name else { throw SlopDocumentError("Uploaded media hash mismatch") }
            uploaded.insert(name)
        }
        return uploaded
    }

    public static func downloadMissing(package: SlopPackage, needed: Set<String>, api: SlopCloudAPI) async throws {
        let store = SlopMediaStore(directoryURL: package.mediaStoresURL, rootURL: package.rootURL)
        for hash in needed {
            let url = try store.url(for: hash)
            if FileManager.default.fileExists(atPath: url.path) { continue }
            let data = try await api.media(hash)
            try Task.checkCancellation()
            guard SlopLoroBatch.digest(data) == hash else { throw SlopDocumentError("Downloaded media hash mismatch") }
            try FileManager.default.createDirectory(at: store.directoryURL, withIntermediateDirectories: true)
            try data.write(to: url, options: .atomic)
        }
    }

    private static func walk(_ json: SlopDocumentJSON, schema: SlopDocumentJSON, into found: inout Set<String>) {
        if schema["x-hitslop"]["media"] == .bool(true), let sha = json["sha256"].string,
           sha.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil { found.insert(sha); return }
        for (key, field) in schema["properties"].object { walk(json[key], schema: field, into: &found) }
        if schema["type"].string == "array" { for value in json.array { walk(value, schema: schema["items"], into: &found) } }
        if let values = schema["patternProperties"].object["^.*$"] { for value in json.object.values { walk(value, schema: values, into: &found) } }
    }
}

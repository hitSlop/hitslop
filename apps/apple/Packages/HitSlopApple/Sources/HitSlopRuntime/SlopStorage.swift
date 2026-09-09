import CryptoKit
import DynamicJSON
import Foundation
import HitSlopCore

struct SlopBridgeFailure: LocalizedError {
    let code: SlopBridgeErrorCode
    let message: String
    init(_ code: SlopBridgeErrorCode, _ message: String) { self.code = code; self.message = message }
    var errorDescription: String? { message }
}

final class SlopJSONStore {
    let url: URL
    /// Stat-first cache for the change poller: re-read and re-hash the file only
    /// when its modification date or size changes.
    private var revisionCache: (modified: Date, size: UInt64, revision: String)?
    private let schemaURL: URL?
    private var schema: JSONSchema?
    init(url: URL, schemaURL: URL? = nil) { self.url = url; self.schemaURL = schemaURL }

    private func validate(_ data: Data) throws {
        if schema == nil, let schemaURL, FileManager.default.fileExists(atPath: schemaURL.path) {
            schema = try JSONSchema(data: Data(contentsOf: schemaURL))
        }
        if let schema {
            let result = try JSON(data: data).validate(with: schema, dialect: SlopJSONValidation.dialect)
            guard result.isValid else { throw SlopBridgeFailure(.validationFailed, "JSON schema validation failed: \(result)") }
        }
    }

    func open(_ initialValue: Any) throws -> (value: Any, revision: String) {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        if !FileManager.default.fileExists(atPath: url.path) {
            let data = try Self.encode(initialValue)
            try validate(data)
            do { try data.write(to: url, options: .withoutOverwriting) }
            catch let error as CocoaError where error.code == .fileWriteFileExists { }
        }
        return try read()
    }

    func read() throws -> (value: Any, revision: String) {
        let data = try Data(contentsOf: url)
        try validate(data)
        return (try JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed]), Self.revision(data))
    }

    func write(_ value: Any, expectedRevision: String?) throws -> String {
        let current = try Data(contentsOf: url)
        if let expectedRevision, expectedRevision != Self.revision(current) { throw SlopBridgeFailure(.revisionConflict, "The document changed since it was read") }
        let data = try Self.encode(value)
        try validate(data)
        try data.write(to: url, options: .atomic)
        return Self.revision(data)
    }

    func revision() throws -> String? {
        guard let attributes = try? FileManager.default.attributesOfItem(atPath: url.path),
              let modified = attributes[.modificationDate] as? Date,
              let size = (attributes[.size] as? NSNumber)?.uint64Value
        else { revisionCache = nil; return nil }
        if let cached = revisionCache, cached.modified == modified, cached.size == size { return cached.revision }
        let revision = Self.revision(try Data(contentsOf: url))
        revisionCache = (modified, size, revision)
        return revision
    }
    private static func encode(_ value: Any) throws -> Data {
        var data = try JSONSerialization.data(withJSONObject: value, options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes, .fragmentsAllowed])
        data.append(0x0a); return data
    }
    private static func revision(_ data: Data) -> String { "sha256:" + SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
}

final class SlopThemeStore {
    let url: URL
    private let defaultURL: URL?
    private var lastValid = Data()
    init(url: URL, defaultURL: URL? = nil) { self.url = url; self.defaultURL = defaultURL }

    func stylesheet() -> Data {
        guard FileManager.default.fileExists(atPath: url.path) else { lastValid = Data(); return lastValid }
        do {
            guard let defaultURL else { throw SlopBridgeFailure(.validationFailed, "Theme overrides require immutable defaults") }
            let defaults = try String(contentsOf: defaultURL, encoding: .utf8)
            let contract = try SlopTheme.properties(defaults)
            try SlopTheme.validate(defaults, contract: contract)
            let css = try String(contentsOf: url, encoding: .utf8)
            try SlopTheme.validate(css, contract: contract)
            lastValid = Data(css.utf8)
        } catch { print("[hitSlop theme] Keeping previous theme: \(error.localizedDescription)") }
        return lastValid
    }

    func revision() throws -> String? {
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        let data = try Data(contentsOf: url)
        return "sha256:" + SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }
}

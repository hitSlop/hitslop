import CryptoKit
import Foundation
import HitSlopCore

struct SlopBridgeFailure: LocalizedError {
    let code: SlopBridgeErrorCode
    let message: String
    init(_ code: SlopBridgeErrorCode, _ message: String) { self.code = code; self.message = message }
    var errorDescription: String? { message }
}

final class SlopThemeStore {
    let url: URL
    private let defaultURL: URL?
    private let rootURL: URL
    private var lastValid = Data()
    init(url: URL, defaultURL: URL? = nil, rootURL: URL? = nil) { self.url = url; self.defaultURL = defaultURL; self.rootURL = rootURL ?? url.deletingLastPathComponent() }

    func stylesheet() -> Data {
        guard FileManager.default.fileExists(atPath: url.path) else { lastValid = Data(); return lastValid }
        do {
            guard let defaultURL else { throw SlopBridgeFailure(.validationFailed, "Theme overrides require immutable defaults") }
            guard let defaults = String(data: try SlopFile.read(defaultURL, within: rootURL), encoding: .utf8) else { throw SlopPackageError.invalid("theme defaults must be UTF-8") }
            let contract = try SlopTheme.properties(defaults)
            try SlopTheme.validate(defaults, contract: contract)
            guard let css = String(data: try SlopFile.read(url, within: rootURL), encoding: .utf8) else { throw SlopPackageError.invalid("theme override must be UTF-8") }
            try SlopTheme.validate(css, contract: contract)
            lastValid = Data(css.utf8)
        } catch { print("[hitSlop theme] Keeping previous theme: \(error.localizedDescription)") }
        return lastValid
    }

    func revision() throws -> String? {
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        let data = try SlopFile.read(url, within: rootURL)
        return "sha256:" + SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }
}

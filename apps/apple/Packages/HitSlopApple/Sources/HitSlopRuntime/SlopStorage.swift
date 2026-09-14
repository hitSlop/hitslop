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

final class SlopProjectionObserver {
    let url: URL
    init(url: URL) { self.url = url }
    func revision(refresh: Bool = false) throws -> String? {
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        return "sha256:" + SHA256.hash(data: try Data(contentsOf: url)).map { String(format: "%02x", $0) }.joined()
    }
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

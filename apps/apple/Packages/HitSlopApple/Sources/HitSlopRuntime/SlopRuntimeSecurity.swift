import Foundation
import HitSlopCore

public enum SlopRuntimePurpose: Sendable { case interactive, backgroundRender }

enum SlopRuntimeSecurity {
    enum NavigationDecision { case allow, openExternal, cancel }

    static func navigation(_ url: URL, targetIsMainFrame: Bool, isLink: Bool,
                           trustedSource: Bool, isDownload: Bool, purpose: SlopRuntimePurpose) -> NavigationDecision {
        guard !isDownload else { return .cancel }
        if targetIsMainFrame, isDocument(url) { return .allow }
        if purpose == .interactive, isLink, trustedSource,
           ["http", "https"].contains(url.scheme?.lowercased() ?? "") { return .openExternal }
        return .cancel
    }

    static func isOrigin(_ url: URL) -> Bool {
        url.scheme == "slop" && url.host == "app" && url.port == nil && url.user == nil && url.password == nil
    }
    static func isDocument(_ url: URL) -> Bool {
        isOrigin(url) && ["", "/", "/index.html"].contains(url.path) && url.query == nil
    }
    static func requestLimit(_ method: SlopBridgeMethod) -> Int {
        switch method {
        case .mediaWrite: 36 * 1024 * 1024
        case .documentApply: 1024 * 1024
        default: 64 * 1024
        }
    }
    static func publicFailure(_ error: Error) -> SlopBridgeFailure {
        if let error = error as? SlopLimitError { return SlopBridgeFailure(.limitExceeded, error.message) }
        if let error = error as? SlopBridgeFailure { return error }
        if error is CancellationError { return SlopBridgeFailure(.closed, "Document session is closed") }
        if let error = error as? SlopDocumentError {
            return SlopBridgeFailure(.validationFailed, error.limitMessage ?? "Document change could not be applied; review the document in hitSlop")
        }
        return SlopBridgeFailure(.storageError, "The host could not complete this operation")
    }
}

/// Revocation also reaches work waiting on the document actor or storage queue.
final class SlopRequestLease: @unchecked Sendable {
    private let lock = NSLock()
    private var active = true
    func invalidate() { lock.lock(); defer { lock.unlock() }; active = false }
    func check() throws {
        lock.lock(); defer { lock.unlock() }
        guard active else { throw SlopBridgeFailure(.closed, "Document session is closed") }
    }
}

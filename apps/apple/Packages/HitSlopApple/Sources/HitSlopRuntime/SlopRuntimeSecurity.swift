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
}

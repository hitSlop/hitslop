import Foundation
import HitSlopCore

public enum SlopLocalDocuments {
    public static func defaultCreationDirectory() -> URL {
        FileManager.default.urls(for: .desktopDirectory, in: .userDomainMask)[0]
    }
    public static func requireLocal(_ url: URL) throws {
        var candidate = url.standardizedFileURL.resolvingSymlinksInPath()
        while true {
            let path = candidate.path
            let ubiquitous = (try? candidate.resourceValues(forKeys: [.isUbiquitousItemKey]).isUbiquitousItem) == true
            if ubiquitous || path.hasSuffix("/Library/Mobile Documents") || path.contains("/Library/Mobile Documents/") {
                throw SlopPackageError.invalid("iCloud documents are not supported. Use a local folder.")
            }
            if path == "/" { break }
            let parent = candidate.deletingLastPathComponent().standardizedFileURL.resolvingSymlinksInPath()
            if parent.path == path { break }
            candidate = parent
        }
    }
}

@MainActor public final class SlopOpenedDocument {
    public let presentedURL: URL
    public let session: SlopRuntimeSession
    public static func open(presentedURL: URL) async throws -> SlopOpenedDocument { try SlopOpenedDocument(presentedURL: presentedURL) }
    public init(presentedURL: URL) throws {
        #if !os(macOS)
        throw SlopPackageError.invalid("Document editing is available on macOS only")
        #else
        try SlopLocalDocuments.requireLocal(presentedURL)
        self.presentedURL = presentedURL.standardizedFileURL
        session = try SlopRuntimeSession(packageURL: self.presentedURL)
        #endif
    }
    public func close() { session.close() }
}

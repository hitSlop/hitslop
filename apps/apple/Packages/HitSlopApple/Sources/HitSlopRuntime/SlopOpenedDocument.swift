import Foundation
import HitSlopCore

@MainActor public final class SlopOpenedDocument {
    public let presentedURL: URL
    public let session: SlopRuntimeSession

    public init(presentedURL: URL) throws {
        try SlopLocalDocument.requireLocal(presentedURL)
        self.presentedURL = presentedURL.standardizedFileURL
        session = try SlopRuntimeSession(packageURL: self.presentedURL)
    }

    private init(presentedURL: URL, session: SlopRuntimeSession) {
        self.presentedURL = presentedURL.standardizedFileURL
        self.session = session
    }

    public static func open(presentedURL: URL) async throws -> SlopOpenedDocument {
        let session = try await SlopRuntimeSession.open(packageURL: presentedURL)
        return SlopOpenedDocument(presentedURL: presentedURL, session: session)
    }

    public func close() { session.close() }
}

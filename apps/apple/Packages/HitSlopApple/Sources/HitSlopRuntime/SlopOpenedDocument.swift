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

    public func close() { session.close() }
}

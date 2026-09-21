import Foundation
import HitSlopCore

@MainActor public struct DocumentFactory: Sendable {
    public let templatesRoot: URL

    public init(templatesRoot: URL = DocumentFactory.defaultTemplatesRoot) {
        self.templatesRoot = templatesRoot
    }

    nonisolated public static var defaultTemplatesRoot: URL {
        #if os(macOS)
        FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".hitslop/templates", isDirectory: true)
        #else
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("hitSlop/templates", isDirectory: true)
        #endif
    }

    public func isManagedTemplatePackage(_ url: URL) -> Bool {
        Self.isManagedTemplatePackage(url, templatesRoot: templatesRoot)
    }

    /// Catalog masters live under the templates root. Resolve POSIX symlinks so
    /// a link outside the tree cannot open one as a document.
    nonisolated public static func isManagedTemplatePackage(_ url: URL, templatesRoot: URL = defaultTemplatesRoot) -> Bool {
        let candidate = url.standardizedFileURL.resolvingSymlinksInPath().pathComponents
        let root = templatesRoot.standardizedFileURL.resolvingSymlinksInPath().pathComponents
        if let bundled = Bundle.main.resourceURL?.appendingPathComponent("StarterTemplates").standardizedFileURL.resolvingSymlinksInPath().pathComponents,
           candidate.count > bundled.count, zip(bundled, candidate).allSatisfy({ $0.caseInsensitiveCompare($1) == .orderedSame }) { return true }
        guard candidate.count > root.count else { return false }
        return zip(root, candidate).allSatisfy { $0.caseInsensitiveCompare($1) == .orderedSame }
    }

    nonisolated public func create(fromLocalPackage packageURL: URL, at destination: URL) throws {
        try SlopPackage(rootURL: packageURL).validateAsTemplate()
        try SlopDuplicator.duplicate(from: packageURL, to: destination)
    }

    public func createLocal(from packageURL: URL, at destination: URL) async throws {
        try await SlopPreparation.run { try self.create(fromLocalPackage: packageURL, at: destination) }
    }
}

import Foundation
import HitSlopCore

@MainActor public struct DocumentFactory: Sendable {
    public let templatesRoot: URL

    public init(templatesRoot: URL = DocumentFactory.defaultTemplatesRoot) {
        self.templatesRoot = templatesRoot
    }

    nonisolated public static var defaultTemplatesRoot: URL { SlopTemplateLocation.defaultTemplatesRoot }

    public func isManagedTemplatePackage(_ url: URL) -> Bool {
        Self.isManagedTemplatePackage(url, templatesRoot: templatesRoot)
    }

    nonisolated public static func isManagedTemplatePackage(_ url: URL, templatesRoot: URL = defaultTemplatesRoot) -> Bool {
        SlopTemplateLocation.isManagedTemplatePackage(url, templatesRoot: templatesRoot)
    }

    nonisolated public func create(fromLocalPackage packageURL: URL, at destination: URL) throws {
        try SlopPackage(rootURL: packageURL).validateAsTemplate()
        try SlopDuplicator.duplicate(from: packageURL, to: destination)
    }

    public func createLocal(from packageURL: URL, at destination: URL) async throws {
        try await SlopPreparation.run { try self.create(fromLocalPackage: packageURL, at: destination) }
    }
}

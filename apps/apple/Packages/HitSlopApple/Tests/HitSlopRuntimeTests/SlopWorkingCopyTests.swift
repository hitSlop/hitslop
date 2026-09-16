import Foundation
import HitSlopCore
import Testing
@testable import HitSlopRuntime

@Test @MainActor func documentFactoryRecognizesOnlyManagedTemplatePackages() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("hitslop-template-boundary-\(UUID().uuidString)", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: root) }
    let templates = root.appendingPathComponent("templates", isDirectory: true)
    let factory = DocumentFactory(catalogURL: URL(string: "https://api.hitslop.com")!, templatesRoot: templates)

    #expect(factory.isManagedTemplatePackage(templates.appendingPathComponent("soma-amp.slop")))
    #expect(factory.isManagedTemplatePackage(templates.appendingPathComponent("cache/publisher/soma-amp/1.slop")))
    #expect(factory.isManagedTemplatePackage(templates.deletingLastPathComponent().appendingPathComponent("TEMPLATES/soma-amp.slop")))
    #expect(!factory.isManagedTemplatePackage(templates))
    #expect(!factory.isManagedTemplatePackage(root.appendingPathComponent("templates-backup/soma-amp.slop")))
    #expect(!factory.isManagedTemplatePackage(root.appendingPathComponent("documents/soma-amp.slop")))
}

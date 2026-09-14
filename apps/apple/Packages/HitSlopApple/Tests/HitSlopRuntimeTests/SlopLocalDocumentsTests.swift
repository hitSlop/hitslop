import Foundation
import Testing
@testable import HitSlopRuntime

@Test func documentCreationRequiresLocalDestination() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("local-document-\(UUID())", isDirectory: true)
    defer { try? FileManager.default.removeItem(at: root) }
    let cloud = root.appendingPathComponent("Library/Mobile Documents", isDirectory: true)
    try FileManager.default.createDirectory(at: cloud, withIntermediateDirectories: true)
    let link = root.appendingPathComponent("linked-cloud", isDirectory: true)
    try FileManager.default.createSymbolicLink(at: link, withDestinationURL: cloud)
    try SlopLocalDocuments.requireLocal(root.appendingPathComponent("Local.slop"))
    #expect(throws: (any Error).self) { try SlopLocalDocuments.requireLocal(cloud.appendingPathComponent("New.slop")) }
    #expect(throws: (any Error).self) { try SlopLocalDocuments.requireLocal(link.appendingPathComponent("New.slop")) }
}

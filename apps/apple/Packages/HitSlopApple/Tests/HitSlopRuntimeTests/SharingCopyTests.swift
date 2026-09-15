import Foundation
import HitSlopCore
import Testing
@testable import HitSlopRuntime

@Test(.enabled(if: ProcessInfo.processInfo.environment["HITSLOP_PILOT_PACKAGE"] != nil))
@MainActor func sharedReplicasMergeAndCopiesHaveIndependentIdentities() async throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("sharing-pilot-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: root) }
    let source = URL(fileURLWithPath: ProcessInfo.processInfo.environment["HITSLOP_PILOT_PACKAGE"]!)
    let first = try SlopDuplicator.duplicate(from: source, to: root.appendingPathComponent("first.slop"))
    let left = try SlopRuntimeSession(packageURL: first); left.load(); defer { left.close() }
    try await left.waitUntilReady()
    let original = try await left.sharingSnapshot()
    let rightURL = try await left.sharedCopy(to: root.appendingPathComponent("shared.slop"), snapshot: original)
    let right = try SlopRuntimeSession(packageURL: rightURL); right.load(); defer { right.close() }
    try await right.waitUntilReady()
    #expect(try await right.sharingSnapshot().documentId == original.documentId)
    let copyURL = try await left.independentCopy(to: root.appendingPathComponent("independent.slop"))
    let copy = try SlopRuntimeSession(packageURL: copyURL); copy.load(); defer { copy.close() }
    try await copy.waitUntilReady()
    #expect(try await copy.sharingSnapshot().documentId != original.documentId)
    #expect(try SlopTemplateFingerprint.value(first) == SlopTemplateFingerprint.value(copyURL))
    // Versioned file input and remote input meet in the same live engine.
    var envelope = try #require(JSONSerialization.jsonObject(with: Data(contentsOf: first.appendingPathComponent("stores/data.json"))) as? [String: Any])
    var data = try #require(envelope["data"] as? [String: Any]); data["title"] = "Shared title"; envelope["data"] = data
    try JSONSerialization.data(withJSONObject: envelope).write(to: first.appendingPathComponent("stores/data.json"), options: .atomic)
    try await left.flush()
    let changed = try await left.sharingSnapshot()
    try await right.receiveShared(changed)
    try await right.receiveShared(changed)
    #expect(try await right.sharingSnapshot().version == changed.version)
    let rightData = try #require(JSONSerialization.jsonObject(with: Data(contentsOf: rightURL.appendingPathComponent("stores/data.json"))) as? [String: Any])
    #expect((rightData["data"] as? [String: Any])?["title"] as? String == "Shared title")
    do { try await copy.receiveShared(changed); Issue.record("An independent copy accepted foreign updates") } catch {}
}

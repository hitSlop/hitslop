#if os(macOS)
import Foundation
import Testing
@testable import HitSlopRuntime

private func syncFixture() throws -> [String: Any] {
    let url = try #require(Bundle.module.url(forResource: "sync-transaction", withExtension: "json", subdirectory: "Fixtures"))
    return try #require(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
}
private func syncRoot() throws -> URL {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("hitslop-sync-test-\(UUID()).slop")
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    return root
}

@Test func nativeSyncMatchesSharedTransactionFixture() throws {
    let fixture = try syncFixture(), root = try syncRoot()
    defer { try? FileManager.default.removeItem(at: root) }
    let storage = SlopSyncStorage(root: root)
    let commit = try #require(fixture["commit"] as? [String: Any])
    let before = try storage.open()
    #expect(before["generation"] as? String == commit["expectedGeneration"] as? String)
    let after = try storage.commit(commit)
    #expect(after["generation"] as? String == fixture["generation"] as? String)
    #expect(after["externalHash"] as? String == fixture["externalHash"] as? String)
    #expect(after["external"] as? String == commit["projection"] as? String)
    #expect(throws: SlopBridgeFailure.self) { _ = try storage.commit(commit) }
}

@Test(arguments: ["state/journal/pending.json", "state/identity.json", "state/checkpoint.loro", "state/materialization.json", "stores/data.json"])
func nativeSyncRecoversEveryCommitBoundary(path: String) throws {
    let fixture = try syncFixture(), root = try syncRoot()
    defer { try? FileManager.default.removeItem(at: root) }
    let storage = SlopSyncStorage(root: root)
    storage.afterReplace = { changed in if changed == path { throw CocoaError(.fileWriteUnknown) } }
    #expect(throws: (any Error).self) { _ = try storage.commit(try #require(fixture["commit"] as? [String: Any])) }
    let recovered = try SlopSyncStorage(root: root).open()
    #expect(recovered["generation"] as? String == fixture["generation"] as? String)
    #expect(recovered["externalHash"] as? String == fixture["externalHash"] as? String)
}

@Test func nativeSyncCheckpointOnlyCommitPreservesMalformedJSON() throws {
    let fixture = try syncFixture(), root = try syncRoot()
    defer { try? FileManager.default.removeItem(at: root) }
    let storage = SlopSyncStorage(root: root)
    var commit = try #require(fixture["commit"] as? [String: Any])
    _ = try storage.commit(commit)
    let file = root.appendingPathComponent("stores/data.json")
    try Data("{unfinished".utf8).write(to: file, options: .atomic)
    let observed = try storage.open()
    commit["expectedGeneration"] = observed["generation"]
    commit["expectedExternal"] = observed["externalHash"]
    commit.removeValue(forKey: "projection")
    commit["checkpoint"] = Data("later checkpoint".utf8).base64EncodedString()
    _ = try storage.commit(commit)
    #expect(try String(contentsOf: file, encoding: .utf8) == "{unfinished")
    #expect(try storage.open()["checkpoint"] as? String == commit["checkpoint"] as? String)
}

@Test func nativeSyncRecoveryPreservesUnexpectedExternalBytes() throws {
    let fixture = try syncFixture(), root = try syncRoot()
    defer { try? FileManager.default.removeItem(at: root) }
    let storage = SlopSyncStorage(root: root)
    storage.afterReplace = { path in if path == "state/checkpoint.loro" { throw CocoaError(.fileWriteUnknown) } }
    #expect(throws: (any Error).self) { _ = try storage.commit(try #require(fixture["commit"] as? [String: Any])) }
    let external = root.appendingPathComponent("stores/data.json")
    try Data("{external".utf8).write(to: external)
    #expect(throws: SlopBridgeFailure.self) { _ = try SlopSyncStorage(root: root).open() }
    #expect(try String(contentsOf: external, encoding: .utf8) == "{external")
}
#endif

import Foundation
import Testing
import HitSlopLoroSpike
import HitSlopSQLiteArchive
@testable import HitSlopSQLiteSpike

struct SQLiteSpikeTests {
    @Test func failedEditCanRetryAndOldDataEditPreservesTheme() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let doc = try SQLiteDocument(url: seed(root)), original = try await doc.frame()
        var data = original.data
        data["title"] = .string("Updated title")
        func edit(_ sequence: Int) throws -> Data {
            try SpikeJSON.object(["method": .string("apply"), "session": .string("test"), "sequence": .number(Double(sequence)), "base": .string(original.revision), "after": data]).encoded()
        }
        let first = try edit(1)
        await doc.injectCommitFailure()
        await #expect(throws: (any Error).self) { try await doc.request(first) }
        await #expect(throws: (any Error).self) { try await doc.request(first) }
        #expect(try await doc.frame().data == original.data)
        #expect(try await doc.outbox().isEmpty)
        try await doc.setTheme("--slop-surface", value: "green")
        let second = try edit(2)
        _ = try await doc.request(second)
        let confirmed = try await doc.frame()
        _ = try await doc.request(second)
        #expect(try await doc.frame().publication == confirmed.publication)
        #expect(confirmed.data["title"].string == "Updated title")
        #expect(confirmed.theme["--slop-surface"] == "green")
        try await doc.close()
    }
    private func seed(_ root: URL) throws -> URL {
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let url = root.appendingPathComponent("test.slopsql")
        let db = try SQLiteArchive(url: url, writable: true, create: true)
        let fixtures = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("HitSlopLoroSpikeTests/Fixtures")
        try db.putAsset("data.schema.json", bytes: Data(contentsOf: fixtures.appendingPathComponent("checklist.schema.json")))
        try db.putAsset("assets/initial.json", bytes: Data(contentsOf: fixtures.appendingPathComponent("checklist.initial.json")))
        try db.putAsset("assets/theme.css", bytes: Data(":root { --slop-surface: pink; --slop-ink: black; }".utf8))
        try db.putAsset("app.html", bytes: Data("<!doctype html>".utf8)); try db.close(); return url
    }
    @Test func transactionalThemesAndFailures() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let url = try seed(root), doc = try SQLiteDocument(url: url)
        let before = try await doc.frame()
        await doc.injectCommitFailure()
        await #expect(throws: (any Error).self) { try await doc.setTheme("--slop-surface", value: "green") }
        #expect(try await doc.frame().publication == before.publication)
        #expect(try await doc.frame().theme.isEmpty)
        #expect(try await doc.outbox().isEmpty)
        try await doc.setTheme("--slop-surface", value: "green")
        await #expect(throws: (any Error).self) { try await doc.setTheme("--slop-missing", value: "red") }
        await #expect(throws: (any Error).self) { try await doc.setTheme("--slop-ink", value: "red; } body {display:none") }
        await #expect(throws: (any Error).self) { try await doc.setTheme("--slop-ink", value: "var(--unknown)") }
        try await doc.close()
        let reopened = try SQLiteDocument(url: url)
        #expect(try await reopened.frame().theme["--slop-surface"] == "green")
        #expect(try await reopened.outbox().count == 1)
        try await reopened.setTheme("--slop-surface", value: nil)
        #expect(try await reopened.frame().theme.isEmpty)
        try await reopened.close()
    }
    @Test func twoReplicasMergeAndReset() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let a = try SQLiteDocument(url: seed(root)), copy = root.appendingPathComponent("other.slopsql")
        _ = try await a.snapshot(to: copy); let b = try SQLiteDocument(url: copy)
        try await a.setTheme("--slop-surface", value: "green")
        try await b.setTheme("--slop-ink", value: "navy")
        let left = try await a.outbox()[0], right = try await b.outbox()[0]
        try await a.receive(right, sequence: 1); try await b.receive(left, sequence: 1)
        #expect(try await a.frame().theme == b.frame().theme)
        #expect(try await a.frame().theme.count == 2)
        try await a.acknowledge(left); try await b.acknowledge(right)
        try await a.setTheme("--slop-surface", value: "red"); try await b.setTheme("--slop-surface", value: "blue")
        let x = try await a.outbox()[0], y = try await b.outbox()[0]
        try await a.receive(y, sequence: 2); try await b.receive(x, sequence: 2)
        #expect(try await a.frame().theme == b.frame().theme)
        try await a.acknowledge(x); try await b.acknowledge(y)
        try await a.setTheme(nil, value: nil)
        let reset = try await a.outbox()[0]; try await b.receive(reset, sequence: 3)
        #expect(try await b.frame().theme.isEmpty)
        try await b.receive(reset, sequence: 3) // replay is idempotent
        await #expect(throws: (any Error).self) { try await b.receive(reset, sequence: 5) }
        try await a.close(); try await b.close()
    }
    @Test func archiveBackupAndGenerationChecks() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let url = try seed(root), a = try SQLiteDocument(url: url), b = try SQLiteDocument(url: url)
        let frame = try await a.frame()
        try await a.setTheme("--slop-ink", value: "blue")
        await #expect(throws: (any Error).self) { try await b.setTheme("--slop-ink", value: "red") }
        let fakePNG = Data([137,80,78,71,13,10,26,10])
        #expect(try await a.saveArtwork(preview: fakePNG, icon: fakePNG, generation: frame.publication) == false)
        let db = try SQLiteArchive(url: url)
        #expect(try db.query("PRAGMA integrity_check").first?["integrity_check"]?.text == "ok")
        #expect(try db.query("PRAGMA journal_mode").first?["journal_mode"]?.text == "delete")
        #expect(throws: (any Error).self) { try db.asset("../secret") }
        #expect(throws: (any Error).self) { try db.putAsset("assets/no", bytes: Data()) }
        try db.close(); try await a.close(); try await b.close()
        #expect(!FileManager.default.fileExists(atPath: url.path + "-journal"))
        #expect(!FileManager.default.fileExists(atPath: url.path + "-wal"))
    }
}

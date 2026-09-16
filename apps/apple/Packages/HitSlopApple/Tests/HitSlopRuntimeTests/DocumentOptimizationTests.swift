import Foundation
import Testing
@testable import HitSlopRuntime

private let listSchema = try! SlopDocumentJSON(data: Data(#"{"type":"object","x-hitslop":{"version":1,"container":"map"},"properties":{"tasks":{"type":"array","x-hitslop":{"container":"movable-list","key":"id"},"items":{"type":"object","x-hitslop":{"container":"map"},"properties":{"id":{"type":"string"},"text":{"type":"string","x-hitslop":{"container":"text"}},"parts":{"type":"array","x-hitslop":{"container":"movable-list","key":"id"},"items":{"type":"object","x-hitslop":{"container":"map"},"properties":{"id":{"type":"string"},"text":{"type":"string"}},"required":["id","text"]}}},"required":["id","text"]}}},"required":["tasks"]}"#.utf8))
private func row(_ id: String, _ text: String = "task") -> SlopDocumentJSON { .object(["id": .string(id), "text": .string(text)]) }
private func rows(_ values: [SlopDocumentJSON]) -> SlopDocumentJSON { .object(["tasks": .array(values)]) }
private func optimizationRoot() throws -> URL {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    return root
}
private func write(_ document: SlopLoroDocument, sequence: Int, text: String) async throws {
    let frame = try await document.frame()
    _ = try await document.apply(.init(session: "edits", sequence: sequence, base: frame.revision, after: rows([row("a", text)])))
}

struct DocumentOptimizationTests {
    @Test func rowEditsAvoidSearchesAndMaterializationsAreCached() throws {
        let replica = try SlopDocumentReplica(schema: SlopDocumentSchema(listSchema), initial: rows((0..<500).map { row(String($0)) }))
        let before = try replica.current(), base = replica.revision()
        let reads = replica.work.materializations
        for _ in 0..<10 { _ = try replica.current(); _ = try replica.fork().current() }
        #expect(replica.work.materializations == reads)
        var items = before["tasks"].array
        items[250]["text"] = .string("changed")
        try replica.apply(base: base, after: rows(items))
        #expect(replica.work.listSearches == 0)
        #expect(replica.work.listMoves == 0)
        let materializations = replica.work.materializations
        #expect(try replica.current() == rows(items))
        #expect(replica.work.materializations == materializations)
        #expect(try replica.value(at: base) == before)
    }

    @Test func structuralAndNestedEditsPreserveListSemantics() throws {
        var a = row("a"); a["parts"] = .array([row("part")])
        let replica = try SlopDocumentReplica(schema: SlopDocumentSchema(listSchema), initial: rows([a, row("b"), row("c")]))
        let changed = rows([row("c"), a, row("d")])
        try replica.apply(base: replica.revision(), after: changed)
        #expect(try replica.current() == changed)
        #expect(replica.work.listSearches > 0)
        let searches = replica.work.listSearches
        a["parts"] = .array([row("part", "nested edit")])
        let nested = rows([row("c"), a, row("d")])
        try replica.apply(base: replica.revision(), after: nested)
        #expect(try replica.current() == nested)
        #expect(replica.work.listSearches == searches)
    }

    @Test func staleBaseEditsMergeAndInvalidMergesPreserveCachedState() throws {
        let schema = try SlopDocumentSchema(listSchema)
        let a = try SlopDocumentReplica(schema: schema, initial: rows([row("a"), row("b")]))
        let initial = try a.current(), base = a.revision()
        let b = try SlopDocumentReplica(schema: schema, initial: initial, snapshot: a.snapshot())
        try a.apply(base: base, after: rows([row("a", "alice"), row("b")]))
        try b.apply(base: base, after: rows([row("a"), row("b", "bob")]))
        try a.receive(b.updates(since: a))
        try b.receive(a.updates(since: b))
        #expect(try a.current() == b.current())
        #expect(try a.current() == rows([row("a", "alice"), row("b", "bob")]))
        // Local edits against a stale base still merge, rather than replace head.
        try a.apply(base: base, after: rows([row("a"), row("b"), row("c")]))
        #expect(try a.current()["tasks"].array.first == row("a", "alice"))

        let x = try SlopDocumentReplica(schema: schema, initial: rows([]))
        let y = try SlopDocumentReplica(schema: schema, initial: rows([]), snapshot: x.snapshot())
        let sharedBase = x.revision()
        try x.apply(base: sharedBase, after: rows([row("same", "x")]))
        try y.apply(base: sharedBase, after: rows([row("same", "y")]))
        let valid = try x.current(), revision = x.revision()
        #expect(throws: (any Error).self) { try x.receive(y.updates(since: x)) }
        #expect(try x.current() == valid)
        #expect(x.revision() == revision)
        // Final merge validation also applies to locally authored stale edits.
        #expect(throws: (any Error).self) { try x.apply(base: sharedBase, after: rows([row("same", "z")])) }
        #expect(try x.current() == valid)
    }

    @Test func burstWritesAreDurableBeforeProjectionAndFlushCoalesces() async throws {
        let root = try optimizationRoot()
        defer { try? FileManager.default.removeItem(at: root) }
        let document = try SlopLoroDocument(root: root, schema: listSchema, initial: rows([row("a")]))
        await document.configureProjectionTiming(quiet: .seconds(10), maximum: .seconds(10))
        try await document.flush()
        let original = try Data(contentsOf: root.appendingPathComponent("stores/data.json"))
        let before = await document.diagnostics()
        for i in 1...5 { try await write(document, sequence: i, text: String(i)) }
        #expect(try await document.frame().dirty)
        #expect(try Data(contentsOf: root.appendingPathComponent("stores/data.json")) == original)
        #expect(await document.diagnostics().projectionWrites == before.projectionWrites)
        #expect(await document.diagnostics().publications == before.publications + 5)
        let reads = await document.diagnostics().materializations
        for _ in 0..<5 { _ = try await document.frame() }
        #expect(await document.diagnostics().materializations == reads)
        // Abrupt owner shutdown: no flush; reopen must recover committed edits.
        await document.shutDown()
        let reopened = try SlopLoroDocument(root: root, schema: listSchema, initial: rows([row("a")]))
        #expect(try await reopened.frame().data == rows([row("a", "5")]))
        try await reopened.flush()
        #expect(await reopened.diagnostics().projectionWrites == 1)
        let publication = try await reopened.frame().publication
        try await reopened.flush()
        #expect(try await reopened.frame().publication == publication)
        #expect(await reopened.diagnostics().projectionWrites == 1)
        try await reopened.close()
    }

    @Test func otherOwnersAndExternalEditsDoNotGetOverwrittenByScheduledProjection() async throws {
        let root = try optimizationRoot()
        defer { try? FileManager.default.removeItem(at: root) }
        let a = try SlopLoroDocument(root: root, schema: listSchema, initial: rows([row("a")]))
        await a.configureProjectionTiming(quiet: .seconds(10), maximum: .seconds(10))
        try await a.flush()
        let url = root.appendingPathComponent("stores/data.json")
        var external = try SlopDocumentJSON(data: Data(contentsOf: url))
        let b = try SlopLoroDocument(root: root, schema: listSchema, initial: rows([row("a")]))
        await b.configureProjectionTiming(quiet: .seconds(10), maximum: .seconds(10))
        try await write(a, sequence: 1, text: "local")
        // The external editor adds a row using the original file's base revision.
        external["data"] = rows([row("a"), row("external")])
        try external.encoded().write(to: url, options: .atomic)
        try await b.refreshExternal()
        #expect(try await b.frame().data == rows([row("a", "local"), row("external")]))
        try await a.flush()
        let expected = try await b.frame().data
        #expect(try SlopDocumentJSON(data: Data(contentsOf: url))["data"] == expected)
        let invalid = Data("not json".utf8)
        try invalid.write(to: url, options: .atomic)
        try await a.refreshExternal()
        #expect(try await a.frame().projectionError != nil)
        try await a.flush()
        #expect(try Data(contentsOf: url) == invalid)
        await a.shutDown(); await b.shutDown()
    }

    @Test func scheduledProjectionHonorsMaximumDelayAndCloseDrains() async throws {
        let root = try optimizationRoot()
        defer { try? FileManager.default.removeItem(at: root) }
        let document = try SlopLoroDocument(root: root, schema: listSchema, initial: rows([row("a")]))
        await document.configureProjectionTiming(quiet: .seconds(10), maximum: .milliseconds(80))
        try await document.flush()
        try await write(document, sequence: 1, text: "one")
        let deadline = ContinuousClock.now.advanced(by: .seconds(3))
        while try await document.frame().dirty, ContinuousClock.now < deadline {
            // Filesystem refreshes must not restart the maximum-delay clock.
            try await document.refreshExternal()
            try await Task.sleep(for: .milliseconds(10))
        }
        #expect(try await !document.frame().dirty)
        try await write(document, sequence: 2, text: "two")
        try await document.close()
        #expect(try SlopDocumentJSON(data: Data(contentsOf: root.appendingPathComponent("stores/data.json")))["data"] == rows([row("a", "two")]))
    }
}

import Foundation
import HitSlopFeatures
import Testing
@testable import HitSlopCatalog

private actor ScanProbe {
    let started = AsyncStream<Int>.makeStream()
    private var pending: [Int: CheckedContinuation<LocalTemplateSnapshot, Never>] = [:]
    private(set) var calls = 0
    func scan(_ url: URL) async -> LocalTemplateSnapshot {
        calls += 1
        let id = calls
        return await withCheckedContinuation { continuation in
            pending[id] = continuation
            started.continuation.yield(id)
        }
    }
    func finish(_ id: Int, issues: [String]) { pending.removeValue(forKey: id)?.resume(returning: LocalTemplateSnapshot(issues: issues)) }
}

@Test @MainActor func localRefreshesCoalesceAndPublishOneCompletedSnapshot() async {
    let probe = ScanProbe()
    let store = LocalTemplateStore(templatesURL: URL(fileURLWithPath: "/nonexistent/hitslop-test"), scan: { await probe.scan($0) })
    let first = Task { await store.refresh() }
    let second = Task { await store.refresh() }
    for await _ in probe.started.stream { break }
    #expect(await probe.calls == 1)
    #expect(store.snapshot.issues.isEmpty)
    await probe.finish(1, issues: ["Completed together"])
    await first.value
    await second.value
    #expect(store.snapshot.templates.isEmpty)
    #expect(store.snapshot.issues == ["Completed together"])
    store.stop()
}

@Test @MainActor func stoppingLocalSubscriptionRejectsLateNonCooperativeScan() async {
    let probe = ScanProbe()
    let store = LocalTemplateStore(templatesURL: URL(fileURLWithPath: "/nonexistent/hitslop-test"), scan: { await probe.scan($0) })
    let refresh = Task { await store.refresh() }
    for await _ in probe.started.stream { break }
    store.stop()
    await probe.finish(1, issues: ["Stale"])
    await refresh.value
    #expect(store.snapshot.issues.isEmpty)
    await store.refresh()
    #expect(await probe.calls == 1)
}

@Test @MainActor func watcherInvalidationRejectsOlderScanAndStopReleasesWatcher() async throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("hitslop-watch-\(UUID())")
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: root) }
    let probe = ScanProbe()
    let store = LocalTemplateStore(templatesURL: root, scan: { await probe.scan($0) })
    var starts = probe.started.stream.makeAsyncIterator()
    #expect(await starts.next() == 1)
    let refresh = Task { await store.refresh() }
    try Data("change".utf8).write(to: root.appendingPathComponent("event"))
    let next = try #require(await starts.next())
    #expect(next == 2)
    await probe.finish(1, issues: ["Old"])
    await probe.finish(2, issues: ["New"])
    await refresh.value
    #expect(store.issues == ["New"])
    store.stop()
    try Data("after stop".utf8).write(to: root.appendingPathComponent("another-event"))
    // Drain the main queue where watcher callbacks are delivered.
    await withCheckedContinuation { continuation in DispatchQueue.main.async { continuation.resume() } }
    #expect(await probe.calls == 2)
}

@Test func scannerCanonicalizesRecentsAndExcludesManagedMasters() async throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("hitslop-recents-\(UUID())")
    defer { try? FileManager.default.removeItem(at: root) }
    let document = try coordinatorFixture(in: root, index: 1)
    let alias = root.appendingPathComponent("alias.slop")
    try FileManager.default.createSymbolicLink(at: alias, withDestinationURL: document)
    let templates = root.appendingPathComponent("templates")
    let master = try coordinatorFixture(in: templates, index: 2)
    let entries = try await CatalogScanner().recents([alias, document, master], templatesRoot: templates)
    #expect(entries.count == 1)
    #expect(entries.first?.source == .recent(document.resolvingSymlinksInPath()))
    #expect(entries.first?.packageBytes ?? 0 > 0)
}

@Test func cancelledScannerDoesNotPublishPartialRecents() async throws {
    let gate = AsyncStream<Void>.makeStream()
    let task = Task {
        for await _ in gate.stream { break }
        return try await CatalogScanner().recents([], templatesRoot: URL(fileURLWithPath: "/tmp/templates"))
    }
    task.cancel()
    gate.continuation.finish()
    do { _ = try await task.value; Issue.record("Expected cancellation") }
    catch is CancellationError {}
}

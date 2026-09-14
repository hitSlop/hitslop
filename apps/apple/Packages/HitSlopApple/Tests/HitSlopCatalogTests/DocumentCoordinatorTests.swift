import AppKit
import ComposableArchitecture
import Foundation
import HitSlopHost
import HitSlopFeatures
import Testing
@testable import HitSlopCatalog

@Test @MainActor func coordinatorDeduplicatesNativeWindowsAndCleansUpAfterClose() async throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent("hitslop-coordinator-\(UUID())")
    defer { try? FileManager.default.removeItem(at: directory) }
    let first = try coordinatorFixture(in: directory, index: 1)
    let second = try coordinatorFixture(in: directory, index: 2)
    let alias = directory.appendingPathComponent("alias.slop")
    try FileManager.default.createSymbolicLink(at: alias, withDestinationURL: first)
    let coordinator = withDependencies { $0.uuid = UUIDGenerator { UUID() } } operation: {
        SlopApplicationCoordinator(catalogURL: URL(string: "https://example.invalid")!, templatesURL: directory.appendingPathComponent("templates"), presentsWindows: false)
    }
    coordinator.openDocument(first)
    coordinator.openDocument(alias)
    coordinator.openDocument(second)
    try await waitForCoordinator { coordinator.documentControllers.count == 2 && coordinator.store.documents.allSatisfy { !$0.isOpening } }
    var controller = coordinator.documentControllers.first { $0.packageURL == first.standardizedFileURL }
    #expect(controller != nil)
    try await controller?.session.waitUntilReady()
    let other = try #require(coordinator.documentControllers.first { $0 !== controller })
    try await other.session.waitUntilReady()
    let id = try #require(coordinator.store.documents.first { $0.url == first.standardizedFileURL }?.id)
    controller?.runtimeSession(controller!.session, didFail: NSError(domain: "Fixture", code: 1, userInfo: [NSLocalizedDescriptionKey: "Runtime stopped"]))
    try await waitForCoordinator { controller?.isShowingRuntimeFailure == true }
    #expect(coordinator.store.documents[id: id]?.runtimeError == "Runtime stopped")
    coordinator.store.send(.documents(.element(id: id, action: .command(.retry))))
    try await waitForCoordinator { controller?.isShowingRuntimeFailure == false && coordinator.store.documents[id: id]?.operation == nil }
    try await controller?.session.waitUntilReady()

    let isSessionReleased = { [weak session = controller?.session] in session == nil }
    coordinator.store.send(.documents(.element(id: id, action: .command(.pin(true)))))
    try await waitForCoordinator { coordinator.store.documents[id: id]?.isPinned == true }
    #expect(controller?.isPinned == true)
    controller?.close()
    controller = nil
    try await waitForCoordinator { coordinator.documentControllers.count == 1 && coordinator.store.documents.count == 1 }
    #expect(coordinator.documentControllers.first === other)
    try await waitForCoordinator(isSessionReleased)
    let otherID = try #require(coordinator.store.documents.first?.id)
    coordinator.store.send(.documents(.element(id: otherID, action: .command(.close))))
    try await waitForCoordinator { coordinator.store.documents.isEmpty && coordinator.documentControllers.isEmpty }
    await SlopDocumentWindowController.finishAssetRefreshesForTermination()
}

@MainActor func waitForCoordinator(_ predicate: () -> Bool) async throws {
    let deadline = ContinuousClock.now.advanced(by: .seconds(15))
    while !predicate(), ContinuousClock.now < deadline { try await Task.sleep(for: .milliseconds(10)) }
    #expect(predicate())
}

func coordinatorFixture(in directory: URL, index: Int) throws -> URL {
    let root = directory.appendingPathComponent("fixture-\(index).slop")
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    let manifest = #"{"$schema":"https://api.hitslop.com/schemas/v1/manifest.schema.json","author":{"name":"Native test"},"slug":"fixture-\#(index)","title":"Fixture \#(index)","description":"Disposable fixture","categories":["utilities"],"presentation":{"width":380,"height":280,"resizable":true}}"#
    try Data(manifest.utf8).write(to: root.appendingPathComponent("manifest.json"))
    try Data("<!doctype html><body style='font:20px system-ui;background:#f0ecff'><h1>Fixture</h1><p>Native state measurement</p><script>window.slop.ready()</script></body>".utf8).write(to: root.appendingPathComponent("app.html"))
    return root.standardizedFileURL
}

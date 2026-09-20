import Foundation
import Testing
@testable import HitSlopRuntime

struct TeardownTests {
  private func directory() throws -> URL {
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("teardown-\(UUID())")
    try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    return url
  }

  @Test func storageCloseReleasesRetainedHandleAndRejectsUse() throws {
    let root = try directory()
    defer { try? FileManager.default.removeItem(at: root) }
    let storage = try SlopCommandStorage(root: root)
    defer { storage.engine.close() }
    try storage.transaction {
      #expect(throws: SlopDocumentError.self) { try storage.close() }
      #expect(!storage.isClosed)
    }
    try storage.close()
    try storage.close()
    #expect(storage.isClosed)
    #expect(throws: SlopDocumentError.self) { try storage.load() }
    #expect(throws: SlopDocumentError.self) { try storage.backup(to: root.appendingPathComponent("copy.sqlite")) }
  }

  @Test func documentShutdownClosesSQLiteBeforeOwnerIsReleased() async throws {
    let root = try directory()
    defer { try? FileManager.default.removeItem(at: root) }
    let document = try SlopCommandDocument(root: root,
      schema: #"{"type":"object","properties":{"count":{"type":"integer"}},"required":["count"],"additionalProperties":true,"x-hitslop":{"version":1,"container":"map"}}"#,
      initial: #"{"count":1}"#)
    try await document.close()
    try await document.close()
    #expect(await document.databaseIsClosed)
    await #expect(throws: SlopDocumentError.self) { try await document.frame() }
    // Retain the actor while deleting its files: teardown must not rely on deinit.
    try FileManager.default.removeItem(at: root)
    #expect(await document.databaseIsClosed)
  }

  @Test @MainActor func preparationSuspendsWithoutBlockingMainActor() async throws {
    let gate = DispatchSemaphore(value: 0)
    let started = AsyncStream<Void>.makeStream()
    let work = Task {
      try await SlopPreparation.run {
        started.continuation.yield(())
        // A finite fallback makes a UI-thread regression fail instead of hanging.
        let released = gate.wait(timeout: .now() + 3) == .success
        return (!Thread.isMainThread, released)
      }
    }
    for await _ in started.stream { break }
    gate.signal()
    let (offMain, releasedByMain) = try await work.value
    #expect(offMain)
    #expect(releasedByMain)
    started.continuation.finish()
  }
}

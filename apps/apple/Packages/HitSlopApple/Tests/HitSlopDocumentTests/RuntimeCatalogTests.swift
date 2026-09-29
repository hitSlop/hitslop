import Foundation
import HitSlopCore
import Testing
@testable import HitSlopDocument

@Suite(.serialized) struct RuntimeCatalogTests {
  func fixture() throws -> URL {
    let repository = String(#filePath.components(separatedBy: "/apps/apple/")[0])
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".slop")
    try FileManager.default.copyItem(atPath: repository + "/tests/compatibility/4-1/document", toPath: root.path)
    return root
  }

  @Test @MainActor func rejectedRequirementsDoNotCreateStorage() throws {
    let root = try fixture()
    defer { try? FileManager.default.removeItem(at: root) }
    let requirements = root.appendingPathComponent("assets/runtime.json")
    let original = try #require(try JSONSerialization.jsonObject(with: Data(contentsOf: requirements)) as? [String: Any])
    let invalid: [Any?] = [nil, "malformed", [:],
      original.merging(["runtimeContract": 99]) { _, b in b },
      original.merging(["minRuntimeRevision": 999999]) { _, b in b },
      original.merging(["runtimeContract": true]) { _, b in b },
      original.merging(["minRuntimeRevision": 1.5]) { _, b in b },
      original.merging(["runtimeContract": "1"]) { _, b in b },
      original.merging(["minRuntimeRevision": 0]) { _, b in b }]
    for value in invalid {
      if let value {
        try JSONSerialization.data(withJSONObject: value, options: [.fragmentsAllowed]).write(to: requirements)
      } else { try FileManager.default.removeItem(at: requirements) }
      #expect(throws: (any Error).self) { _ = try DocumentSession(package: SlopPackage(rootURL: root)) }
      #expect(!FileManager.default.fileExists(atPath: root.appendingPathComponent("state").path))
    }
  }

  @Test @MainActor func cancelledPreparedOpenReleasesOwnership() async throws {
    let root = try fixture()
    defer { try? FileManager.default.removeItem(at: root) }
    let prepared = try await DocumentSession.prepare(packageURL: root)
    #expect(throws: (any Error).self) { _ = try DocumentWriterLock(root: root) }
    // Preparation has acquired the actual lease. This actor cannot start the
    // child until after cancellation, so no shared queue or scheduling guess is needed.
    let opening = Task { @MainActor in
      try await DocumentSession.finishOpening(prepared)
    }
    opening.cancel()
    await #expect(throws: CancellationError.self) { try await opening.value }
    let ownership = try DocumentWriterLock(root: root)
    ownership.close()
    let reopened = try await DocumentSession.open(packageURL: root)
    try await reopened.close()
  }

  // Entry/module failures previously escaped the runtime's catch. Known load
  // errors must report promptly and release the failed-open renderer and lease.
  @Test @MainActor func brokenRuntimeResourcesReleaseFailedOpen() async throws {
    do {
      for resource in ["boot.js", "index.js"] {
        let root = try fixture()
        let runtimes = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer {
          try? FileManager.default.removeItem(at: root)
          try? FileManager.default.removeItem(at: runtimes)
        }
        let runtime = runtimes.appendingPathComponent("4")
        try FileManager.default.createDirectory(at: runtimes, withIntermediateDirectories: true)
        try FileManager.default.copyItem(at: RuntimeCatalog.bundled().currentRuntime, to: runtime)
        let session = try DocumentSession(package: SlopPackage(rootURL: root), catalog: RuntimeCatalog(root: runtimes))
        try FileManager.default.removeItem(at: runtime.appendingPathComponent(resource))
        weak var view = session.webView
        session.load()
        do {
          try await session.waitUntilReady(timeout: .seconds(3))
          Issue.record("Broken runtime became ready: \(resource)")
        } catch {
          #expect(!error.localizedDescription.contains("did not become ready"))
        }
        #expect(session.failureClassification == .platform)
        #expect(view == nil)
        let ownership = try DocumentWriterLock(root: root)
        ownership.close()
        try await session.close()
      }
    }
  }

  @Test @MainActor func asyncOpenRejectsBusyOwnershipAndUnsupportedRuntime() async throws {
    let root = try fixture()
    defer { try? FileManager.default.removeItem(at: root) }
    let owner = try await DocumentSession.open(packageURL: root)
    await #expect(throws: (any Error).self) { try await DocumentSession.open(packageURL: root) }
    try await owner.close()
    let invalid = try fixture()
    defer { try? FileManager.default.removeItem(at: invalid) }
    var requirements = try #require(try JSONSerialization.jsonObject(
      with: Data(contentsOf: invalid.appendingPathComponent("assets/runtime.json"))) as? [String: Any])
    requirements["runtimeContract"] = 99
    try JSONSerialization.data(withJSONObject: requirements).write(to: invalid.appendingPathComponent("assets/runtime.json"))
    await #expect(throws: (any Error).self) { try await DocumentSession.open(packageURL: invalid) }
    #expect(!FileManager.default.fileExists(atPath: invalid.appendingPathComponent("state").path))
  }

  @Test func contractSelectsBackingDirectoryAndIgnoresProvenance() throws {
    let root = try fixture()
    let catalogRoot = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer {
      try? FileManager.default.removeItem(at: root)
      try? FileManager.default.removeItem(at: catalogRoot)
    }
    let bundled = try RuntimeCatalog.bundled()
    for contract in [4] {
      let directory = catalogRoot.appendingPathComponent(String(contract))
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      try FileManager.default.createDirectory(at: directory.appendingPathComponent("core"), withIntermediateDirectories: true)
      for path in ["index.js", "boot.js", "core/hitslop_core_wasm.js", "core/hitslop_core_wasm_bg.wasm"] {
        try Data("contract-\(contract)".utf8).write(to: directory.appendingPathComponent(path))
      }
      var identity = bundled.identities.last!
      identity["runtimeContract"] = contract
      identity["runtimeRevision"] = 3
      try JSONSerialization.data(withJSONObject: identity).write(to: directory.appendingPathComponent("identity.json"))
    }
    let catalog = try RuntimeCatalog(root: catalogRoot)
    for contract in [4] {
      let requirements: [String: Any] = ["runtimeContract": contract, "minRuntimeRevision": 2,
        "sdkVersion": "99.0.0", "loroVersion": "99.0.0", "protocolVersion": 99]
      try JSONSerialization.data(withJSONObject: requirements).write(to: root.appendingPathComponent("assets/runtime.json"))
      let selected = try catalog.resolve(package: SlopPackage(rootURL: root))
      #expect(try String(contentsOf: selected.appendingPathComponent("index.js"), encoding: .utf8) == "contract-\(contract)")
    }
  }
}

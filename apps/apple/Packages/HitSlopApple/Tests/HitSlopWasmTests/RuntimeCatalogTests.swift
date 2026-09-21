import Foundation
import HitSlopCore
import Testing
@testable import HitSlopWasm

@Suite(.serialized) struct RuntimeCatalogTests {
  func fixture() throws -> URL {
    let repository = String(#filePath.components(separatedBy: "/apps/apple/")[0])
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".slop")
    try FileManager.default.copyItem(atPath: repository + "/generated/v1/templates/Checklist.slop", toPath: root.path)
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
      #expect(throws: (any Error).self) { _ = try WasmSession(package: SlopPackage(rootURL: root), headless: true) }
      #expect(!FileManager.default.fileExists(atPath: root.appendingPathComponent("state").path))
    }
  }

  @Test func contractSelectsBackingDirectoryAndIgnoresProvenance() throws {
    let root = try fixture()
    let catalogRoot = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer {
      try? FileManager.default.removeItem(at: root)
      try? FileManager.default.removeItem(at: catalogRoot)
    }
    let bundled = try RuntimeCatalog.bundled()
    for contract in [1, 2] {
      let directory = catalogRoot.appendingPathComponent(String(contract))
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      try FileManager.default.createDirectory(at: directory.appendingPathComponent("loro"), withIntermediateDirectories: true)
      for path in ["index.js", "headless.js", "loro/index.js", "loro/loro_wasm_bg.wasm"] {
        try Data("contract-\(contract)".utf8).write(to: directory.appendingPathComponent(path))
      }
      var identity = bundled.identities.last!
      identity["runtimeContract"] = contract
      identity["runtimeRevision"] = 3
      try JSONSerialization.data(withJSONObject: identity).write(to: directory.appendingPathComponent("identity.json"))
    }
    let catalog = try RuntimeCatalog(root: catalogRoot)
    for contract in [1, 2] {
      let requirements: [String: Any] = ["runtimeContract": contract, "minRuntimeRevision": 2,
        "sdkVersion": "99.0.0", "loroVersion": "99.0.0", "protocolVersion": 99]
      try JSONSerialization.data(withJSONObject: requirements).write(to: root.appendingPathComponent("assets/runtime.json"))
      let selected = try catalog.resolve(package: SlopPackage(rootURL: root))
      #expect(try String(contentsOf: selected.appendingPathComponent("index.js"), encoding: .utf8) == "contract-\(contract)")
    }
  }
}

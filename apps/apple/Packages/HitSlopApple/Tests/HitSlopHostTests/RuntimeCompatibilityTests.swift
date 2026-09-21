import AppKit
import Foundation
import HitSlopCore
import HitSlopRuntime
import PDFKit
import Testing
@testable import HitSlopHost
@testable import HitSlopWasm

extension LoroClientTests {
  @Test @MainActor func preservedDocumentsSurviveCurrentHostAndRuntime() async throws {
    _ = NSApplication.shared
    let repository = String(#filePath.components(separatedBy: "/apps/apple/")[0])
    let fixtures = URL(fileURLWithPath: repository + "/tests/compatibility")
    let entries = try FileManager.default.contentsOfDirectory(at: fixtures, includingPropertiesForKeys: nil)
      .filter { FileManager.default.fileExists(atPath: $0.appendingPathComponent("fixture.json").path) }
    #expect(!entries.isEmpty)
    for fixture in entries {
      let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".slop")
      defer { try? FileManager.default.removeItem(at: root) }
      try FileManager.default.copyItem(at: fixture.appendingPathComponent("document"), to: root)
      let expected = try #require(try JSONSerialization.jsonObject(with: Data(contentsOf: fixture.appendingPathComponent("expected.json"))) as? NSDictionary)
      let baseline = try await DocumentCommand.run(method: "get", url: root)
      #expect(try JSONSerialization.jsonObject(with: baseline) as? NSDictionary == expected)
      let controller = try await SlopDocumentWindowController.open(packageURL: root)
      try await controller.session.waitUntilReady()
      _ = try await controller.session.webView.callAsyncJavaScript(
        "document.querySelector('#edit').click(); await globalThis.__slop.flush(); return true",
        arguments: [:], in: nil, contentWorld: .page)
      let edited = try #require(try JSONSerialization.jsonObject(with: await DocumentCommand.run(method: "get", url: root)) as? [String: Any])
      #expect(edited["title"] as? String == "Edited 🦊 café")
      #expect(edited["note"] == nil)
      #expect(edited["status"] as? String == "done")
      let meta = try #require(edited["meta"] as? [String: Any])
      #expect(meta["amount"] as? Double == 7.5)
      #expect(meta["enabled"] as? Bool == false)
      let before = try #require(expected["rows"] as? [[String: Any]])
      let after = try #require(edited["rows"] as? [[String: Any]])
      #expect(after.map { $0["$id"] as? String } == before.reversed().map { $0["$id"] as? String })
      #expect(after.last?["label"] as? String == "changed")
      // Exercise the preserved text-binding adapter and its draft flush boundary.
      _ = try await controller.session.webView.callAsyncJavaScript(
        "const input=document.querySelector('input'); input.value='Draft 🦊'; input.dispatchEvent(new Event('input',{bubbles:true})); return true",
        arguments: [:], in: nil, contentWorld: .page)
      let draft = try #require(try JSONSerialization.jsonObject(with: await DocumentCommand.run(method: "get", url: root)) as? [String: Any])
      #expect(draft["title"] as? String == "Draft 🦊")
      _ = try await DocumentCommand.run(method: "apply", url: root, operation: replace("Live command"))
      _ = try await DocumentCommand.run(method: "theme.set", url: root, themeValues: Data(##"{"accent":"#654321"}"##.utf8))
      _ = try await DocumentCommand.run(method: "compact", url: root)
      try await controller.session.finish()
      _ = try await DocumentCommand.run(method: "apply", url: root, operation: replace("Closed command"))
      _ = try await DocumentCommand.run(method: "compact", url: root)
      _ = try await DocumentCommand.run(method: "apply", url: root, operation: replace("Candidate update"))
      let saved = try await DocumentCommand.run(method: "get", url: root)
      let session = try await SlopRuntimeSession.open(packageURL: root)
      session.load()
      try await session.waitUntilReady()
      #expect(try await DocumentCommand.run(method: "get", url: root) == saved)
      let png = try await SlopRenderer.exportPNGData(session: session)
      #expect(NSBitmapImageRep(data: png) != nil)
      let pdf = try await SlopRenderer.exportPDFData(session: session)
      #expect((PDFDocument(data: pdf)?.pageCount ?? 0) > 0)
      try await session.closeAndWait()

      // A document keeps its minimum revision after new writes. Its historical
      // reader must therefore still understand candidate checkpoints and updates.
      let release = try #require(try JSONSerialization.jsonObject(with: Data(contentsOf: fixture.appendingPathComponent("fixture.json"))) as? [String: Any])
      let contract = try #require(release["runtimeContract"] as? Int)
      let published = try #require(try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: repository + "/runtimes/releases.json"))) as? [[String: Any]])
      let minimum = try #require(release["runtimeRevision"] as? Int)
      for entry in published where entry["runtimeContract"] as? Int == contract && (entry["runtimeRevision"] as? Int ?? 0) >= minimum {
        let revision = try #require(entry["runtimeRevision"] as? Int)
        let bundled = try RuntimeCatalog.bundled()
        let current = bundled.identities.first { $0["runtimeContract"] as? Int == contract }
        let historical: RuntimeCatalog
        if current?["runtimeRevision"] as? Int == revision {
          historical = bundled
        } else {
          historical = try RuntimeCatalog(root: URL(fileURLWithPath: repository + "/generated/v1/runtime-releases/\(contract)-\(revision)"))
        }
        let reader = try WasmSession(package: SlopPackage(rootURL: root), headless: true, catalog: historical)
        reader.load()
        try await reader.waitUntilReady()
        let reply = await reader.request(["id": "historical", "method": "get", "documentPath": root.path])
        #expect(reply["ok"] as? Bool == true)
        #expect(reply["state"] as? NSDictionary == (try JSONSerialization.jsonObject(with: saved) as? NSDictionary))
        try await reader.close()
      }
    }
  }
}

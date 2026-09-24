import AppKit
import Foundation
import HitSlopCore
import HitSlopRuntime
import PDFKit
import Testing

@testable import HitSlopHost
@testable import HitSlopWasm

extension LoroClientTests {
  @Test @MainActor func executableExportsLiveSelectionAndClosedDefaultView() async throws {
    _ = NSApplication.shared
    let root = try captureFixture()
    let folder = root.deletingLastPathComponent().appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    defer {
      try? FileManager.default.removeItem(at: root)
      try? FileManager.default.removeItem(at: folder)
    }
    let controller = try await SlopDocumentWindowController.open(packageURL: root)
    try await controller.session.waitUntilReady()
    controller.window?.setContentSize(CGSize(width: 560, height: 620))
    let view = controller.session.webView
    let originalSize = view.frame.size
    _ = try await view.callAsyncJavaScript(
      """
      const input = document.querySelector('#draft');
      input.dispatchEvent(new CompositionEvent('compositionstart'));
      input.value = 'CLI export pending title';
      input.dispatchEvent(new InputEvent('input', {bubbles:true, isComposing:true}));
      globalThis.selectedView = 'Selected view';
      return true;
      """, arguments: [:], in: nil, contentWorld: .page)
    let pdf = folder.appendingPathComponent("live.pdf")
    let png = folder.appendingPathComponent("live.png")
    for (format, output) in [("pdf", pdf), ("png", png)] {
      let result = try await cli(["export", root.path, "--format", format, "--output", output.path])
      #expect(result.0 == 0, "\(result.2)")
      #expect(result.1.trimmingCharacters(in: .whitespacesAndNewlines) == output.path)
    }
    let text = try #require(PDFDocument(data: Data(contentsOf: pdf))?.string)
    #expect(text.contains("Selected view"))
    #expect(text.contains("CLI export pending title"))
    #expect(NSImage(data: try Data(contentsOf: png)) != nil)
    #expect(view.frame.size == originalSize)
    #expect(
      try NSBitmapImageRep(data: Data(contentsOf: png))?.pixelsWide == Int(originalSize.width * 2))
    #expect(
      try await view.evaluateJavaScript(
        "globalThis.selectedView === 'Selected view'")
        as? Bool == true)
    #expect(
      try await view.evaluateJavaScript(
        "[...document.querySelectorAll('[data-slop-capture-target]')].every(e=>e.hidden && e.childElementCount===0)"
      ) as? Bool == true)
    let previous = try Data(contentsOf: pdf)
    _ = try await view.callAsyncJavaScript(
      "const {capture}=await import('/__runtime__/index.js');globalThis.stopFailure=capture.onPrepare(()=>{throw new Error('intentional capture failure')});return true",
      arguments: [:], in: nil, contentWorld: .page)
    let failed = try await cli(["export", root.path, "--format", "pdf", "--output", pdf.path])
    #expect(failed.0 != 0)
    #expect(try Data(contentsOf: pdf) == previous)
    #expect(controller.session.engine.capturing == false)
    _ = try await view.evaluateJavaScript("globalThis.stopFailure()")
    let rejected = try await cli([
      "export", root.path, "--format", "pdf", "--output",
      root.appendingPathComponent("bad.pdf").path,
    ])
    #expect(rejected.0 != 0)
    try await controller.session.finish()
    let saved = try Data(contentsOf: root.appendingPathComponent("state/document.sqlite"))
    let closed = folder.appendingPathComponent("closed.pdf")
    let result = try await cli(["export", root.path, "--format", "pdf", "--output", closed.path])
    #expect(result.0 == 0, "\(result.2)")
    #expect(
      PDFDocument(data: try Data(contentsOf: closed))?.string?.contains("Selected view") == false)
    #expect(try Data(contentsOf: root.appendingPathComponent("state/document.sqlite")) == saved)
  }

  @Test @MainActor func removedRetryFlagsAndUnavailableOwnersFailSafely() async throws {
    _ = NSApplication.shared
    let root = try fixture()
    defer { try? FileManager.default.removeItem(at: root) }
    let op = String(decoding: try replace("must not apply"), as: UTF8.self)
    let incomplete = try await cli(["apply", root.path, "--op", op, "--id", "original"])
    #expect(incomplete.0 != 0)
    #expect(incomplete.2.contains("Unknown"))
    #expect(!FileManager.default.fileExists(atPath: root.appendingPathComponent("state").path))
    let controller = try await SlopDocumentWindowController.open(packageURL: root)
    try await controller.session.waitUntilReady()
    let old = try await cli(["apply", root.path, "--op", op, "--id", "original", "--epoch", "old"])
    #expect(old.0 != 0)
    #expect(!old.2.contains("Retry identity:"))
    try await controller.session.finish()
    let ended = try await cli([
      "apply", root.path, "--op", op, "--id", "original", "--epoch", "old",
    ])
    #expect(ended.0 != 0)
    let lock = try DocumentWriterLock(root: root)
    defer { lock.close() }
    let output = root.deletingLastPathComponent().appendingPathComponent(UUID().uuidString + ".pdf")
    defer { try? FileManager.default.removeItem(at: output) }
    let busy = try await cli(["export", root.path, "--format", "pdf", "--output", output.path])
    #expect(busy.0 != 0)
    #expect(busy.2.contains("busy"))
    #expect(!FileManager.default.fileExists(atPath: output.path))
  }

  @Test @MainActor func oldRuntimeFailsBeforeCreatingState() async throws {
    let root = try fixture()
    defer { try? FileManager.default.removeItem(at: root) }
    let url = root.appendingPathComponent("manifest.json")
    var manifest = try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as! [String: Any]
    manifest["runtime"] = "old-runtime"
    try JSONSerialization.data(withJSONObject: manifest).write(to: url)
    await #expect(throws: (any Error).self) {
      try await DocumentCommand.run(method: "get", url: root)
    }
    #expect(!FileManager.default.fileExists(atPath: root.appendingPathComponent("state").path))
  }

  @Test @MainActor func headlessDoesNotLoadAuthoredCode() async throws {
    let root = try fixture()
    defer { try? FileManager.default.removeItem(at: root) }
    try Data(
      "<script>webkit.messageHandlers.storage.postMessage({method:'failed',error:'AUTHORED CODE RAN'})</script>"
        .utf8
    ).write(to: root.appendingPathComponent("app.html"))
    let data = try await DocumentCommand.run(
      method: "apply", url: root, operation: replace("Engine only"))
    #expect(String(decoding: data, as: UTF8.self).contains("Engine only"))
  }
}

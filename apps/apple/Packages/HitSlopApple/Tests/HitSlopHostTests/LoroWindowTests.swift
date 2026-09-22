import AppKit
import Foundation
import HitSlopCore
import HitSlopRuntime
import PDFKit
import Testing

@testable import HitSlopHost
@testable import HitSlopWasm

extension LoroClientTests {
  @Test @MainActor func bundledExamplesRenderInNativeWindows() async throws {
    _ = NSApplication.shared
    for name in ["quick-checklist", "small-expenses"] {
      let root = try fixture(name)
      defer { try? FileManager.default.removeItem(at: root) }
      let controller = try await SlopDocumentWindowController.open(packageURL: root)
      try await controller.session.waitUntilReady()
      #expect(controller.window?.styleMask.contains(.titled) == false)
      controller.showWindow(nil)
      await controller.waitForPresentation()
      let panel = try #require(
        NSApp.windows.first { $0 !== controller.window && controller.owns($0) })
      let entered = try #require(
        NSEvent.enterExitEvent(
          with: .mouseEntered, location: .zero, modifierFlags: [], timestamp: 0,
          windowNumber: controller.window!.windowNumber, context: nil, eventNumber: 1,
          trackingNumber: 1, userData: nil))
      controller.window?.contentView?.mouseEntered(with: entered)
      #expect(panel.isVisible)
      panel.orderOut(nil)
      #expect(try await controller.session.webView.evaluateJavaScript("document.body.innerText.trim().length > 0") as? Bool == true)
      _ = try await DocumentCommand.run(method: "apply", url: root, operation: replace("abcXYZ"))
      let live = try await DocumentCommand.run(method: "get", url: root)
      #expect(String(decoding: live, as: UTF8.self).contains("abcXYZ"))
      _ = try await DocumentCommand.run(
        method: "apply", url: root, operation: replace("Native socket edit"))
      let png = try await SlopRenderer.exportPNGData(session: controller.session)
      let pdf = try await SlopRenderer.exportPDFData(session: controller.session)
      #expect(NSImage(data: png) != nil)
      #expect(PDFDocument(data: pdf)?.string?.contains("Native socket edit") == true)
      #expect(controller.session.engine.capturing == false)
      let duplicate = root.deletingLastPathComponent().appendingPathComponent(
        UUID().uuidString + ".slop")
      defer { try? FileManager.default.removeItem(at: duplicate) }
      try SlopDuplicator.duplicate(from: root, to: duplicate)
      #expect(
        !FileManager.default.fileExists(
          atPath: duplicate.appendingPathComponent("state/host.lock").path))
      #expect(
        String(
          decoding: try await DocumentCommand.run(method: "get", url: duplicate), as: UTF8.self
        ).contains("Native socket edit"))
      try await controller.session.finish()
      controller.window?.orderOut(nil)
      _ = try await DocumentCommand.run(
        method: "apply", url: root, operation: replace("Closed WASM edit"))
      #expect(
        String(decoding: try await DocumentCommand.run(method: "get", url: root), as: UTF8.self)
          .contains("Closed WASM edit"))
    }
  }
}

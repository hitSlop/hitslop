import AppKit
import Foundation
import HitSlopCore
import Testing
@testable import HitSlopHost

extension LoroClientTests {
  @Test(.enabled(if: ProcessInfo.processInfo.environment["HITSLOP_STARTUP_BENCH"] == "1"))
  @MainActor func documentStartupTimings() async throws {
    _ = NSApplication.shared
    for name in ["quick-checklist", "small-expenses"] {
      for sample in 0..<3 {
        let root = try fixture(name)
        defer { try? FileManager.default.removeItem(at: root) }
        let start = ContinuousClock.now
        let controller = try await SlopDocumentWindowController.open(packageURL: root)
        let prepared = start.duration(to: .now)
        controller.showWindow(nil)
        try await controller.session.waitUntilReady()
        let ready = start.duration(to: .now)
        await controller.waitForPresentation()
        let visible = start.duration(to: .now)
        print("[startup benchmark] \(name) sample=\(sample) prepared=\(prepared) ready=\(ready) visible=\(visible)")
        // Keep this benchmark focused on opening, without background preview refreshes.
        try await controller.session.finish()
        controller.close()
      }
    }
  }

  @Test @MainActor func openingStaysHiddenUntilReadyAndHandsOffFocus() async throws {
    _ = NSApplication.shared
    let root = try fixture()
    defer { try? FileManager.default.removeItem(at: root) }
    let previewURL = root.appendingPathComponent("QuickLook/Preview.png")
    let before = try Data(contentsOf: previewURL)
    let controller = try await SlopDocumentWindowController.open(packageURL: root)
    controller.showWindow(nil)
    #expect(controller.isLoading)
    #expect(controller.window?.isVisible == false)
    controller.revealFromDock()
    #expect(controller.window?.isVisible == false)
    await controller.waitForPresentation()
    #expect(controller.session.isReady)
    #expect(controller.openingProgress == nil)
    #expect(controller.window?.isVisible == true)
    #expect(controller.isContentReady)
    #expect(try Data(contentsOf: previewURL) == before)
    try await controller.session.finish()
    controller.close()
  }

  @Test @MainActor func previewIsNotNeededAndCloseCancelsHiddenOpening() async throws {
    _ = NSApplication.shared
    for invalid in [false, true] {
      let root = try fixture()
      defer { try? FileManager.default.removeItem(at: root) }
      let preview = root.appendingPathComponent("QuickLook/Preview.png")
      if invalid { try Data("not an image".utf8).write(to: preview) }
      else { try FileManager.default.removeItem(at: preview) }
      let controller = try await SlopDocumentWindowController.open(packageURL: root)
      controller.showWindow(nil)
      #expect(controller.window?.isVisible == false)
      weak var webView = controller.session.webView
      _ = try await controller.perform(.close)
      await controller.waitForPresentation()
      #expect(controller.openingProgress == nil)
      #expect(controller.window?.isVisible == false)
      #expect(!controller.session.isReady)
      // WebKit can finish asynchronous cancellation on the next run-loop turn.
      for _ in 0..<100 where webView != nil { try await Task.sleep(for: .milliseconds(10)) }
      #expect(webView == nil)
    }
  }

  @Test @MainActor func startupFailureRevealsNativeError() async throws {
    _ = NSApplication.shared
    let root = try fixture()
    defer { try? FileManager.default.removeItem(at: root) }
    let script = root.appendingPathComponent("assets/main.js")
    let original = try Data(contentsOf: script)
    try Data("await webkit.messageHandlers.storage.postMessage({method:'failed',error:'startup fixture failure'});".utf8)
      .write(to: root.appendingPathComponent("assets/main.js"))
    let controller = try await SlopDocumentWindowController.open(packageURL: root)
    var failures: [String] = []
    controller.showWindow(nil)
    controller.onRuntimeFailure = {
      failures.append($0)
      controller.updatePresentation(pinned: false, commandsEnabled: true, runtimeError: $0)
    }
    await controller.waitForPresentation()
    #expect(controller.openingProgress == nil)
    #expect(controller.window?.isVisible == true)
    #expect(failures.count == 1)
    #expect(failures.first?.contains("startup fixture failure") == true)
    controller.onRuntimeFailure = nil
    try original.write(to: script)
    _ = try await controller.perform(.retry)
    #expect(controller.window?.isVisible == false)
    await controller.waitForPresentation()
    #expect(controller.isContentReady)
    #expect(controller.window?.isVisible == true)
    try await controller.session.finish()
    controller.close()
  }

  @Test @MainActor func hiddenOpenDoesNotPresentProgressOrDocument() async throws {
    _ = NSApplication.shared
    let root = try fixture()
    defer { try? FileManager.default.removeItem(at: root) }
    let controller = try await SlopDocumentWindowController.open(packageURL: root)
    await controller.waitForPresentation()
    #expect(controller.isContentReady)
    #expect(controller.window?.isVisible == false)
    #expect(controller.openingProgress == nil)
    try await controller.session.finish()
    controller.close()
  }

  @Test @MainActor func progressCancelClosesPendingDocumentWithoutRevealingIt() async throws {
    _ = NSApplication.shared
    let root = try fixture()
    defer { try? FileManager.default.removeItem(at: root) }
    let script = root.appendingPathComponent("assets/main.js")
    let original = try String(contentsOf: script, encoding: .utf8)
    try Data(("Object.defineProperty(document,'fonts',{value:{status:'loading'}});\n" + original).utf8).write(to: script)
    let controller = try await SlopDocumentWindowController.open(packageURL: root, presentsWindow: true)
    try await controller.session.waitUntilReady()
    let progress = try #require(controller.openingProgress)
    progress.cancelOpening()
    for _ in 0..<200 where controller.isLoading { try await Task.sleep(for: .milliseconds(10)) }
    #expect(!controller.isLoading)
    #expect(!controller.isContentReady)
    #expect(controller.window?.isVisible == false)
    #expect(controller.openingProgress == nil)
    #expect(FileManager.default.fileExists(atPath: root.path))
    // A cancelled document must release ownership, not merely hide its window.
    let reopened = try await SlopDocumentWindowController.open(packageURL: root)
    _ = try await reopened.perform(.close)
  }

  @Test @MainActor func closeDuringFontLoadingCancelsPresentationAndExport() async throws {
    _ = NSApplication.shared
    let root = try fixture()
    let output = root.deletingLastPathComponent().appendingPathComponent(UUID().uuidString + ".png")
    defer {
      try? FileManager.default.removeItem(at: root)
      try? FileManager.default.removeItem(at: output)
    }
    let script = root.appendingPathComponent("assets/main.js")
    let original = try String(contentsOf: script, encoding: .utf8)
    try Data(("Object.defineProperty(document,'fonts',{value:{status:'loading',ready:new Promise(()=>{})}});\n" + original).utf8).write(to: script)
    let controller = try await SlopDocumentWindowController.open(packageURL: root)
    try await controller.session.waitUntilReady()
    controller.showWindow(nil)
    for _ in 0..<200 where controller.openingProgress?.panel == nil {
      try await Task.sleep(for: .milliseconds(10))
    }
    #expect(controller.openingProgress?.panel?.isVisible == true)
    #expect(controller.window?.isVisible == false)
    weak var view = controller.session.webView
    let export = Task { try await controller.exportDocument(format: .png, to: output) }
    await Task.yield()
    _ = try await controller.perform(.close)
    await #expect(throws: (any Error).self) { try await export.value }
    #expect(!FileManager.default.fileExists(atPath: output.path))
    #expect(controller.openingProgress == nil)
    for _ in 0..<100 where view != nil { try await Task.sleep(for: .milliseconds(10)) }
    #expect(view == nil)
  }
}

@Test @MainActor func openingProgressIsDelayedAndFastCompletionNeverShowsIt() async throws {
  _ = NSApplication.shared
  let fast = SlopOpeningProgress()
  #expect(fast.panel == nil)
  fast.finish()
  let start = ContinuousClock.now
  let slow = SlopOpeningProgress()
  #expect(slow.panel == nil)
  for _ in 0..<500 where slow.panel == nil {
    try await Task.sleep(for: .milliseconds(10))
  }
  #expect(start.duration(to: .now) >= .milliseconds(300))
  #expect(fast.panel == nil)
  #expect(slow.panel?.isVisible == true)
  var cancelled = false
  slow.onCancel = { cancelled = true }
  slow.cancelOpening()
  #expect(cancelled)
  #expect(slow.panel == nil)
}

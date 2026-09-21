import AppKit
import Foundation
import HitSlopCore
import HitSlopRuntime
import PDFKit
import Testing

@testable import HitSlopHost
@testable import HitSlopWasm

extension LoroClientTests {
  @Test @MainActor func themeOverridesSurviveReloadDuplicateAndClosedEditing() async throws {
    _ = NSApplication.shared
    let root = try fixture()
    defer { try? FileManager.default.removeItem(at: root) }
    let controller = try await SlopDocumentWindowController.open(packageURL: root)
    try await controller.session.waitUntilReady()
    let epoch = controller.session.engine.epoch
    _ = try await DocumentCommand.run(
      method: "apply", url: root, operation: replace("Preserved through interface reload"))
    _ = try await controller.session.webView.callAsyncJavaScript(
      "dispatchEvent(new ErrorEvent('error', {error:new Error('Test application failure')})); return true",
      arguments: [:], in: nil, contentWorld: .page)
    for _ in 0..<40 where controller.window?.attachedSheet == nil {
      try await Task.sleep(for: .milliseconds(25))
    }
    let issueSheet = try #require(controller.window?.attachedSheet)
    _ = try await DocumentCommand.run(
      method: "apply", url: root, operation: replace("Preserved through interface reload"))
    #expect(controller.window?.attachedSheet === issueSheet)
    controller.window?.endSheet(issueSheet, returnCode: .alertSecondButtonReturn)
    issueSheet.orderOut(nil)
    let values = try JSONSerialization.data(withJSONObject: ["accent": "#123456"])
    let theme = try await DocumentCommand.run(method: "theme.set", url: root, themeValues: values)
    #expect(String(decoding: theme, as: UTF8.self).contains("#123456"))
    let css = try await controller.session.webView.callAsyncJavaScript(
      "return getComputedStyle(document.documentElement).getPropertyValue('--slop-accent').trim()",
      arguments: [:], in: nil, contentWorld: .page)
    #expect(css as? String == "#123456")
    await #expect(throws: (any Error).self) {
      _ = try await DocumentCommand.run(
        method: "theme.set", url: root, themeValues: Data("{\"unknown\":\"red\"}".utf8))
    }
    try await controller.session.engine.reloadInterface()
    #expect(controller.session.engine.epoch == epoch)
    let state = try await DocumentCommand.run(method: "get", url: root)
    #expect(String(decoding: state, as: UTF8.self).contains("Preserved through interface reload"))
    let duplicate = root.deletingLastPathComponent().appendingPathComponent(
      UUID().uuidString + ".slop")
    defer { try? FileManager.default.removeItem(at: duplicate) }
    try SlopDuplicator.duplicate(from: root, to: duplicate)
    #expect(
      try Data(contentsOf: root.appendingPathComponent("state/theme.json"))
        == Data(contentsOf: duplicate.appendingPathComponent("state/theme.json")))
    try await controller.session.finish()
    let reopened = try await DocumentCommand.run(method: "theme.get", url: root)
    #expect(reopened == theme)
    _ = try await DocumentCommand.run(method: "theme.reset", url: root, themeToken: "accent")
    let reset = try await DocumentCommand.run(method: "theme.get", url: root)
    #expect(!String(decoding: reset, as: UTF8.self).contains("#123456"))
  }

  @Test @MainActor func committedWriteSurvivesRendererDeathBeforeAcknowledgement() async throws {
    _ = NSApplication.shared
    let root = try fixture()
    defer { try? FileManager.default.removeItem(at: root) }
    let controller = try await SlopDocumentWindowController.open(packageURL: root)
    try await controller.session.waitUntilReady()
    let engine = controller.session.engine
    let epoch = engine.epoch
    weak var oldWebView = engine.webView
    let pid = try #require(engine.webView.value(forKey: "_webProcessIdentifier") as? Int32)
    engine.storageReplyForTesting = { _ in
      engine.storageReplyForTesting = nil
      Darwin.kill(pid, SIGKILL)
      return true
    }
    await #expect(throws: (any Error).self) {
      _ = try await DocumentCommand.run(
        method: "apply", url: root, operation: replace("Committed before renderer death"))
    }
    for _ in 0..<200 where !engine.rendererDead { try await Task.sleep(for: .milliseconds(25)) }
    #expect(engine.rendererDead)
    #expect(
      !FileManager.default.fileExists(atPath: root.appendingPathComponent("state/host.lock").path))
    #expect(throws: (any Error).self) { _ = try DocumentWriterLock(root: root) }
    _ = try await controller.perform(.retry)
    #expect(engine.epoch != epoch)
    #expect(oldWebView == nil)
    let bytes = try await DocumentCommand.run(method: "get", url: root)
    #expect(String(decoding: bytes, as: UTF8.self).contains("Committed before renderer death"))
    try await controller.session.finish()
    try await controller.session.finish()
    #expect(
      !FileManager.default.fileExists(atPath: root.appendingPathComponent("state/host.lock").path))
    let ownership = try DocumentWriterLock(root: root)
    ownership.close()
  }

  @Test @MainActor func lostAppendReplyIsRecoveredByGetWithoutReplayingIntent() async throws {
    _ = NSApplication.shared
    let root = try fixture()
    defer { try? FileManager.default.removeItem(at: root) }
    let controller = try await SlopDocumentWindowController.open(packageURL: root)
    try await controller.session.waitUntilReady()
    let engine = controller.session.engine
    engine.storageReplyForTesting = { _ in
      engine.storageReplyForTesting = nil
      return true
    }
    await #expect(throws: (any Error).self) {
      _ = try await DocumentCommand.run(
        method: "apply", url: root, operation: replace("Lost reply"))
    }
    let bytes = try await DocumentCommand.run(method: "get", url: root)
    #expect(String(decoding: bytes, as: UTF8.self).contains("Lost reply"))
    try await controller.session.finish()
    let reopened = try await DocumentCommand.run(method: "get", url: root)
    #expect(reopened == bytes)
  }

  @Test @MainActor func failedSaveRetainsOwnershipAndRendererDeathReleasesOnClose() async throws {
    let root = try fixture()
    defer { try? FileManager.default.removeItem(at: root) }
    let controller = try await SlopDocumentWindowController.open(packageURL: root)
    try await controller.session.waitUntilReady()
    controller.session.engine.onStatus = nil  // suppress sheets in this failure harness
    controller.session.engine.onError = nil
    controller.session.engine.failWritesForTesting = true
    do {
      _ = try await DocumentCommand.run(
        method: "apply", url: root, operation: replace("Recovered edit"))
      Issue.record("Injected write succeeded")
    } catch { #expect(error.localizedDescription.contains("Run slop get")) }
    do {
      try await controller.session.finish()
      Issue.record("Failed save allowed close")
    } catch {}
    controller.session.engine.failWritesForTesting = false
    try await controller.session.flush()
    let pid = try #require(
      controller.session.webView.value(forKey: "_webProcessIdentifier") as? Int32)
    #expect(pid > 0)
    if pid > 0 { #expect(Darwin.kill(pid, SIGKILL) == 0) }
    for _ in 0..<100 where !controller.session.engine.rendererDead {
      try await Task.sleep(for: .milliseconds(30))
    }
    #expect(controller.session.engine.rendererDead)
    try await controller.prepareToClose()
    try await controller.session.finish()
    controller.window?.orderOut(nil)
    #expect(
      String(decoding: try await DocumentCommand.run(method: "get", url: root), as: UTF8.self)
        .contains("Recovered edit"))
  }
}

extension LoroClientTests {
  @Test @MainActor func saveTelemetryReportsOneFailureUntilRecovery() async throws {
    let root = try fixture()
    defer { try? FileManager.default.removeItem(at: root) }
    let controller = try await SlopDocumentWindowController.open(packageURL: root)
    try await controller.session.waitUntilReady()
    var events: [SlopTelemetryEvent] = []
    controller.telemetry = SlopTelemetry { events.append($0) }
    // Status reporting is separate from the existing real failed-save/ownership test.
    let failed = WasmSaveStatus(status: "save-failed", error: nil)
    controller.runtimeSession(controller.session, saveStatus: failed)
    controller.runtimeSession(controller.session, saveStatus: failed)
    #expect(events == [.failed(.save)])
    controller.runtimeSession(controller.session, saveStatus: WasmSaveStatus(status: "saved", error: nil))
    controller.runtimeSession(controller.session, saveStatus: failed)
    #expect(events == [.failed(.save), .failed(.save)])
    try await controller.session.finish()
  }
}

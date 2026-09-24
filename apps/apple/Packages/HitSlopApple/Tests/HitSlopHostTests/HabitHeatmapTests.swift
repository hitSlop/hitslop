import AppKit
import Foundation
import HitSlopCore
import HitSlopRuntime
import PDFKit
import Testing
import WebKit

@testable import HitSlopHost
@testable import HitSlopWasm

extension LoroClientTests {
  @Test(.enabled(if: ProcessInfo.processInfo.environment["HITSLOP_TEMPLATE_INTEGRATION"] == "1")) @MainActor func habitHeatmapEditsReopensDuplicatesAndExports() async throws {
    _ = NSApplication.shared
    NSApp.setActivationPolicy(.regular)
    NSApp.activate(ignoringOtherApps: true)
    let root = try fixture("habit-heatmap")
    defer { try? FileManager.default.removeItem(at: root) }
    let controller = try await SlopDocumentWindowController.open(packageURL: root)
    controller.showWindow(nil)
    try await controller.session.waitUntilReady()
    await controller.waitForPresentation()
    let view = controller.session.webView
    func js(_ script: String) async throws -> Any? {
      try await view.callAsyncJavaScript(script, arguments: [:], in: nil, contentWorld: .page)
    }
    func waitFor(_ condition: String) async throws {
      for _ in 0..<200 {
        if try await js("return !!(\(condition))") as? Bool == true { return }
        try await Task.sleep(for: .milliseconds(25))
      }
      try await screenshot("failed")
      let body = try await js("return document.body.innerText")
      throw NSError(domain: "HabitHeatmapTests", code: 1, userInfo: [NSLocalizedDescriptionKey: "Timed out: \(condition)\n\(String(describing: body))"])
    }
    func screenshot(_ name: String, captureView: WKWebView? = nil) async throws {
      guard let directory = ProcessInfo.processInfo.environment["HITSLOP_REVIEW_DIRECTORY"] else { return }
      let snapshotView = captureView ?? view
      func js(_ script: String) async throws -> Any? {
        try await snapshotView.callAsyncJavaScript(script, arguments: [:], in: nil, contentWorld: .page)
      }
      // Test-runner windows may be occluded; WebKit can suspend animation frames.
      _ = try await js("""
        let style = document.getElementById('test-snapshot-motion');
        if (!style) { style = document.createElement('style'); style.id = 'test-snapshot-motion'; document.head.append(style); }
        style.textContent = '*{transition:none!important;animation:none!important}';
        await new Promise(r => setTimeout(r, 50)); document.body.getBoundingClientRect(); return true;
        """)
      let image = try await snapshotView.takeSnapshot(configuration: nil)
      let tiff = try #require(image.tiffRepresentation)
      let png = try #require(NSBitmapImageRep(data: tiff)?.representation(using: .png, properties: [:]))
      let folder = URL(fileURLWithPath: directory)
      try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
      try png.write(to: folder.appendingPathComponent(name + ".png"))
      let details = try await js("""
        const cell = document.querySelector('.habit-cell[data-today]');
        const dialog = document.querySelector('.habit-dialog');
        return JSON.stringify({
          cell: cell?.outerHTML,
          tone: cell && getComputedStyle(cell).getPropertyValue('--habit-tone'),
          background: cell && getComputedStyle(cell).backgroundColor,
          dialogState: dialog?.getAttribute('data-state'),
          visibility: document.visibilityState
        });
        """) as? String ?? ""
      try Data(details.utf8).write(to: folder.appendingPathComponent(name + ".json"))
    }
    func state() async throws -> [[String: Any]] {
      let data = try await DocumentCommand.run(method: "get", url: root)
      let object = try #require(try JSONSerialization.jsonObject(with: data) as? [String: Any])
      return try #require(object["habits"] as? [[String: Any]])
    }
    try await waitFor("document.querySelectorAll('.habit-grid button').length === 84")
    // Fix the local day to a Wednesday, so every test run includes future cells.
    _ = try await js("""
      const NativeDate = Date;
      window.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [2026, 8, 23, 12])); } };
      window.dispatchEvent(new Event('focus')); return true;
      """)
    try await waitFor("document.querySelector('.habit-cell[data-today]').dataset.day === '2026-09-23'")
    #expect(try await js("""
      const future = [...document.querySelectorAll('.habit-cell')].filter(cell => cell.dataset.day > '2026-09-23');
      for (const cell of future) {
        cell.click(); cell.focus();
        cell.dispatchEvent(new KeyboardEvent('keydown', {key:' ', bubbles:true}));
      }
      return future.length === 4 && future.every(cell => cell.disabled && document.activeElement !== cell);
      """) as? Bool == true)
    #expect((try await state().first?["checkins"] as? [String: Int])?.isEmpty == true)
    #expect(try await state().count == 3)
    #expect(try await js("return document.documentElement.scrollWidth <= innerWidth") as? Bool == true)
    try await screenshot("editor-initial")
    _ = try await js("document.querySelector('.habit-cell[data-today]').click(); return true")
    try await waitFor("document.querySelector('.habit-cell[data-today]').getAttribute('aria-checked') === 'true'")
    let first = try #require(try await state().first)
    let id = try #require(first["$id"] as? String)
    let checkins = try #require(first["checkins"] as? [String: Int])
    #expect(checkins.count == 1)
    _ = try await js("document.querySelector('[aria-label=\"Edit habit\"]').click(); return true")
    try await waitFor("document.querySelector('#habit-name')")
    #expect(try await js("return document.querySelectorAll('.habit-colors [data-radio-group-item]').length") as? Int == 12)
    try await screenshot("dialog")
    controller.window?.setContentSize(NSSize(width: 400, height: 620))
    try await screenshot("dialog-narrow")
    controller.window?.setContentSize(NSSize(width: 620, height: 480))
    _ = try await js("""
      const input = document.querySelector('#habit-name');
      input.value = 'Morning pages 😁'; input.dispatchEvent(new Event('input', {bubbles:true}));
      document.querySelector('.habit-colors [data-tone=periwinkle]').click();
      document.querySelector('.habit-dialog form').requestSubmit(); return true;
      """)
    try await waitFor("!document.querySelector('.habit-dialog[data-state=open]') && document.querySelector('.habit-detail h2').textContent.includes('😁')")
    // A few real toggles create review data only in this disposable document.
    _ = try await js("Array.from(document.querySelectorAll('.habit-cell:not(:disabled)')).slice(-22, -1).filter((_, i) => i % 3 === 0).forEach(cell => cell.click()); return true")
    try await screenshot("editor-typical")
    _ = try await js("document.querySelector('[aria-label=\"Add habit\"]').click(); return true")
    try await waitFor("document.querySelector('#habit-name')")
    _ = try await js("""
      const input = document.querySelector('#habit-name');
      input.value = 'Read one poem every evening, even on the very busiest days';
      input.dispatchEvent(new Event('input', {bubbles:true}));
      document.querySelector('.habit-dialog form').requestSubmit(); return true;
      """)
    try await waitFor("document.querySelectorAll('[data-tabs-trigger]').length === 4 && !document.querySelector('.habit-dialog[data-state=open]')")
    controller.window?.setContentSize(NSSize(width: 400, height: 620))
    _ = try await js("await new Promise(r => setTimeout(r, 50)); document.body.getBoundingClientRect(); return true")
    #expect(try await js("return document.documentElement.scrollWidth <= innerWidth") as? Bool == true)
    try await screenshot("editor-narrow-long-name")
    controller.window?.setContentSize(NSSize(width: 620, height: 480))
    let saved = try await state()
    #expect(saved.count == 4)
    #expect(saved.first?["$id"] as? String == id)
    #expect(saved.first?["name"] as? String == "Morning pages 😁")
    #expect(saved.first?["color"] as? String == "periwinkle")
    let png = try await SlopRenderer.exportPNGData(session: controller.session)
    let pdf = try await SlopRenderer.exportPDFData(session: controller.session)
    #expect(NSImage(data: png) != nil)
    #expect(PDFDocument(data: pdf)?.string?.contains("Read one poem") == true)
    #expect(PDFDocument(data: pdf)?.string?.contains("Walk outside") == true)
    // Export restores focus without activating a previously focused habit tab.
    #expect(try await js("return document.querySelector('.habit-detail h2').textContent") as? String == "Read one poem every evening, even on the very busiest days")
    if let directory = ProcessInfo.processInfo.environment["HITSLOP_REVIEW_DIRECTORY"] {
      try png.write(to: URL(fileURLWithPath: directory).appendingPathComponent("export.png"))
      try pdf.write(to: URL(fileURLWithPath: directory).appendingPathComponent("export.pdf"))
    }
    // Submit a final name and close before the autosave timer can run.
    _ = try await js("document.querySelector('[aria-label=\"Edit habit\"]').click(); return true")
    try await waitFor("document.querySelector('#habit-name')")
    _ = try await js("""
      const input = document.querySelector('#habit-name'); input.value = 'A poem before bed';
      input.dispatchEvent(new Event('input', {bubbles:true}));
      document.querySelector('.habit-dialog form').requestSubmit(); return true;
      """)
    try await controller.session.finish()
    controller.window?.orderOut(nil)
    let closed = try await state()
    #expect(closed.last?["name"] as? String == "A poem before bed")
    let duplicate = root.deletingLastPathComponent().appendingPathComponent(UUID().uuidString + ".slop")
    defer { try? FileManager.default.removeItem(at: duplicate) }
    try SlopDuplicator.duplicate(from: root, to: duplicate)
    let copied = try await DocumentCommand.run(method: "get", url: duplicate)
    #expect(String(decoding: copied, as: UTF8.self).contains("A poem before bed"))
    let operation = try JSONSerialization.data(withJSONObject: [
      "type": "set", "path": ["habits", ["id": id], "checkins", ["key": "2026-01-01"]], "value": 1
    ])
    _ = try await DocumentCommand.run(method: "apply", url: root, operation: operation)
    let reopened = try await SlopDocumentWindowController.open(packageURL: root)
    try await reopened.session.waitUntilReady()
    let current = try await state()
    #expect((current.first?["checkins"] as? [String: Int])?["2026-01-01"] == 1)
    #expect(current.first?["$id"] as? String == id)
    // Remove through the actual editor, checking cancellation and neighbor selection.
    func reopenedJS(_ script: String) async throws -> Any? {
      try await reopened.session.webView.callAsyncJavaScript(script, arguments: [:], in: nil, contentWorld: .page)
    }
    func settle(_ condition: String) async throws {
      for _ in 0..<200 {
        if try await reopenedJS("return !!(\(condition))") as? Bool == true { return }
        try await Task.sleep(for: .milliseconds(25))
      }
      throw NSError(domain: "HabitHeatmapTests", code: 2, userInfo: [NSLocalizedDescriptionKey: condition])
    }
    _ = try await reopenedJS("document.querySelector('.habit-edit').click(); return true")
    try await settle("document.querySelector('.habit-dialog[data-state=open] #habit-name')")
    _ = try await reopenedJS("""
      const input = document.querySelector('#habit-name'); input.value = 'Unsaved draft';
      input.dispatchEvent(new Event('input', {bubbles:true}));
      document.querySelector('.habit-remove').click(); return true;
      """)
    try await settle("document.querySelector('.habit-confirm[data-state=open]')")
    try await screenshot("remove-confirmation", captureView: reopened.session.webView)
    _ = try await reopenedJS("document.querySelector('[data-alert-dialog-cancel]').click(); return true")
    try await settle("!document.querySelector('.habit-confirm[data-state=open]')")
    #expect(try await reopenedJS("return document.querySelector('#habit-name').value") as? String == "Unsaved draft")
    #expect(try await state().count == 4)
    for remaining in stride(from: 4, through: 1, by: -1) {
      if remaining != 4 {
        // Remove the last tab next to exercise previous-neighbor fallback too.
        _ = try await reopenedJS("document.querySelectorAll('[data-tabs-trigger]')[document.querySelectorAll('[data-tabs-trigger]').length - 1].click(); return true")
        _ = try await reopenedJS("document.querySelector('.habit-edit').click(); return true")
        try await settle("document.querySelector('.habit-dialog[data-state=open] #habit-name')")
      }
      _ = try await reopenedJS("document.querySelector('.habit-remove').click(); return true")
      try await settle("document.querySelector('.habit-confirm[data-state=open]')")
      _ = try await reopenedJS("document.querySelector('.habit-remove-confirm').click(); return true")
      try await settle("document.querySelectorAll('[data-tabs-trigger]').length === \(remaining - 1) && !document.querySelector('.habit-dialog[data-state=open]')")
      #expect(try await state().count == remaining - 1)
      if remaining == 4 {
        #expect(try await reopenedJS("return document.querySelector('.habit-detail h2').textContent") as? String == "Walk outside")
        #expect(try await state().contains(where: { $0["$id"] as? String == id }) == false)
      }
    }
    try await settle("document.querySelector('.habit-empty') && document.activeElement === document.querySelector('.habit-empty button')")
    try await reopened.session.finish()
    reopened.window?.orderOut(nil)
    #expect(try await state().isEmpty)
  }
}

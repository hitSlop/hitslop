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
  @Test(.enabled(if: ProcessInfo.processInfo.environment["HITSLOP_TEMPLATE_INTEGRATION"] == "1")) @MainActor func pocketSheetEditsRecomputesExportsCSVAndReopens() async throws {
    _ = NSApplication.shared
    NSApp.setActivationPolicy(.regular)
    NSApp.activate(ignoringOtherApps: true)
    let root = try fixture("pocket-sheet")
    let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: root); try? FileManager.default.removeItem(at: folder) }
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
      let body = try await js("return document.body.innerText")
      throw NSError(domain: "PocketSheetTests", code: 1, userInfo: [NSLocalizedDescriptionKey: "Timed out: \(condition)\n\(String(describing: body))"])
    }
    func review(_ name: String) async throws {
      guard let directory = ProcessInfo.processInfo.environment["HITSLOP_REVIEW_DIRECTORY"] else { return }
      _ = try await js("""
        const style = document.getElementById('test-motion') ?? document.head.appendChild(Object.assign(document.createElement('style'), { id: 'test-motion' }));
        style.textContent = '*{transition:none!important;animation:none!important}';
        await new Promise(r => setTimeout(r, 50)); return true;
        """)
      let image = try await view.takeSnapshot(configuration: nil)
      let tiff = try #require(image.tiffRepresentation)
      let png = try #require(NSBitmapImageRep(data: tiff)?.representation(using: .png, properties: [:]))
      try FileManager.default.createDirectory(atPath: directory, withIntermediateDirectories: true)
      try png.write(to: URL(fileURLWithPath: directory).appendingPathComponent("pocket-\(name).png"))
    }
    func cells() async throws -> [String: [String: Any]] {
      let data = try await DocumentCommand.run(method: "get", url: root)
      let object = try #require(try JSONSerialization.jsonObject(with: data) as? [String: Any])
      return try #require(object["cells"] as? [String: [String: Any]])
    }
    func key(_ key: String, _ options: String = "") async throws {
      _ = try await js("""
        const target = document.activeElement ?? document.body;
        target.dispatchEvent(new KeyboardEvent('keydown', { key: \(String(reflecting: key)), bubbles: true, cancelable: true\(options) })); return true;
        """)
    }
    let value = { (cell: String) in "document.querySelector('#pocket-\(cell) .pocket-value')?.textContent" }

    try await waitFor("document.querySelectorAll('.pocket-cell').length === 72")
    try await waitFor("\(value("B9")) === '14.68'")
    #expect(try await js("return document.documentElement.scrollWidth <= innerWidth") as? Bool == true)
    try await review("initial")

    // Type a new cost into B8 with the keyboard: select, type to replace, Enter commits and moves down.
    _ = try await js("document.querySelector('#pocket-B8').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })); return true")
    try await waitFor("document.activeElement?.classList.contains('pocket-grid') && document.querySelector('.pocket-address').textContent === 'B8'")
    try await key("3")
    try await waitFor("document.activeElement?.classList.contains('pocket-cell-input')")
    #expect(try await js("return document.activeElement.value") as? String == "3")
    try await key("Enter")
    try await waitFor("\(value("B9")) === '19.57'")
    try await waitFor("document.querySelector('#pocket-B9[data-bounce]')")
    #expect(try await js("return document.querySelector('.pocket-address').textContent") as? String == "B9")

    // Formula bar edits, errors are visible, and shift-selection sums.
    _ = try await js("""
      const bar = document.querySelector('.pocket-bar-input'); bar.focus();
      bar.value = '=B6/0'; bar.dispatchEvent(new Event('input', { bubbles: true })); return true;
      """)
    try await key("Enter")
    try await waitFor("\(value("B9")) === '#DIV/0!'")
    _ = try await js("""
      document.querySelector('#pocket-B2').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
      document.querySelector('#pocket-B4').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, shiftKey: true })); return true;
      """)
    try await waitFor("document.querySelector('.pocket-sum').textContent.includes('49.75')")
    _ = try await js("document.querySelector('.pocket-crayon[data-tint=rose]').click(); return true")
    try await waitFor("document.querySelectorAll('.pocket-cell[data-tint=rose]').length === 3")
    try await review("edited")

    // Narrow windows scroll the grid inside the paper instead of the page.
    controller.window?.setContentSize(NSSize(width: 420, height: 560))
    _ = try await js("await new Promise(r => setTimeout(r, 50)); return true")
    #expect(try await js("return document.documentElement.scrollWidth <= innerWidth") as? Bool == true)
    try await review("narrow")
    controller.window?.setContentSize(NSSize(width: 700, height: 640))

    // Export CSV goes through the native save panel; only its presentation is substituted.
    var suggested: [String] = []
    let target = folder.appendingPathComponent("Pizza night.csv")
    var saved: URL?
    controller.session.engine.fileSaver = DocumentFileSaver { _, name, reply in
      suggested.append(name)
      reply(target)
      return {}
    }
    controller.session.engine.fileSaver.onSaved = { saved = $0 }
    _ = try await js("document.querySelector('.pocket-export').click(); return true")
    for _ in 0..<200 where saved == nil { try await Task.sleep(for: .milliseconds(25)) }
    #expect(suggested == ["Pizza night.csv"])
    #expect(saved == target)
    let bytes = try Data(contentsOf: target)
    #expect(bytes.starts(with: [0xEF, 0xBB, 0xBF]))  // BOM; String decoding drops it below.
    let exported = String(decoding: bytes.dropFirst(3), as: UTF8.self)
    #expect(exported.hasPrefix("Item,Cost,Paid by\r\n"))
    #expect(exported.contains("Each pays,=B6/0,\r\n"))
    #expect(exported.contains("Friends,3,\r\n"))

    let png = try await SlopRenderer.exportPNGData(session: controller.session)
    let pdf = try await SlopRenderer.exportPDFData(session: controller.session)
    #expect(NSImage(data: png) != nil)
    #expect(PDFDocument(data: pdf)?.string?.contains("Pizza night") == true)
    if let directory = ProcessInfo.processInfo.environment["HITSLOP_REVIEW_DIRECTORY"] {
      try png.write(to: URL(fileURLWithPath: directory).appendingPathComponent("pocket-export.png"))
      try exported.write(to: URL(fileURLWithPath: directory).appendingPathComponent("pocket-export.csv"), atomically: true, encoding: .utf8)
    }

    try await controller.session.finish()
    controller.window?.orderOut(nil)
    let closed = try await cells()
    #expect(closed["B8"]?["input"] as? String == "3")
    #expect(closed["B9"]?["input"] as? String == "=B6/0")
    #expect(closed["B3"]?["tint"] as? String == "rose")
    #expect(closed["C4"]?["input"] as? String == "Sam")
  }
}

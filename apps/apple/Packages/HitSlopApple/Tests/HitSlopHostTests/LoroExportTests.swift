import AppKit
import Foundation
import HitSlopCore
import HitSlopRuntime
import PDFKit
import Testing

@testable import HitSlopHost
@testable import HitSlopWasm

extension LoroClientTests {
  @Test @MainActor func expiredExportCannotPublishOutput() throws {
    let root = try fixture()
    let output = root.deletingLastPathComponent().appendingPathComponent(UUID().uuidString + ".pdf")
    defer {
      try? FileManager.default.removeItem(at: root)
      try? FileManager.default.removeItem(at: output)
    }
    let previous = Data("original".utf8)
    try previous.write(to: output)
    #expect(throws: (any Error).self) {
      try SlopRenderer.publishExport(
        Data("late capture".utf8), to: output, source: root,
        deadline: NativeCommandDeadline(timeout: .zero))
    }
    #expect(try Data(contentsOf: output) == previous)
  }

  @Test @MainActor func inlineCaptureTargetsAreLazyAndUseCurrentDocument() async throws {
    _ = NSApplication.shared
    let root = try fixture()
    defer { try? FileManager.default.removeItem(at: root) }
    let session = try await SlopRuntimeSession.open(packageURL: root)
    session.load()
    try await session.waitUntilReady()
    let view = session.webView
    let idle =
      "[...document.querySelectorAll('[data-slop-capture-target]')].every(e=>e.hidden && e.childElementCount===0)"
    #expect(try await view.evaluateJavaScript(idle) as? Bool == true)
    let initial = try await DocumentCommand.run(method: "get", url: root)
    let firstIcon = try #require(
      try await SlopRenderer.targetPNGData(session: session, target: .icon))
    let image = try #require(NSBitmapImageRep(data: firstIcon))
    #expect(image.pixelsWide == 512 && image.pixelsHigh == 512)
    #expect(image.hasAlpha)
    #expect(try await view.evaluateJavaScript(idle) as? Bool == true)
    #expect(try await DocumentCommand.run(method: "get", url: root) == initial)
    let state = try #require(try JSONSerialization.jsonObject(with: initial) as? [String: Any])
    let rows = try #require(state["tasks"] as? [[String: Any]])
    let operations = rows.map {
      ["type": "set", "path": ["tasks", ["id": $0["$id"]!], "done"], "value": true] as [String: Any]
    }
    _ = try await DocumentCommand.run(
      method: "batch", url: root, operations: JSONSerialization.data(withJSONObject: operations))
    let completedIcon = try #require(
      try await SlopRenderer.targetPNGData(session: session, target: .icon))
    #expect(completedIcon != firstIcon)
    let archiveOperations = rows.map {
      ["type": "set", "path": ["tasks", ["id": $0["$id"]!], "archived"], "value": true] as [String: Any]
    }
    _ = try await DocumentCommand.run(method: "batch", url: root, operations: JSONSerialization.data(withJSONObject: archiveOperations))
    let filed = try await DocumentCommand.run(method: "get", url: root)
    let filedState = try #require(try JSONSerialization.jsonObject(with: filed) as? [String: Any])
    let filedRows = try #require(filedState["tasks"] as? [[String: Any]])
    #expect(filedRows.count == rows.count)
    #expect(filedRows.allSatisfy { $0["archived"] as? Bool == true })
    let pdf = try await SlopRenderer.exportPDFData(session: session)
    #expect(PDFDocument(data: pdf)?.pageCount ?? 0 > 0)
    #expect(try await view.evaluateJavaScript(idle) as? Bool == true)
    #expect(try await DocumentCommand.run(method: "get", url: root) == filed)
    try await session.closeAndWait()
    let assets = try await SlopRenderer.documentAssetsPNGData(packageURL: root)
    let preview = try #require(assets.previewPNG)
    let icon = try #require(assets.finderIconPNG)
    try SlopPreviewWriter.write(preview, to: root)
    SlopPreviewWriter.installFinderIcon(icon, for: root)
    #expect(
      FileManager.default.fileExists(
        atPath: root.appendingPathComponent("QuickLook/Preview.png").path))
    #expect(FileManager.default.fileExists(atPath: root.appendingPathComponent("Icon\r").path))
    #expect(try Data(contentsOf: root.appendingPathComponent("QuickLook/Icon.png")) != icon)
  }

  @Test @MainActor func captureFailureRestoresEditorAndMissingIconIsOptional() async throws {
    _ = NSApplication.shared
    let root = try fixture("Expenses")
    defer { try? FileManager.default.removeItem(at: root) }
    let session = try await SlopRuntimeSession.open(packageURL: root)
    session.load()
    try await session.waitUntilReady()
    #expect(try await SlopRenderer.targetPNGData(session: session, target: .icon) == nil)
    _ = try await session.webView.callAsyncJavaScript(
      "const {capture}=await import('/__runtime__/index.js');globalThis.stopFailure=capture.onPrepare(()=>{throw new Error('capture test failure')});return true",
      arguments: [:], in: nil, contentWorld: .page)
    await #expect(throws: (any Error).self) {
      try await SlopRenderer.exportPNGData(session: session)
    }
    #expect(session.engine.capturing == false)
    #expect(
      try await session.webView.evaluateJavaScript(
        "!document.documentElement.hasAttribute('data-slop-capture')") as? Bool == true)
    _ = try await session.webView.evaluateJavaScript("globalThis.stopFailure()")
    #expect(NSImage(data: try await SlopRenderer.exportPNGData(session: session)) != nil)
    try await session.closeAndWait()
  }
}

extension LoroClientTests {
  @Test @MainActor func telemetryCountsCompletedExportsAndReportsFailuresWithoutDocumentValues() async throws {
    let root = try captureFixture()
    let output = root.deletingLastPathComponent().appendingPathComponent(UUID().uuidString + ".pdf")
    defer { try? FileManager.default.removeItem(at: root); try? FileManager.default.removeItem(at: output) }
    let controller = try await SlopDocumentWindowController.open(packageURL: root)
    try await controller.session.waitUntilReady()
    var events: [SlopTelemetryEvent] = []
    controller.telemetry = SlopTelemetry { events.append($0) }
    try await controller.exportDocument(format: .pdf, to: nil)
    #expect(events.isEmpty)
    try await controller.exportDocument(format: .pdf, to: output)
    #expect(PDFDocument(data: try Data(contentsOf: output)) != nil)
    #expect(events == [.exported(.pdf)])
    await #expect(throws: (any Error).self) {
      try await controller.exportDocument(format: .png, to: root.appendingPathComponent("private-name.png"))
    }
    #expect(events == [.exported(.pdf), .failed(.export)])
    try await controller.session.finish()
  }
}

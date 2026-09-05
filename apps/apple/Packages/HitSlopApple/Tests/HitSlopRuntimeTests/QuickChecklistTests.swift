#if os(macOS)
import AppKit
import Foundation
import HitSlopCore
import Testing
@testable import HitSlopRuntime

@Test(.enabled(if: ProcessInfo.processInfo.environment["HITSLOP_PILOT_PACKAGE"] != nil))
@MainActor func quickChecklistCompiledSveltePersistsAndReopens() async throws {
    let source = URL(fileURLWithPath: ProcessInfo.processInfo.environment["HITSLOP_PILOT_PACKAGE"]!)
    let parent = FileManager.default.temporaryDirectory.appendingPathComponent("hitslop-pilot-\(UUID().uuidString)")
    let document = parent.appendingPathComponent("checklist.slop")
    try FileManager.default.createDirectory(at: parent, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: parent) }
    try FileManager.default.copyItem(at: source, to: document)
    try FileManager.default.removeItem(at: document.appendingPathComponent(".agents"))
    let session = try SlopRuntimeSession(packageURL: document)
    defer { session.close() }
    session.load()
    try await session.waitUntilReady()
    if let output = ProcessInfo.processInfo.environment["HITSLOP_PILOT_OUTPUT"] {
        let image = try await session.webView.takeSnapshot(configuration: nil)
        let tiff = try #require(image.tiffRepresentation)
        let bitmap = try #require(NSBitmapImageRep(data: tiff))
        try #require(bitmap.representation(using: .png, properties: [:])).write(to: URL(fileURLWithPath: output).appendingPathComponent("live.png"))
        session.webView.setFrameSize(NSSize(width: 320, height: 620))
        _ = try await session.webView.callAsyncJavaScript("await new Promise(r => setTimeout(r, 100)); return true", arguments: [:], in: nil, contentWorld: .page)
        let narrow = try await session.webView.takeSnapshot(configuration: nil)
        let narrowTIFF = try #require(narrow.tiffRepresentation)
        let narrowBitmap = try #require(NSBitmapImageRep(data: narrowTIFF))
        try #require(narrowBitmap.representation(using: .png, properties: [:])).write(to: URL(fileURLWithPath: output).appendingPathComponent("narrow.png"))
        session.webView.setFrameSize(NSSize(width: 480, height: 620))
    }
    let info = try #require(await session.webView.callAsyncJavaScript("return await slop.info()", arguments: [:], in: nil, contentWorld: .page) as? [String: Any])
    #expect(info["protocolVersion"] as? Int == 1)
    _ = try await session.webView.evaluateJavaScript(#"""
    const input = document.querySelector('input[aria-label="New task"]');
    input.value = 'Persist this task'; input.dispatchEvent(new Event('input', {bubbles:true}));
    input.form.requestSubmit();
    const title = document.querySelector('textarea[aria-label="Checklist title"]');
    title.value = 'Saved immediately'; title.dispatchEvent(new Event('input', {bubbles:true}));
    """#)
    try await session.flush()
    _ = try await session.webView.evaluateJavaScript("Array.from(document.querySelectorAll('[data-checkbox-root]')).at(-1).click()")
    try await session.flush()
    _ = try await session.webView.evaluateJavaScript("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('File finished')).click()")
    try await session.flush()
    _ = try await session.webView.evaluateJavaScript("Array.from(document.querySelectorAll('[role=tab]')).find(b=>b.textContent.includes('Filed')).click()")
    _ = try await session.webView.callAsyncJavaScript("await new Promise(r => setTimeout(r, 100)); document.querySelector('button[aria-label=\"Restore Persist this task\"]').click(); return true", arguments: [:], in: nil, contentWorld: .page)
    try await session.flush()
    session.close()
    let jsonURL = document.appendingPathComponent("stores/data.json")
    let saved = try #require(JSONSerialization.jsonObject(with: Data(contentsOf: jsonURL)) as? [String: Any])
    #expect(saved["title"] as? String == "Saved immediately")
    #expect((saved["tasks"] as? [[String: Any]])?.contains { $0["text"] as? String == "Persist this task" } == true)
    let restored = (saved["tasks"] as? [[String: Any]])?.first { $0["text"] as? String == "Persist this task" }
    #expect(restored?["archived"] as? Bool == false)
    #expect(restored?["done"] as? Bool == false)

    let reopened = try SlopRuntimeSession(packageURL: document)
    defer { reopened.close() }
    reopened.load()
    try await reopened.waitUntilReady()
    #expect(try await reopened.webView.evaluateJavaScript("document.querySelector('textarea').value") as? String == "Saved immediately")
    var external = saved
    external["title"] = "Externally edited"
    external["futureField"] = ["keep": true]
    try JSONSerialization.data(withJSONObject: external).write(to: jsonURL, options: .atomic)
    let deadline = ContinuousClock.now.advanced(by: .seconds(4))
    var title: String?
    repeat {
        title = try await reopened.webView.evaluateJavaScript("document.querySelector('textarea').value") as? String
        if title == "Externally edited" { break }
        try await Task.sleep(for: .milliseconds(50))
    } while ContinuousClock.now < deadline
    #expect(title == "Externally edited")
    _ = try await reopened.webView.evaluateJavaScript("const t=document.querySelector('textarea');t.value='After external edit';t.dispatchEvent(new Event('input',{bubbles:true}))")
    try await reopened.flush()
    let final = try #require(JSONSerialization.jsonObject(with: Data(contentsOf: jsonURL)) as? [String: Any])
    #expect((final["futureField"] as? [String: Bool])?["keep"] == true)
    #expect(final["title"] as? String == "After external edit")
}
#endif

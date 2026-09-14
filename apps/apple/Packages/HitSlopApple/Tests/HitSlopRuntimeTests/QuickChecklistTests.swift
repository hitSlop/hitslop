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
    let savedEnvelope = try #require(JSONSerialization.jsonObject(with: Data(contentsOf: jsonURL)) as? [String: Any])
    let saved = try #require(savedEnvelope["data"] as? [String: Any])
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
    var externalEnvelope = savedEnvelope
    externalEnvelope["data"] = external
    try JSONSerialization.data(withJSONObject: externalEnvelope).write(to: jsonURL, options: .atomic)
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
    let finalEnvelope = try #require(JSONSerialization.jsonObject(with: Data(contentsOf: jsonURL)) as? [String: Any])
    let final = try #require(finalEnvelope["data"] as? [String: Any])
    #expect((final["futureField"] as? [String: Bool])?["keep"] == true)
    #expect(final["title"] as? String == "After external edit")
}
#endif

#if os(macOS)
@MainActor private final class ChecklistSyncObserver: SlopRuntimeSessionDelegate {
    var status: SlopHostError?
    var choice = "keep"
    func runtimeSession(_ session: SlopRuntimeSession, errorsChanged errors: [SlopHostError]) { self.status = errors.first }
    func runtimeSession(_ session: SlopRuntimeSession, review proposal: String, canApply: Bool) async -> String { choice }
}

@Test(.enabled(if: ProcessInfo.processInfo.environment["HITSLOP_PILOT_PACKAGE"] != nil))
@MainActor func quickChecklistVersionedImportAndNativeReview() async throws {
    let source = URL(fileURLWithPath: ProcessInfo.processInfo.environment["HITSLOP_PILOT_PACKAGE"]!)
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("checklist-sync-\(UUID()).slop")
    try FileManager.default.copyItem(at: source, to: root)
    defer { try? FileManager.default.removeItem(at: root) }
    let session = try SlopRuntimeSession(packageURL: root)
    let observer = ChecklistSyncObserver(); session.delegate = observer
    defer { session.close() }
    session.load(); try await session.waitUntilReady()
    let file = root.appendingPathComponent("stores/data.json")
    var old = try #require(JSONSerialization.jsonObject(with: Data(contentsOf: file)) as? [String: Any])
    _ = try await session.webView.evaluateJavaScript("document.querySelectorAll('[data-checkbox-root]')[1].click()")
    try await session.flush()
    var data = try #require(old["data"] as? [String: Any]); data["title"] = "Stale agent title"; old["data"] = data
    try JSONSerialization.data(withJSONObject: old).write(to: file, options: .atomic)
    let deadline = ContinuousClock.now.advanced(by: .seconds(5))
    while ContinuousClock.now < deadline {
        if try await session.webView.evaluateJavaScript("document.querySelector('textarea').value") as? String == "Stale agent title" { break }
        try await Task.sleep(for: .milliseconds(30))
    }
    try await session.flush()
    let merged = try #require(JSONSerialization.jsonObject(with: Data(contentsOf: file)) as? [String: Any])
    let mergedData = try #require(merged["data"] as? [String: Any])
    #expect(mergedData["title"] as? String == "Stale agent title")
    #expect((mergedData["tasks"] as? [[String: Any]])?[1]["done"] as? Bool == true)
    for mode in ["export", "icon"] {
        let capture = try await session.webView.callAsyncJavaScript("const size = await window.__hitslopCapture.begin('sync-poc', mode); await window.__hitslopCapture.restore('sync-poc'); return size", arguments: ["mode": mode], in: nil, contentWorld: .page)
        #expect(capture != nil)
    }
    try Data("{unfinished".utf8).write(to: file, options: .atomic)
    let reviewDeadline = ContinuousClock.now.advanced(by: .seconds(5))
    while observer.status == nil && ContinuousClock.now < reviewDeadline { try await Task.sleep(for: .milliseconds(30)) }
    let staleToken = try #require(observer.status?.revision)
    _ = try await session.webView.evaluateJavaScript("const t=document.querySelector('textarea');t.value='Saved through invalid JSON';t.dispatchEvent(new Event('input',{bubbles:true}))")
    try await session.flush()
    #expect(try String(contentsOf: file, encoding: .utf8) == "{unfinished")
    #expect(try await session.performErrorAction(id: "document", revision: staleToken, instance: observer.status!.instance) == false)
    session.close()

    let reopened = try SlopRuntimeSession(packageURL: root)
    let reopenedObserver = ChecklistSyncObserver(); reopened.delegate = reopenedObserver
    defer { reopened.close() }
    reopened.load(); try await reopened.waitUntilReady()
    #expect(try await reopened.webView.evaluateJavaScript("document.querySelector('textarea').value") as? String == "Saved through invalid JSON")
    #expect(reopenedObserver.status != nil)
    #expect(try await reopened.performErrorAction(id: "document", revision: try #require(reopenedObserver.status?.revision), instance: reopenedObserver.status!.instance))
    try await reopened.flush()
    let files = try FileManager.default.contentsOfDirectory(atPath: root.appendingPathComponent("state/journal").path)
    #expect(files.contains { $0.hasPrefix("recovery-") })
    var plain = merged; var editedData = mergedData; editedData["title"] = "Approved file title"; plain["data"] = editedData; plain["$slop"] = ["format": 1, "baseRevision": "unknown"]
    reopenedObserver.choice = "apply"
    try JSONSerialization.data(withJSONObject: plain).write(to: file, options: .atomic)
    let applyDeadline = ContinuousClock.now.advanced(by: .seconds(5))
    while reopenedObserver.status == nil && ContinuousClock.now < applyDeadline { try await Task.sleep(for: .milliseconds(30)) }
    #expect(try await reopened.performErrorAction(id: "document", revision: try #require(reopenedObserver.status?.revision), instance: reopenedObserver.status!.instance))
    #expect(try await reopened.webView.evaluateJavaScript("document.querySelector('textarea').value") as? String == "Approved file title")
}
#endif

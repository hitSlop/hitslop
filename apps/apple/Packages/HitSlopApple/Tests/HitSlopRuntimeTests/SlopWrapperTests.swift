#if os(macOS)
import Foundation
import Testing
import WebKit
@testable import HitSlopRuntime

@MainActor private final class WrapperDelegate: SlopRuntimeSessionDelegate {
    var issues: [SlopRuntimeIssue] = []
    func runtimeSession(_ session: SlopRuntimeSession, didReport issue: SlopRuntimeIssue) { issues.append(issue) }
}

@Test(.enabled(if: ProcessInfo.processInfo.environment["HITSLOP_WRAPPER_PACKAGE"] != nil))
@MainActor func slopWrapperReportsFailuresAndResetsWithoutReopeningStore() async throws {
    let source = URL(fileURLWithPath: ProcessInfo.processInfo.environment["HITSLOP_WRAPPER_PACKAGE"]!)
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("wrapper-test-\(UUID()).slop")
    try FileManager.default.copyItem(at: source, to: root)
    defer { try? FileManager.default.removeItem(at: root) }
    let session = try SlopRuntimeSession(packageURL: root), delegate = WrapperDelegate()
    session.delegate = delegate
    defer { session.close() }
    session.load()
    do { try await session.waitUntilReady() }
    catch {
        Issue.record("Wrapper failed to open: \(delegate.issues.map(\.message))")
        throw error
    }
    func run(_ js: String) async throws -> Any? {
        try await session.webView.callAsyncJavaScript(js, arguments: [:], in: nil, contentWorld: .page)
    }
    _ = try await run("window.originalStore = wrapperTest.store; document.querySelector('#increment').click(); await __hitslopFlush(); return true")
    #expect(try await session.webView.evaluateJavaScript("document.querySelector('#child-count').textContent") as? String == "1")
    _ = try await run("document.querySelector('#reject').click(); await __hitslopFlush(); await new Promise(r=>setTimeout(r,30)); return true")
    #expect(delegate.issues.contains { $0.source == .document && $0.code == "validation" })
    let revision = try await session.document?.frame().snapshot["revision"].number
    _ = try await run("const input=document.querySelector('#title'); input.focus(); input.value='Draft survives'; input.dispatchEvent(new Event('input')); wrapperTest.fail(); await new Promise(r=>setTimeout(r,50)); return true")
    #expect(delegate.issues.contains { $0.source == .render && $0.message == "Deliberate render failure" })
    let retry = try await run("return await __hitslopDocumentRecovery('render')") as? [String: Any]
    #expect(retry?["ok"] as? Bool == false)
    _ = try await run("wrapperTest.repair(); await __hitslopDocumentRecovery('render'); await new Promise(r=>setTimeout(r,30)); await __hitslopFlush(); return true")
    #expect(try await session.webView.evaluateJavaScript("originalStore === wrapperTest.store") as? Bool == true)
    #expect(try await session.webView.evaluateJavaScript("document.querySelector('#title').value") as? String == "Draft survives")
    #expect(try await session.document?.frame().snapshot["revision"].number == (revision ?? 0) + 1)
    try await session.flush()
}
#endif

#if os(macOS)
import Foundation
import Testing
@testable import HitSlopRuntime

@Test(.enabled(if: ProcessInfo.processInfo.environment["HITSLOP_INVOICE_PACKAGE"] != nil))
@MainActor func invoiceAgentFileEditWinsAndReopens() async throws {
    let source = URL(fileURLWithPath: ProcessInfo.processInfo.environment["HITSLOP_INVOICE_PACKAGE"]!)
    let parent = FileManager.default.temporaryDirectory.appendingPathComponent("hitslop-invoice-agent-\(UUID().uuidString)")
    let document = parent.appendingPathComponent("invoice.slop")
    try FileManager.default.createDirectory(at: parent, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: parent) }
    try FileManager.default.copyItem(at: source, to: document)
    let session = try SlopRuntimeSession(packageURL: document)
    defer { session.close() }
    session.load()
    try await session.waitUntilReady()
    let json = document.appendingPathComponent("stores/data.json")
    var value = try #require(JSONSerialization.jsonObject(with: Data(contentsOf: json)) as? [String: Any])
    _ = try await session.webView.evaluateJavaScript("const n=document.querySelector('input');n.value='Unsaved UI';n.dispatchEvent(new Event('input',{bubbles:true}))")
    value["number"] = "AI-INVOICE-42"
    value["futureField"] = "preserved"
    try JSONSerialization.data(withJSONObject: value).write(to: json, options: .atomic)
    let deadline = ContinuousClock.now.advanced(by: .seconds(5))
    var displayed: String?
    repeat {
        displayed = try await session.webView.evaluateJavaScript("document.querySelector('input').value") as? String
        if displayed == "AI-INVOICE-42" { break }
        try await Task.sleep(for: .milliseconds(50))
    } while ContinuousClock.now < deadline
    #expect(displayed == "AI-INVOICE-42")
    try await session.flush()
    let saved = try #require(JSONSerialization.jsonObject(with: Data(contentsOf: json)) as? [String: Any])
    #expect(saved["number"] as? String == "AI-INVOICE-42")
    #expect(saved["futureField"] as? String == "preserved")
    session.close()
    let reopened = try SlopRuntimeSession(packageURL: document)
    defer { reopened.close() }
    reopened.load()
    try await reopened.waitUntilReady()
    #expect(try await reopened.webView.evaluateJavaScript("document.querySelector('input').value") as? String == "AI-INVOICE-42")
}
#endif

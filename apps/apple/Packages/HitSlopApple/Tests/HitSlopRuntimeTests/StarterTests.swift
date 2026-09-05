#if os(macOS)
import AppKit
import Foundation
import Testing
@testable import HitSlopRuntime

@Test(.enabled(if: ProcessInfo.processInfo.environment["HITSLOP_STARTER_PACKAGE"] != nil))
@MainActor func compiledCounterStarterPersistsAndReopens() async throws {
    let source = URL(fileURLWithPath: ProcessInfo.processInfo.environment["HITSLOP_STARTER_PACKAGE"]!)
    let parent = FileManager.default.temporaryDirectory.appendingPathComponent("hitslop-starter-\(UUID().uuidString)")
    let document = parent.appendingPathComponent("counter.slop")
    try FileManager.default.createDirectory(at: parent, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: parent) }
    try FileManager.default.copyItem(at: source, to: document)
    let session = try SlopRuntimeSession(packageURL: document)
    defer { session.close() }
    session.load()
    try await session.waitUntilReady()
    _ = try await session.webView.evaluateJavaScript("document.querySelector('button[aria-label=\"Increase count\"]').click()")
    try await session.flush()
    let jsonURL = document.appendingPathComponent("stores/data.json")
    let saved = try #require(JSONSerialization.jsonObject(with: Data(contentsOf: jsonURL)) as? [String: Any])
    #expect(saved["count"] as? Int == 1)
    session.close()

    let reopened = try SlopRuntimeSession(packageURL: document)
    defer { reopened.close() }
    reopened.load()
    try await reopened.waitUntilReady()
    #expect(try await reopened.webView.evaluateJavaScript("document.querySelector('output').textContent") as? String == "1")
    try Data(#"{"count":42,"future":{"keep":true}}"#.utf8).write(to: jsonURL, options: .atomic)
    let deadline = ContinuousClock.now.advanced(by: .seconds(4))
    var count: String?
    repeat {
        count = try await reopened.webView.evaluateJavaScript("document.querySelector('output').textContent") as? String
        if count == "42" { break }
        try await Task.sleep(for: .milliseconds(50))
    } while ContinuousClock.now < deadline
    #expect(count == "42")
    _ = try await reopened.webView.evaluateJavaScript("document.querySelector('button[aria-label=\"Increase count\"]').click()")
    try await reopened.flush()
    let updated = try #require(JSONSerialization.jsonObject(with: Data(contentsOf: jsonURL)) as? [String: Any])
    #expect(updated["count"] as? Int == 43)
    #expect((updated["future"] as? [String: Bool])?["keep"] == true)
}
#endif

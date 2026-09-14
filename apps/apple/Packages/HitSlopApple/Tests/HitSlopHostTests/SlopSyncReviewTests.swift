#if os(macOS)
import AppKit
import Foundation
import Testing
@testable import HitSlopHost

@Test(.enabled(if: ProcessInfo.processInfo.environment["HITSLOP_PILOT_PACKAGE"] != nil))
@MainActor func checklistRecoveryChromeIsNative() async throws {
    let source = URL(fileURLWithPath: ProcessInfo.processInfo.environment["HITSLOP_PILOT_PACKAGE"]!)
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("checklist-review-ui-\(UUID()).slop")
    try FileManager.default.copyItem(at: source, to: root)
    defer { try? FileManager.default.removeItem(at: root) }
    let controller = try SlopDocumentWindowController(packageURL: root)
    defer {
        // Test teardown must not request a second save from an already-closed guest.
        controller.window?.delegate = nil
        controller.session.close()
        for child in controller.window?.childWindows ?? [] { child.close() }
        controller.window?.close()
    }
    try await controller.session.waitUntilReady()
    let window = try #require(controller.window)
    controller.showWindow(nil)
    try Data("{unfinished".utf8).write(to: root.appendingPathComponent("stores/data.json"), options: .atomic)
    let deadline = ContinuousClock.now.advanced(by: .seconds(15))
    while window.childWindows?.contains(where: { $0.title == "JSON file needs review" }) != true && ContinuousClock.now < deadline { try await Task.sleep(for: .milliseconds(30)) }
    let panel = try #require(window.childWindows?.first { $0.title == "JSON file needs review" })
    func buttons(_ view: NSView) -> [NSButton] { (view as? NSButton).map { [$0] } ?? view.subviews.flatMap(buttons) }
    let review = try #require(panel.contentView.flatMap { buttons($0).first { $0.title == "Review file changes" } })
    #expect(try await controller.session.webView.evaluateJavaScript("document.body.textContent.includes('Review file changes')") as? Bool == false)
    #expect(NSApplication.shared.sendAction(try #require(review.action), to: review.target, from: review))
    let sheetDeadline = ContinuousClock.now.advanced(by: .seconds(15))
    while window.attachedSheet == nil && ContinuousClock.now < sheetDeadline { try await Task.sleep(for: .milliseconds(30)) }
    let sheet = try #require(window.attachedSheet)
    let choices = sheet.contentView.map(buttons) ?? []
    #expect(choices.contains { $0.title == "Keep current document" })
    #expect(!choices.contains { $0.title == "Apply file changes" })
    let cancel = try #require(choices.first { $0.title == "Cancel" })
    cancel.performClick(nil)
    try await controller.session.flush()
}
#endif

#if os(macOS)
@Test(.enabled(if: ProcessInfo.processInfo.environment["HITSLOP_PILOT_PACKAGE"] != nil))
@MainActor func checklistHostReportsLoadAndSaveFailures() async throws {
    let source = URL(fileURLWithPath: ProcessInfo.processInfo.environment["HITSLOP_PILOT_PACKAGE"]!)
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("checklist-host-errors-\(UUID()).slop")
    try FileManager.default.copyItem(at: source, to: root)
    let journal = root.appendingPathComponent("state/journal")
    defer { try? FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: journal.path); try? FileManager.default.removeItem(at: root) }
    func close(_ controller: SlopDocumentWindowController) {
        controller.window?.delegate = nil; controller.session.close()
        for child in controller.window?.childWindows ?? [] { child.close() }
        controller.window?.close()
    }
    func panel(_ controller: SlopDocumentWindowController, title: String) async throws -> NSWindow {
        let deadline = ContinuousClock.now.advanced(by: .seconds(10))
        while ContinuousClock.now < deadline {
            if let panel = controller.window?.childWindows?.first(where: { $0.title == title }) { return panel }
            try await Task.sleep(for: .milliseconds(30))
        }
        throw NSError(domain: "HostErrorTest", code: 1, userInfo: [NSLocalizedDescriptionKey: "Missing panel: \(title)"])
    }
    let controller = try SlopDocumentWindowController(packageURL: root)
    defer { close(controller) }
    try await controller.session.waitUntilReady()
    controller.showWindow(nil)
    try FileManager.default.setAttributes([.posixPermissions: 0o500], ofItemAtPath: journal.path)
    _ = try await controller.session.webView.evaluateJavaScript("const input=document.querySelector('textarea');input.value='Retained after failure';input.dispatchEvent(new Event('input',{bubbles:true}));")
    let failed = try await panel(controller, title: "Changes could not be saved")
    try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: journal.path)
    func buttons(_ view: NSView) -> [NSButton] { (view as? NSButton).map { [$0] } ?? view.subviews.flatMap(buttons) }
    let retry = try #require(failed.contentView.flatMap { buttons($0).first { $0.title == "Retry saving" } })
    #expect(NSApplication.shared.sendAction(try #require(retry.action), to: retry.target, from: retry))
    try await controller.session.flush()
    let bytes = try Data(contentsOf: root.appendingPathComponent("stores/data.json"))
    let saved = try #require(JSONSerialization.jsonObject(with: bytes) as? [String: Any])
    #expect((saved["data"] as? [String: Any])?["title"] as? String == "Retained after failure")
    close(controller)
    try Data("invalid checkpoint".utf8).write(to: root.appendingPathComponent("state/checkpoint.loro"))
    let broken = try SlopDocumentWindowController(packageURL: root)
    defer { close(broken) }
    broken.showWindow(nil)
    _ = try await panel(broken, title: "Document could not be opened")
    #expect(try Data(contentsOf: root.appendingPathComponent("stores/data.json")) == bytes)
}
#endif

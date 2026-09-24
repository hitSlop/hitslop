import AppKit
import Foundation
import HitSlopCore
import Testing
import WebKit
@testable import HitSlopWasm

@Suite(.serialized) struct DocumentFileSaverTests {
  let repository = String(#filePath.components(separatedBy: "/apps/apple/")[0])
  let offer = """
    { const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([new Uint8Array([104,105,33])], { type: 'application/octet-stream' }));
    a.download = '../Totals: March.xlsx';
    document.body.append(a); a.click(); a.remove(); }
    """

  @Test @MainActor func blobDownloadSavesOnlyAfterConfirmationAndHonorsGuards() async throws {
    _ = NSApplication.shared
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".slop")
    try SlopDuplicator.duplicate(from: URL(fileURLWithPath: repository + "/generated/v1/templates/quick-checklist.slop"), to: root)
    let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: root); try? FileManager.default.removeItem(at: folder) }
    let engine = try WasmSession(package: SlopPackage(rootURL: root))
    let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 400, height: 500), styleMask: [.borderless], backing: .buffered, defer: false)
    window.contentView = engine.webView
    window.orderFront(nil)
    defer { window.orderOut(nil); window.contentView = nil }
    engine.load()
    try await engine.waitUntilReady()

    var names: [String] = []
    var reply: ((URL?) -> Void)?
    var saved: [URL] = []
    engine.fileSaver = DocumentFileSaver { parent, name, completion in
      #expect(parent === window)
      names.append(name)
      reply = completion
      return { completion(nil) }
    }
    engine.fileSaver.onSaved = { saved.append($0) }
    func offerAndWait() async throws {
      reply = nil
      _ = try await engine.webView.evaluateJavaScript(offer)
      for _ in 0..<100 where !engine.fileSaver.hasPendingSave { try await Task.sleep(for: .milliseconds(20)) }
    }

    // Cancelling the panel writes nothing.
    try await offerAndWait()
    #expect(engine.fileSaver.hasPendingSave)
    #expect(names == ["_Totals_ March.xlsx"])  // WebKit sanitizes first; native cleanup is defense in depth.
    reply?(nil)
    #expect(!engine.fileSaver.hasPendingSave)
    #expect(try FileManager.default.contentsOfDirectory(atPath: folder.path).isEmpty)

    // Confirming writes the bytes, replacing an existing file only once complete.
    let target = folder.appendingPathComponent("Totals.xlsx")
    try Data("old".utf8).write(to: target)
    try await offerAndWait()
    reply?(target)
    for _ in 0..<100 where saved.isEmpty { try await Task.sleep(for: .milliseconds(20)) }
    #expect(saved == [target])
    #expect(try Data(contentsOf: target) == Data("hi!".utf8))

    // Capture and disabled selection never present a panel.
    engine.capturing = true
    _ = try await engine.webView.evaluateJavaScript(offer)
    try await Task.sleep(for: .milliseconds(300))
    #expect(!engine.fileSaver.hasPendingSave)
    engine.capturing = false
    engine.allowsFileSelection = false
    _ = try await engine.webView.evaluateJavaScript(offer)
    try await Task.sleep(for: .milliseconds(300))
    #expect(!engine.fileSaver.hasPendingSave)
    engine.allowsFileSelection = true

    // Closing dismisses a pending panel.
    try await offerAndWait()
    #expect(engine.fileSaver.hasPendingSave)
    try await engine.close()
    #expect(!engine.fileSaver.hasPendingSave)
    #expect(names.count == 3)
  }

  @Test func suggestedNamesStayPlainFileNames() {
    #expect(DocumentFileSaver.filename("../../etc/passwd") == "passwd")
    #expect(DocumentFileSaver.filename("a:b\u{0}c.csv") == "a-b-c.csv")
    #expect(DocumentFileSaver.filename("...") == "Download")
    #expect(DocumentFileSaver.filename("") == "Download")
  }
}

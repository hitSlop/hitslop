import AppKit
import Foundation
import HitSlopCore
import Testing
import WebKit
@testable import HitSlopWasm

@Suite(.serialized) struct SomaAmpTests {
  let repository = String(#filePath.components(separatedBy: "/apps/apple/")[0])
  @MainActor func wait(_ engine: WasmSession, for predicate: String) async throws {
    for _ in 0..<300 {
      if try await engine.webView.callAsyncJavaScript("return !!(\(predicate))", arguments: [:], in: nil, contentWorld: .page) as? Bool == true { return }
      try await Task.sleep(for: .milliseconds(50))
    }
    let text = try await engine.webView.evaluateJavaScript("document.body.innerText")
    throw NSError(domain: "SomaAmpTests", code: 1, userInfo: [NSLocalizedDescriptionKey: "Timed out: \(predicate)\n\(String(describing: text))"])
  }
  @Test @MainActor func nativeReceiverImportsReopensResizesAndRendersAudio() async throws {
    _ = NSApplication.shared
    let source = URL(fileURLWithPath: repository + "/generated/v1/templates/soma-amp.slop")
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".slop")
    try SlopDuplicator.duplicate(from: source, to: root)
    defer { try? FileManager.default.removeItem(at: root) }
    let engine = try WasmSession(package: SlopPackage(rootURL: root))
    let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 725, height: 470), styleMask: [.borderless], backing: .buffered, defer: false)
    window.contentView = engine.webView
    window.orderFront(nil)
    defer { window.orderOut(nil); window.contentView = nil; engine.onResize = nil }
    var sizes: [CGSize] = []
    engine.onResize = { size in sizes.append(size); engine.webView.setFrameSize(size); return size }
    // Deterministic audio source exercises Webamp's real media graph and WASM visualizer
    // without making the test depend on SomaFM availability. Never installed in the app.
    engine.webView.configuration.userContentController.addUserScript(WKUserScript(source: """
      globalThis.testAudio = []; globalThis.testAnalysers = []; globalThis.testErrors = []; globalThis.testDraws = 0;
      for (const method of ['drawArrays', 'drawElements']) {
        const original = WebGL2RenderingContext.prototype[method];
        WebGL2RenderingContext.prototype[method] = function(...args) { testDraws++; return original.apply(this,args); };
      }
      addEventListener('error', e => testErrors.push(String(e.error || e.message)));
      addEventListener('unhandledrejection', e => testErrors.push(String(e.reason)));
      const count = 44100 * 10, buffer = new ArrayBuffer(44 + count * 2), v = new DataView(buffer);
      const text = (at, s) => { for (let i=0;i<s.length;i++) v.setUint8(at+i,s.charCodeAt(i)); };
      text(0,'RIFF'); v.setUint32(4,36+count*2,true); text(8,'WAVEfmt '); v.setUint32(16,16,true);
      v.setUint16(20,1,true); v.setUint16(22,1,true); v.setUint32(24,44100,true); v.setUint32(28,88200,true);
      v.setUint16(32,2,true); v.setUint16(34,16,true); text(36,'data'); v.setUint32(40,count*2,true);
      for(let i=0;i<count;i++) v.setInt16(44+i*2,Math.sin(i*2*Math.PI*440/44100)*1000,true);
      const tone = URL.createObjectURL(new Blob([buffer],{type:'audio/wav'}));
      const src = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'src');
      Object.defineProperty(HTMLMediaElement.prototype,'src',{...src,set(url){src.set.call(this,String(url).startsWith('https:')?tone:url)}});
      const media = AudioContext.prototype.createMediaElementSource;
      AudioContext.prototype.createMediaElementSource = function(audio){testAudio.push(audio); return media.call(this,audio)};
      const analyser = AudioContext.prototype.createAnalyser;
      AudioContext.prototype.createAnalyser = function(){const a=analyser.call(this); testAnalysers.push(a); return a};
      const originalFetch = fetch;
      globalThis.fetch = (url, options) => String(url).endsWith('.pls')
        ? Promise.resolve(new Response('[playlist]\\nFile1=https://test.invalid/radio\\n')) : originalFetch(url, options);
      """, injectionTime: .atDocumentStart, forMainFrameOnly: true))
    engine.load()
    try await engine.waitUntilReady()
    try await wait(engine, for: "document.querySelector('#webamp') && !document.querySelector('.soma-rail button').disabled")
    let paused = try await engine.webView.evaluateJavaScript("testAudio[0].paused")
    #expect(paused as? Bool == true)
    let skin = try Data(contentsOf: URL(fileURLWithPath: repository + "/tests/fixtures/soma-amp/base-2.91.wsz"))
    _ = try await engine.webView.callAsyncJavaScript("""
      const input = document.querySelector('input[type=file]'), transfer = new DataTransfer();
      transfer.items.add(new File([Uint8Array.from(atob(bytes), c=>c.charCodeAt(0))], 'Classic.wsz', {type:'application/zip'}));
      input.files = transfer.files; input.dispatchEvent(new Event('change',{bubbles:true})); return true;
      """, arguments: ["bytes": skin.base64EncodedString()], in: nil, contentWorld: .page)
    try await wait(engine, for: "document.querySelector('.soma-status').textContent.includes('Skin applied')")
    let saved = try await DocumentCommand.run(method: "get", url: root)
    let state = try #require(try JSONSerialization.jsonObject(with: saved) as? [String: Any])
    let ref = try #require(state["skin"] as? [String: Any])
    let id = try #require(ref["id"] as? String)
    #expect(try SlopAttachments.read(id, in: root) == skin)
    _ = try await engine.webView.callAsyncJavaScript("document.querySelector('[aria-label=\"MilkDrop visualizer\"]').click(); return true", arguments: [:], in: nil, contentWorld: .page)
    try await wait(engine, for: "document.querySelector('.soma-wide')")
    #expect(sizes.last?.width == 725)
    _ = try await engine.webView.callAsyncJavaScript("""
      document.querySelector('#play').click();
      void testAnalysers[0].context.resume(); return true;
      """, arguments: [:], in: nil, contentWorld: .page)
    try await wait(engine, for: "testAudio[0].currentTime > 0.2 && !testAudio[0].paused")
    try await wait(engine, for: "(() => { const b=new Uint8Array(testAnalysers[0].frequencyBinCount); testAnalysers[0].getByteFrequencyData(b); return Math.max(...b) > 0; })()")
    try await wait(engine, for: "document.querySelector('.gen-window canvas') && testDraws > 0")
    let errors = try await engine.webView.evaluateJavaScript("testErrors.join('\\n')")
    #expect(errors as? String == "")
    try await engine.close()
    let reopened = try WasmSession(package: SlopPackage(rootURL: root))
    defer { reopened.onResize = nil }
    reopened.onResize = { size in reopened.webView.setFrameSize(size); return size }
    reopened.load()
    try await reopened.waitUntilReady()
    try await wait(reopened, for: "document.querySelector('#webamp') && !document.querySelector('.soma-rail button:last-of-type').disabled")
    #expect(try SlopAttachments.read(id, in: root) == skin)
    try await reopened.close()
  }
  @Test @MainActor func importButtonRequestsPickerAndCancelsOnClose() async throws {
    _ = NSApplication.shared
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".slop")
    try SlopDuplicator.duplicate(from: URL(fileURLWithPath: repository + "/generated/v1/templates/soma-amp.slop"), to: root)
    defer { try? FileManager.default.removeItem(at: root) }
    let engine = try WasmSession(package: SlopPackage(rootURL: root))
    let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 275, height: 470), styleMask: [.borderless], backing: .buffered, defer: false)
    window.contentView = engine.webView
    window.orderFront(nil)
    defer { window.orderOut(nil); window.contentView = nil }
    engine.load()
    try await engine.waitUntilReady()
    try await wait(engine, for: "!document.querySelector('button[title=\"Import a classic Winamp skin\"]').disabled")
    var presentations = 0
    var selected: (([URL]?) -> Void)?
    engine.filePicker = DocumentFilePicker { parent, multiple, directories, reply in
      #expect(parent === window)
      #expect(!multiple && !directories)
      presentations += 1
      selected = reply
      return { reply(nil) }
    }
    let click = "document.querySelector('button[title=\"Import a classic Winamp skin\"]').click()"
    _ = try await engine.webView.evaluateJavaScript(click)
    for _ in 0..<100 where !engine.filePicker.hasPendingSelection { try await Task.sleep(for: .milliseconds(20)) }
    #expect(engine.filePicker.hasPendingSelection)
    #expect(presentations == 1)
    selected?(nil)
    #expect(!engine.filePicker.hasPendingSelection)
    let state = try await DocumentCommand.run(method: "get", url: root)
    let object = try #require(try JSONSerialization.jsonObject(with: state) as? [String: Any])
    #expect((object["skin"] as? [String: Any])?.isEmpty == true)
    // Complete WebKit's real upload request with a local file; only the OS panel
    // presentation is substituted because the unbundled SwiftPM runner exits there.
    _ = try await engine.webView.evaluateJavaScript(click)
    for _ in 0..<100 where !engine.filePicker.hasPendingSelection { try await Task.sleep(for: .milliseconds(20)) }
    selected?([URL(fileURLWithPath: repository + "/tests/fixtures/soma-amp/base-2.91.wsz")])
    try await wait(engine, for: "document.querySelector('.soma-status').textContent.includes('Skin applied')")
    let saved = try await DocumentCommand.run(method: "get", url: root)
    let savedObject = try #require(try JSONSerialization.jsonObject(with: saved) as? [String: Any])
    let skin = try #require(savedObject["skin"] as? [String: Any])
    let skinID = try #require(skin["id"] as? String)
    #expect(try SlopAttachments.read(skinID, in: root) == Data(contentsOf: URL(fileURLWithPath: repository + "/tests/fixtures/soma-amp/base-2.91.wsz")))
    _ = try await engine.webView.evaluateJavaScript(click)
    for _ in 0..<100 where !engine.filePicker.hasPendingSelection { try await Task.sleep(for: .milliseconds(20)) }
    selected?([URL(fileURLWithPath: repository + "/tests/fixtures/soma-amp/README.md")])
    try await wait(engine, for: "document.querySelector('.soma-error')?.textContent.includes('classic Winamp')")
    #expect(try await DocumentCommand.run(method: "get", url: root) == saved)
    engine.allowsFileSelection = false
    _ = try await engine.webView.evaluateJavaScript(click)
    #expect(!engine.filePicker.hasPendingSelection)
    engine.allowsFileSelection = true
    engine.capturing = true
    _ = try await engine.webView.evaluateJavaScript(click)
    #expect(!engine.filePicker.hasPendingSelection)
    engine.capturing = false
    _ = try await engine.webView.evaluateJavaScript(click)
    for _ in 0..<100 where !engine.filePicker.hasPendingSelection { try await Task.sleep(for: .milliseconds(20)) }
    #expect(engine.filePicker.hasPendingSelection)
    try await engine.close()
    #expect(!engine.filePicker.hasPendingSelection)
  }

  @Test @MainActor func pickerCompletesCancellationOnceAndRejectsConcurrentRequests() async throws {
    _ = NSApplication.shared
    let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 400, height: 400), styleMask: [.titled], backing: .buffered, defer: false)
    window.orderFront(nil)
    defer { window.orderOut(nil) }
    var completions = 0, rejected = 0, dismissals = 0
    var selected: (([URL]?) -> Void)?
    let picker = DocumentFilePicker { parent, multiple, directories, reply in
      #expect(parent === window)
      #expect(multiple && !directories)
      selected = reply
      return { dismissals += 1; reply(nil) }
    }
    picker.present(in: window, multiple: true, directories: false) { urls in
      #expect(urls == nil); completions += 1
    }
    #expect(picker.hasPendingSelection)
    picker.present(in: window, multiple: false, directories: false) { urls in
      #expect(urls == nil); rejected += 1
    }
    #expect(rejected == 1)
    picker.cancel()
    picker.cancel()
    selected?([URL(fileURLWithPath: "/tmp/late-selection.wsz")])
    #expect(completions == 1)
    #expect(dismissals == 1)
  }

}

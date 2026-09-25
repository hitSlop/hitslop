import AppKit
import Foundation
import HitSlopCore
import HitSlopRuntime
import PDFKit
import Testing

@testable import HitSlopHost
@testable import HitSlopWasm

// One parent suite keeps shared AppKit/WebView integration tests serialized.
@Suite(.serialized) struct LoroClientTests {
  func fixture(_ name: String = "quick-checklist") throws -> URL {
    let repository = String(#filePath.components(separatedBy: "/apps/apple/")[0])
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(
      UUID().uuidString + ".slop")
    try FileManager.default.copyItem(
      at: URL(fileURLWithPath: repository + "/generated/v1/native-fixtures/\(name).slop"), to: root)
    return root
  }

  /// Dedicated frozen contract app; disposable copies are safe for platform probes.
  func contractFixture() throws -> URL {
    let repository = String(#filePath.components(separatedBy: "/apps/apple/")[0])
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".slop")
    try FileManager.default.copyItem(atPath: repository + "/tests/compatibility/1-1/document", toPath: root.path)
    return root
  }

  func replace(_ text: String) throws -> Data {
    try JSONSerialization.data(withJSONObject: [
      "type": "text.replace", "path": ["title"], "value": text,
    ])
  }

  func cli(_ args: [String]) async throws -> (Int32, String, String) {
    let repository = String(#filePath.components(separatedBy: "/apps/apple/")[0])
    return try await Task.detached {
      let process = Process()
      process.executableURL = URL(
        fileURLWithPath: repository
          + "/apps/apple/Packages/HitSlopApple/.build/debug/hitslop-native")
      process.arguments = args
      let stdout = Pipe()
      let stderr = Pipe()
      process.standardOutput = stdout
      process.standardError = stderr
      try process.run()
      let output = stdout.fileHandleForReading.readDataToEndOfFile()
      let error = stderr.fileHandleForReading.readDataToEndOfFile()
      process.waitUntilExit()
      return (
        process.terminationStatus, String(decoding: output, as: UTF8.self),
        String(decoding: error, as: UTF8.self)
      )
    }.value
  }
}

extension LoroClientTests {
  /// Small authored app for draft/capture contracts, independent of example UI copy.
  func captureFixture() throws -> URL {
    let root = try contractFixture()
    let html = #"""
    <!doctype html><html><head><style>
    body { margin: 0; font: 18px sans-serif; }
    [data-slop-capture-target] { width: 100vw; min-height: 300px; background: white; }
    </style></head><body><input id="draft" aria-label="Draft"><section hidden data-slop-capture-target></section>
    <script type="module">
    import * as runtime from '/__runtime__/index.js';
    await runtime.initialize();
    const config = await runtime.hostCall({method:'config'});
    const definition = runtime.fromDescriptor(await (await fetch('/state.schema.json')).json());
    const doc = await runtime.Document.open(definition, new runtime.HostStore(), await (await fetch('/initial.json')).json());
    const session = new runtime.Session(doc, config.epoch, await runtime.openTheme(true));
    const input = document.querySelector('#draft');
    const binding = runtime.bindText(input, doc.fields.title);
    globalThis.selectedView = 'Default view';
    const target = document.querySelector('[data-slop-capture-target]');
    runtime.capture.registerTarget('export', {
      element: target,
      prepare() {
        target.hidden = false;
        const heading = document.createElement('h1'); heading.textContent = doc.current.title;
        const selection = document.createElement('p'); selection.textContent = globalThis.selectedView;
        target.replaceChildren(heading, selection);
      },
      restore() { target.hidden = true; target.replaceChildren(); }
    });
    globalThis.__slop = {
      request: request => session.handle(request),
      flush: () => session.flush(),
      prepareClose: () => session.prepareClose(),
      cancelClose: () => session.cancelClose(),
      close: async () => { binding.destroy(); await session.close(); },
      captureBegin: async token => { await session.flush(); return runtime.captureController().begin(token, 'export'); },
      captureRestore: token => runtime.captureController().restore(token)
    };
    doc.subscribe(() => { void runtime.hostCall({method:'status',status:doc.status,error:doc.error}).catch(()=>{}); });
    await runtime.hostCall({method:'ready'});
    </script></body></html>
    """#
    // The native CSP permits packaged scripts, never inline executable code.
    let scriptStart = html.range(of: "<script type=\"module\">")!
    let scriptEnd = html.range(of: "</script>")!
    let script = String(html[scriptStart.upperBound..<scriptEnd.lowerBound])
    let packagedHTML = html.replacingCharacters(in: scriptStart.lowerBound..<scriptEnd.upperBound,
      with: "<script type=\"module\" src=\"/assets/capture-fixture.js\"></script>")
    try Data(script.utf8).write(to: root.appendingPathComponent("assets/capture-fixture.js"))
    try Data(packagedHTML.utf8).write(to: root.appendingPathComponent("app.html"))
    return root
  }
}

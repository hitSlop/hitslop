import AppKit
import Foundation
import PDFKit
import Testing
import HitSlopCore
import HitSlopRuntime
@testable import HitSlopHost
@testable import HitSlopWasm

@Suite(.serialized) struct LoroClientTests {
  private func fixture(_ name:String = "Checklist") throws -> URL {
    let repository = String(#filePath.components(separatedBy:"/apps/apple/")[0])
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".slop")
    try FileManager.default.copyItem(at:URL(fileURLWithPath:repository + "/generated/v1/templates/\(name).slop"),to:root)
    return root
  }
  private func replace(_ text:String) throws -> Data {
    try JSONSerialization.data(withJSONObject:["type":"text.replace","path":["title"],"value":text])
  }
  @Test @MainActor func realWindowLiveCLIExportAndClosedCLI() async throws {
    _ = NSApplication.shared
    for name in ["Checklist","Expenses"] {
      let root = try fixture(name)
      defer { try? FileManager.default.removeItem(at:root) }
      let controller = try await SlopDocumentWindowController.open(packageURL:root)
      try await controller.session.waitUntilReady()
      #expect(controller.window?.styleMask.contains(.titled) == false)
      controller.showWindow(nil)
      let panel = try #require(NSApp.windows.first { $0 !== controller.window && controller.owns($0) })
      let entered = try #require(NSEvent.enterExitEvent(with:.mouseEntered,location:.zero,modifierFlags:[],timestamp:0,windowNumber:controller.window!.windowNumber,context:nil,eventNumber:1,trackingNumber:1,userData:nil))
      controller.window?.contentView?.mouseEntered(with:entered)
      #expect(panel.isVisible)
      panel.orderOut(nil)
      _ = try await controller.session.webView.callAsyncJavaScript("const input=document.querySelector('textarea[aria-label=\"Checklist title\"],input');for (const value of ['abcX','abcXY','abcXYZ']) {input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}))} await globalThis.__slop.flush();return true",arguments:[:],in:nil,contentWorld:.page)
      let live = try await DocumentCommand.run(method:"get",url:root)
      #expect(String(decoding:live,as:UTF8.self).contains("abcXYZ"))
      _ = try await DocumentCommand.run(method:"apply",url:root,operation:replace("Native socket edit"))
      let png = try await SlopRenderer.exportPNGData(session:controller.session)
      let pdf = try await SlopRenderer.exportPDFData(session:controller.session)
      #expect(NSImage(data:png) != nil)
      #expect(PDFDocument(data:pdf)?.string?.contains("Native socket edit") == true)
      #expect(controller.session.engine.capturing == false)
      let duplicate = root.deletingLastPathComponent().appendingPathComponent(UUID().uuidString + ".slop")
      defer { try? FileManager.default.removeItem(at:duplicate) }
      try SlopDuplicator.duplicate(from:root,to:duplicate)
      #expect(!FileManager.default.fileExists(atPath:duplicate.appendingPathComponent("state/host.lock").path))
      #expect(String(decoding:try await DocumentCommand.run(method:"get",url:duplicate),as:UTF8.self).contains("Native socket edit"))
      try await controller.session.finish()
      controller.window?.orderOut(nil)
      _ = try await DocumentCommand.run(method:"apply",url:root,operation:replace("Closed WASM edit"))
      #expect(String(decoding:try await DocumentCommand.run(method:"get",url:root),as:UTF8.self).contains("Closed WASM edit"))
    }
  }
  private func cli(_ args: [String]) async throws -> (Int32, String, String) {
    let repository = String(#filePath.components(separatedBy: "/apps/apple/")[0])
    return try await Task.detached {
      let process = Process()
      process.executableURL = URL(fileURLWithPath: repository + "/apps/apple/Packages/HitSlopApple/.build/debug/hitslop-native")
      process.arguments = args
      let stdout = Pipe(), stderr = Pipe()
      process.standardOutput = stdout; process.standardError = stderr
      try process.run()
      let output = stdout.fileHandleForReading.readDataToEndOfFile()
      let error = stderr.fileHandleForReading.readDataToEndOfFile()
      process.waitUntilExit()
      return (process.terminationStatus, String(decoding: output, as: UTF8.self), String(decoding: error, as: UTF8.self))
    }.value
  }

  @Test @MainActor func executableExportsLiveSelectionAndClosedDefaultView() async throws {
    _ = NSApplication.shared
    let root = try fixture()
    let folder = root.deletingLastPathComponent().appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: root); try? FileManager.default.removeItem(at: folder) }
    let controller = try await SlopDocumentWindowController.open(packageURL: root)
    try await controller.session.waitUntilReady()
    controller.window?.setContentSize(CGSize(width: 560, height: 620))
    let view = controller.session.webView
    let originalSize = view.frame.size
    _ = try await view.callAsyncJavaScript("""
      const input = document.querySelector('textarea');
      input.value = 'CLI export pending title'; input.dispatchEvent(new Event('input', {bubbles:true}));
      document.querySelector('[role=checkbox]').click();
      [...document.querySelectorAll('button')].find(b=>b.textContent.includes('File finished')).click();
      await new Promise(resolve=>setTimeout(resolve,0));
      [...document.querySelectorAll('[role=tab]')].find(b=>b.textContent.includes('Filed')).click();
      return true;
      """, arguments: [:], in: nil, contentWorld: .page)
    let pdf = folder.appendingPathComponent("live.pdf"), png = folder.appendingPathComponent("live.png")
    for (format, output) in [("pdf", pdf), ("png", png)] {
      let result = try await cli(["export", root.path, "--format", format, "--output", output.path])
      #expect(result.0 == 0, "\(result.2)")
      #expect(result.1.trimmingCharacters(in: .whitespacesAndNewlines) == output.path)
    }
    let text = try #require(PDFDocument(data: Data(contentsOf: pdf))?.string)
    #expect(text.contains("Filed tasks"))
    #expect(text.contains("CLI export pending title"))
    #expect(NSImage(data: try Data(contentsOf: png)) != nil)
    #expect(view.frame.size == originalSize)
    #expect(try NSBitmapImageRep(data: Data(contentsOf: png))?.pixelsWide == Int(originalSize.width * 2))
    #expect(try await view.evaluateJavaScript("document.querySelector('[role=tab][aria-selected=true]').textContent.includes('Filed')") as? Bool == true)
    #expect(try await view.evaluateJavaScript("[...document.querySelectorAll('[data-slop-capture-target]')].every(e=>e.hidden && e.childElementCount===0)") as? Bool == true)
    let previous = try Data(contentsOf: pdf)
    _ = try await view.callAsyncJavaScript("const {capture}=await import('/__runtime__/index.js');globalThis.stopFailure=capture.onPrepare(()=>{throw new Error('intentional capture failure')});return true", arguments:[:],in:nil,contentWorld:.page)
    let failed = try await cli(["export",root.path,"--format","pdf","--output",pdf.path])
    #expect(failed.0 != 0)
    #expect(try Data(contentsOf: pdf) == previous)
    #expect(controller.session.engine.capturing == false)
    _ = try await view.evaluateJavaScript("globalThis.stopFailure()")
    let rejected = try await cli(["export",root.path,"--format","pdf","--output",root.appendingPathComponent("bad.pdf").path])
    #expect(rejected.0 != 0)
    try await controller.session.finish()
    let saved = try Data(contentsOf: root.appendingPathComponent("state/document.sqlite"))
    let closed = folder.appendingPathComponent("closed.pdf")
    let result = try await cli(["export",root.path,"--format","pdf","--output",closed.path])
    #expect(result.0 == 0, "\(result.2)")
    #expect(PDFDocument(data: try Data(contentsOf: closed))?.string?.contains("Filed tasks") == false)
    #expect(try Data(contentsOf: root.appendingPathComponent("state/document.sqlite")) == saved)
  }

  @Test @MainActor func retryPairsAndUnavailableOwnersFailSafely() async throws {
    _ = NSApplication.shared
    let root = try fixture()
    defer { try? FileManager.default.removeItem(at: root) }
    let op = String(decoding: try replace("must not apply"), as: UTF8.self)
    let incomplete = try await cli(["apply",root.path,"--op",op,"--id","original"])
    #expect(incomplete.0 != 0)
    #expect(incomplete.2.contains("together"))
    #expect(!FileManager.default.fileExists(atPath: root.appendingPathComponent("state").path))
    let controller = try await SlopDocumentWindowController.open(packageURL: root)
    try await controller.session.waitUntilReady()
    let old = try await cli(["apply",root.path,"--op",op,"--id","original","--epoch","old"])
    #expect(old.0 != 0)
    #expect(!old.2.contains("Retry identity:"))
    try await controller.session.finish()
    let ended = try await cli(["apply",root.path,"--op",op,"--id","original","--epoch","old"])
    #expect(ended.0 != 0)
    let lock = try DocumentWriterLock(root: root)
    defer { lock.close() }
    let output = root.deletingLastPathComponent().appendingPathComponent(UUID().uuidString + ".pdf")
    defer { try? FileManager.default.removeItem(at: output) }
    let busy = try await cli(["export",root.path,"--format","pdf","--output",output.path])
    #expect(busy.0 != 0)
    #expect(busy.2.contains("busy"))
    #expect(!FileManager.default.fileExists(atPath: output.path))
  }

  @Test @MainActor func expiredExportCannotPublishOutput() throws {
    let root = try fixture()
    let output = root.deletingLastPathComponent().appendingPathComponent(UUID().uuidString + ".pdf")
    defer { try? FileManager.default.removeItem(at: root); try? FileManager.default.removeItem(at: output) }
    let previous = Data("original".utf8)
    try previous.write(to: output)
    #expect(throws: (any Error).self) {
      try SlopRenderer.publishExport(Data("late capture".utf8), to: output, source: root, deadline: NativeCommandDeadline(timeout: .zero))
    }
    #expect(try Data(contentsOf: output) == previous)
  }

  @Test @MainActor func oldRuntimeFailsBeforeCreatingState() async throws {
    let root = try fixture();defer { try? FileManager.default.removeItem(at:root) }
    let url = root.appendingPathComponent("manifest.json")
    var manifest = try JSONSerialization.jsonObject(with:Data(contentsOf:url)) as! [String:Any]
    manifest["runtime"] = "old-runtime"
    try JSONSerialization.data(withJSONObject:manifest).write(to:url)
    await #expect(throws:(any Error).self) { try await DocumentCommand.run(method:"get",url:root) }
    #expect(!FileManager.default.fileExists(atPath:root.appendingPathComponent("state").path))
  }
  @Test @MainActor func inlineCaptureTargetsAreLazyAndUseCurrentDocument() async throws {
    _ = NSApplication.shared
    let root = try fixture(); defer { try? FileManager.default.removeItem(at:root) }
    let session = try await SlopRuntimeSession.open(packageURL:root)
    session.load(); try await session.waitUntilReady()
    let view = session.webView
    let idle = "[...document.querySelectorAll('[data-slop-capture-target]')].every(e=>e.hidden && e.childElementCount===0)"
    #expect(try await view.evaluateJavaScript(idle) as? Bool == true)
    let initial = try await DocumentCommand.run(method:"get",url:root)
    let firstIcon = try #require(try await SlopRenderer.targetPNGData(session:session,target:.icon))
    let image = try #require(NSBitmapImageRep(data:firstIcon))
    #expect(image.pixelsWide == 512 && image.pixelsHigh == 512)
    #expect(image.hasAlpha)
    #expect(try await view.evaluateJavaScript(idle) as? Bool == true)
    #expect(try await DocumentCommand.run(method:"get",url:root) == initial)
    let state = try #require(try JSONSerialization.jsonObject(with:initial) as? [String:Any])
    let rows = try #require(state["tasks"] as? [[String:Any]])
    let operations = rows.map { ["type":"set", "path":["tasks", ["id":$0["$id"]!], "done"], "value":true] as [String:Any] }
    _ = try await DocumentCommand.run(method:"batch",url:root,operations:JSONSerialization.data(withJSONObject:operations))
    let completedIcon = try #require(try await SlopRenderer.targetPNGData(session:session,target:.icon))
    #expect(completedIcon != firstIcon)
    _ = try await view.callAsyncJavaScript("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('File finished')).click(); await globalThis.__slop.flush(); return true",arguments:[:],in:nil,contentWorld:.page)
    let filed = try await DocumentCommand.run(method:"get",url:root)
    #expect(String(decoding:filed,as:UTF8.self).components(separatedBy:"\"archived\" : true").count == 4)
    // Use the accessible tab name rather than a Bits UI implementation attribute.
    _ = try await view.callAsyncJavaScript("[...document.querySelectorAll('[role=tab]')].find(b=>b.textContent.includes('Filed')).click(); return true",arguments:[:],in:nil,contentWorld:.page)
    let pdf = try await SlopRenderer.exportPDFData(session:session)
    #expect(PDFDocument(data:pdf)?.string?.contains("Filed tasks") == true)
    #expect(PDFDocument(data:pdf)?.string?.contains("Send the first draft") == true)
    #expect(try await view.evaluateJavaScript(idle) as? Bool == true)
    #expect(try await DocumentCommand.run(method:"get",url:root) == filed)
    try await session.closeAndWait()
    let assets = try await SlopRenderer.documentAssetsPNGData(packageURL:root)
    let preview = try #require(assets.previewPNG), icon = try #require(assets.finderIconPNG)
    try SlopPreviewWriter.write(preview,to:root)
    SlopPreviewWriter.installFinderIcon(icon,for:root)
    #expect(FileManager.default.fileExists(atPath:root.appendingPathComponent("QuickLook/Preview.png").path))
    #expect(FileManager.default.fileExists(atPath:root.appendingPathComponent("Icon\r").path))
    #expect(try Data(contentsOf:root.appendingPathComponent("QuickLook/Icon.png")) != icon)
  }

  @Test @MainActor func captureFailureRestoresEditorAndMissingIconIsOptional() async throws {
    _ = NSApplication.shared
    let root = try fixture("Expenses"); defer { try? FileManager.default.removeItem(at:root) }
    let session = try await SlopRuntimeSession.open(packageURL:root)
    session.load(); try await session.waitUntilReady()
    #expect(try await SlopRenderer.targetPNGData(session:session,target:.icon) == nil)
    _ = try await session.webView.callAsyncJavaScript("const {capture}=await import('/__runtime__/index.js');globalThis.stopFailure=capture.onPrepare(()=>{throw new Error('capture test failure')});return true",arguments:[:],in:nil,contentWorld:.page)
    await #expect(throws:(any Error).self) { try await SlopRenderer.exportPNGData(session:session) }
    #expect(session.engine.capturing == false)
    #expect(try await session.webView.evaluateJavaScript("!document.documentElement.hasAttribute('data-slop-capture')") as? Bool == true)
    _ = try await session.webView.evaluateJavaScript("globalThis.stopFailure()")
    #expect(NSImage(data:try await SlopRenderer.exportPNGData(session:session)) != nil)
    try await session.closeAndWait()
  }
  @Test @MainActor func headlessDoesNotLoadAuthoredCode() async throws {
    let root = try fixture();defer { try? FileManager.default.removeItem(at:root) }
    try Data("<script>webkit.messageHandlers.storage.postMessage({method:'failed',error:'AUTHORED CODE RAN'})</script>".utf8).write(to:root.appendingPathComponent("app.html"))
    let data = try await DocumentCommand.run(method:"apply",url:root,operation:replace("Engine only"))
    #expect(String(decoding:data,as:UTF8.self).contains("Engine only"))
  }
  @Test @MainActor func failedSaveRetainsOwnershipAndRendererDeathReleasesOnClose() async throws {
    let root = try fixture();defer { try? FileManager.default.removeItem(at:root) }
    let controller = try await SlopDocumentWindowController.open(packageURL:root)
    try await controller.session.waitUntilReady()
    controller.session.engine.onStatus = nil // suppress sheets in this failure harness
    controller.session.engine.onError = nil
    controller.session.engine.failWritesForTesting = true
    do { _ = try await DocumentCommand.run(method:"apply",url:root,operation:replace("Recovered edit"));Issue.record("Injected write succeeded") } catch { #expect(error.localizedDescription.contains("Retry identity")) }
    do { try await controller.session.finish();Issue.record("Failed save allowed close") } catch {}
    controller.session.engine.failWritesForTesting = false
    try await controller.session.flush()
    let pid = try #require(controller.session.webView.value(forKey:"_webProcessIdentifier") as? Int32)
    #expect(pid > 0)
    if pid > 0 { #expect(Darwin.kill(pid,SIGKILL) == 0) }
    for _ in 0..<100 where !controller.session.engine.rendererDead { try await Task.sleep(for:.milliseconds(30)) }
    #expect(controller.session.engine.rendererDead)
    try await controller.prepareToClose()
    try await controller.session.finish()
    controller.window?.orderOut(nil)
    #expect(String(decoding:try await DocumentCommand.run(method:"get",url:root),as:UTF8.self).contains("Recovered edit"))
  }
}

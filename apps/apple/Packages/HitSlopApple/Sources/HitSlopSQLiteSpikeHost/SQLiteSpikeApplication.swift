import AppKit
import Foundation
import WebKit
import UniformTypeIdentifiers
import HitSlopSQLiteArchive
import HitSlopSQLiteSpike

@MainActor public final class SQLiteSpikeApplication: NSObject, NSApplicationDelegate, NSWindowDelegate {
    private var views: [NSWindow: SQLiteWebView] = [:]
    private var scheduled: [URL: Task<Void, Never>] = [:]
    private var finishing = false
    private var arguments: [String] = []

    public static func launch(arguments: [String] = CommandLine.arguments) {
        let app = NSApplication.shared
        app.setActivationPolicy(.regular)
        let delegate = SQLiteSpikeApplication(); delegate.arguments = arguments
        app.delegate = delegate
        let menu = NSMenu(), appMenu = NSMenu(), appItem = NSMenuItem()
        appItem.submenu = appMenu; menu.addItem(appItem)
        appMenu.addItem(withTitle: "Quit SQLite Document Lab", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        let edit = NSMenu(title: "Edit"), editItem = NSMenuItem(); editItem.submenu = edit; menu.addItem(editItem)
        for (title, selector, key) in [("Undo", "undo:", "z"), ("Cut", "cut:", "x"), ("Copy", "copy:", "c"), ("Paste", "paste:", "v"), ("Select All", "selectAll:", "a")] { edit.addItem(withTitle: title, action: NSSelectorFromString(selector), keyEquivalent: key) }
        app.mainMenu = menu
        withExtendedLifetime(delegate) { app.run() }
    }
    public func applicationDidFinishLaunching(_ notification: Notification) {
        Task {
            do {
                if arguments.count > 1 { try await command(Array(arguments.dropFirst())) }
                else if views.isEmpty {
                    let panel = NSOpenPanel(); panel.allowedContentTypes = [UTType("com.hitslop.sqlite-lab.document") ?? .data]
                    if panel.runModal() == .OK, let url = panel.url { try open(url) }
                }
            } catch { NSLog("SQLite spike: %@", error.localizedDescription); exit(1) }
        }
    }
    public func application(_ sender: NSApplication, openFiles filenames: [String]) {
        do { for name in filenames { try open(URL(fileURLWithPath: name)) }; sender.reply(toOpenOrPrint: .success) }
        catch { sender.reply(toOpenOrPrint: .failure) }
    }
    private func command(_ args: [String]) async throws {
        let operation = args[0]
        let paths = args.dropFirst().map { URL(fileURLWithPath: $0) }
        switch operation {
        case "pack":
            guard paths.count == 2 else { throw SQLiteFailure("pack <built-package> <file.slopsql>") }
            let db = try SQLiteArchive(url: paths[1], writable: true, create: true)
            guard let files = FileManager.default.enumerator(at: paths[0], includingPropertiesForKeys: [.isRegularFileKey, .isSymbolicLinkKey]) else { throw SQLiteFailure("Cannot read build") }
            try db.transaction {
                for case let url as URL in files {
                    let values = try url.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey])
                    guard values.isSymbolicLink != true else { throw SQLiteFailure("Symlinks are forbidden") }
                    guard values.isRegularFile == true else { continue }
                    let name = String(url.path.dropFirst(paths[0].path.count + 1))
                    guard name == "app.html" || name == "manifest.json" || name == "data.schema.json" || name.hasPrefix("assets/") || name.hasPrefix(".agents/") || name.hasPrefix("QuickLook/") else { throw SQLiteFailure("Not an immutable build: \(name)") }
                    try db.putAsset(name, bytes: Data(contentsOf: url))
                }
                try db.putAssetIfMissing("QuickLook/Icon.png", bytes: SQLiteArtwork.fixture(label: "✓", color: .systemPink, size: NSSize(width: 512, height: 512)))
                try db.putAssetIfMissing("QuickLook/Preview.png", bytes: SQLiteArtwork.fixture(label: "Checklist", color: .systemPink, size: NSSize(width: 480, height: 620)))
            }
            try db.close()
            let document = try SQLiteDocument(url: paths[1]); try await document.close()
            print(paths[1].path); exit(0)
        case "fixture":
            guard args.count == 3 else { throw SQLiteFailure("fixture <file.slopsql> A|B") }
            let url = paths[0], exists = FileManager.default.fileExists(atPath: url.path)
            let db = try SQLiteArchive(url: url, writable: true, create: !exists)
            let label = args[2], color: NSColor = label == "A" ? .systemPink : .systemBlue
            let icon = try SQLiteArtwork.fixture(label: label, color: color, size: NSSize(width: 512, height: 512))
            let preview = try SQLiteArtwork.fixture(label: "Preview " + label, color: color, size: NSSize(width: 480, height: 620))
            try db.transaction {
                for (kind, bytes) in [("icon", icon), ("preview", preview)] { try db.execute("INSERT OR REPLACE INTO artwork VALUES(?,1,?)", [.text(kind), .blob(bytes)]) }
            }
            try db.close()
            let before = try Data(contentsOf: url)
            try SQLiteArtwork.installIcon(icon, at: url)
            guard try Data(contentsOf: url) == before else { throw SQLiteFailure("setIcon altered SQLite bytes") }
            print("Fixture \(label); custom icon set; SQLite bytes unchanged"); exit(0)
        case "open":
            guard paths.count == 1 else { throw SQLiteFailure("open <file.slopsql>") }; try open(paths[0])
        case "capture":
            guard paths.count == 1 else { throw SQLiteFailure("capture <file.slopsql>") }
            let document = try SQLiteDocument(url: paths[0]); let result = try await SQLiteArtwork.capture(document: document)
            try await document.close(); print("Captured generation \(result.generation); accepted=\(result.accepted)"); exit(0)
        case "verify":
            guard paths.count == 2 else { throw SQLiteFailure("verify <file.slopsql> <results-directory>") }
            try await verify(paths[0], output: paths[1]); exit(0)
        default:
            if operation.hasSuffix(".slopsql") { try open(URL(fileURLWithPath: operation)) }
            else { throw SQLiteFailure("Commands: pack, fixture, open, capture, verify") }
        }
    }
    private func open(_ url: URL) throws {
        if let window = views.keys.first(where: { views[$0]?.document.url == url }) { window.makeKeyAndOrderFront(nil); return }
        let document = try SQLiteDocument(url: url), view = try SQLiteWebView(document: document)
        let window = NSWindow(contentRect: NSRect(x: 180, y: 160, width: 480, height: 664), styleMask: [.titled, .closable, .miniaturizable], backing: .buffered, defer: false)
        window.title = url.deletingPathExtension().lastPathComponent
        window.representedURL = url; window.isReleasedWhenClosed = false; window.delegate = self
        let root = NSView(frame: NSRect(x: 0, y: 0, width: 480, height: 664))
        view.webView.frame = NSRect(x: 0, y: 0, width: 480, height: 620); root.addSubview(view.webView)
        for (i, title) in ["Mint", "Blush", "Reset theme", "Refresh artwork"].enumerated() {
            let button = NSButton(title: title, target: self, action: #selector(toolbar(_:)))
            button.tag = i; button.frame = NSRect(x: 10 + i * 116, y: 627, width: 112, height: 28); root.addSubview(button)
        }
        window.contentView = root; views[window] = view
        view.onError = { [weak window] message in window?.subtitle = message; NSLog("SQLite document: %@", message) }
        view.onChange = { [weak self, weak window] frame in
            window?.subtitle = "Saved · revision \(frame.publication)"
            self?.schedule(document)
        }
        window.center(); window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
        schedule(document)
    }
    @objc private func toolbar(_ button: NSButton) {
        guard let window = button.window, let view = views[window] else { return }
        Task {
            do {
                switch button.tag {
                case 0: try await view.document.setTheme("--slop-surface", value: "#79b9a2")
                case 1: try await view.document.setTheme("--slop-surface", value: "#e98996")
                case 2: try await view.document.setTheme(nil, value: nil)
                default: try await view.flush(); _ = try await SQLiteArtwork.capture(document: view.document)
                }
            } catch { window.subtitle = error.localizedDescription }
        }
    }
    private func schedule(_ document: SQLiteDocument) {
        scheduled[document.url]?.cancel()
        scheduled[document.url] = Task {
            do { try await Task.sleep(for: .seconds(2)); _ = try await SQLiteArtwork.capture(document: document) }
            catch is CancellationError {} catch { NSLog("SQLite artwork: %@", error.localizedDescription) }
        }
    }
    public func windowShouldClose(_ sender: NSWindow) -> Bool {
        if finishing { return true }
        guard let view = views[sender] else { return true }
        Task {
            do {
                scheduled[view.document.url]?.cancel(); await scheduled[view.document.url]?.value
                try await view.flush()
                do { _ = try await SQLiteArtwork.capture(document: view.document) } catch { NSLog("Close artwork: %@", error.localizedDescription) }
                view.detach(); try await view.document.close(); views.removeValue(forKey: sender); sender.close()
            } catch { sender.subtitle = error.localizedDescription }
        }
        return false
    }
    public func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if finishing { return .terminateNow }
        Task {
            do {
                for (_, view) in views {
                    scheduled[view.document.url]?.cancel(); await scheduled[view.document.url]?.value
                    try await view.flush()
                    // Artwork failure never discards already-durable document data.
                    do { _ = try await SQLiteArtwork.capture(document: view.document) } catch { NSLog("Close artwork: %@", error.localizedDescription) }
                    view.detach(); try await view.document.close()
                }
                finishing = true; sender.reply(toApplicationShouldTerminate: true)
            } catch { NSLog("SQLite close failed: %@", error.localizedDescription); sender.reply(toApplicationShouldTerminate: false) }
        }
        return .terminateLater
    }
    private func verify(_ url: URL, output: URL) async throws {
        try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
        let document = try SQLiteDocument(url: url), view = try SQLiteWebView(document: document)
        let window = NSWindow(contentRect: NSRect(x: 100, y: 100, width: 480, height: 620), styleMask: [.titled], backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false; window.contentView = view.webView; window.makeKeyAndOrderFront(nil)
        try await view.waitUntilReady()
        let before = try await SQLiteArtwork.capture(document: document)
        try before.preview.write(to: output.appendingPathComponent("before-preview.png")); try before.icon.write(to: output.appendingPathComponent("before-icon.png"))
        let started = Date()
        _ = try await view.webView.callAsyncJavaScript("await window.__spikeStore.change(data => {data.tasks.forEach(t => {t.done = true})}); await window.__hitslopFlush()", arguments: [:], in: nil, contentWorld: .page)
        try await document.setTheme("--slop-surface", value: "#79b9a2")
        let after = try await SQLiteArtwork.capture(document: document)
        guard before.icon != after.icon, before.preview != after.preview, after.accepted else { throw SQLiteFailure("Artwork did not change") }
        try after.preview.write(to: output.appendingPathComponent("after-preview.png")); try after.icon.write(to: output.appendingPathComponent("after-icon.png"))
        let wasm = try await view.webView.evaluateJavaScript("window.__spikeWasmCalls") as? Int ?? -1
        guard wasm == 0 else { throw SQLiteFailure("Unexpected platform WASM") }
        let fileBeforeIcon = try Data(contentsOf: url)
        try SQLiteArtwork.installIcon(after.icon, at: url)
        guard try Data(contentsOf: url) == fileBeforeIcon else { throw SQLiteFailure("Icon metadata changed SQLite bytes") }
        let db = try SQLiteArchive(url: url)
        guard try db.query("PRAGMA integrity_check").first?["integrity_check"]?.text == "ok" else { throw SQLiteFailure("SQLite integrity failure") }
        let copy = output.appendingPathComponent("Metadata-stripped.slopsql")
        _ = try await document.snapshot(to: copy)
        let copied = try SQLiteArchive(url: copy)
        guard try copied.artwork("icon") == after.icon else { throw SQLiteFailure("Embedded icon lost on copy") }
        try copied.close(); try db.close()
        let result: [String: Any] = ["passed": true, "generation": after.generation, "captureSeconds": Date().timeIntervalSince(started), "wasmCalls": wasm, "databaseBytes": fileBeforeIcon.count, "iconBytes": after.icon.count, "previewBytes": after.preview.count, "customIconPreservesDatabase": true, "metadataStrippedCopyContainsArtwork": true]
        try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys]).write(to: output.appendingPathComponent("runtime.json"))
        view.detach(); try await document.close(); window.close()
        print(String(decoding: try JSONSerialization.data(withJSONObject: result, options: .sortedKeys), as: UTF8.self))
    }
}

private extension SQLiteArchive {
    func putAssetIfMissing(_ name: String, bytes: Data) throws {
        if try query("SELECT name FROM sqlar WHERE name=?", [.text(name)]).isEmpty { try putAsset(name, bytes: bytes) }
    }
}

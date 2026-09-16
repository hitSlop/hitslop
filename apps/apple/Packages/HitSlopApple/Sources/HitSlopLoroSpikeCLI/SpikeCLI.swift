import Foundation
import AppKit
import WebKit
import Darwin
import HitSlopLoroSpike
import HitSlopCore
import HitSlopRuntime

@main struct SpikeCLI {
    @MainActor static func main() {
        let application = NSApplication.shared
        application.setActivationPolicy(.regular)
        // Standalone WKWebView needs the usual responder-chain editing menu
        // for real Command-Z / Shift-Command-Z keyboard verification.
        let menu = NSMenu(), edit = NSMenu(title: "Edit"), item = NSMenuItem()
        item.submenu = edit; menu.addItem(item)
        edit.addItem(withTitle: "Undo", action: NSSelectorFromString("undo:"), keyEquivalent: "z")
        let redo = edit.addItem(withTitle: "Redo", action: NSSelectorFromString("redo:"), keyEquivalent: "z")
        redo.keyEquivalentModifierMask = [.command, .shift]
        application.mainMenu = menu
        let delegate = SpikeApplication()
        application.delegate = delegate
        withExtendedLifetime(delegate) { application.run() }
    }
}

@MainActor private final class SpikeApplication: NSObject, NSApplicationDelegate, NSWindowDelegate {
    struct View {
        let session: SlopRuntimeSession
        let document: SpikeDocument?
        let bridge: SpikeBridge?
        let window: NSWindow
        let connection: SpikeConnection?
    }
    private var views: [View] = []
    private var root: URL!
    private var closing = false
    private var cleanupRoot = true
    private let arguments = CommandLine.arguments
    private func argument(_ key: String, default fallback: String = "") -> String {
        guard let index = arguments.firstIndex(of: key), index + 1 < arguments.count else { return fallback }
        return arguments[index + 1]
    }
    func applicationDidFinishLaunching(_ notification: Notification) {
        Task {
            do { try await run() }
            catch {
                fputs("Native Loro spike failed: \(error.localizedDescription)\n", stderr)
                await finish(); exit(1)
            }
        }
    }
    func windowShouldClose(_ sender: NSWindow) -> Bool {
        if closing { return true }
        Task { await finish(); NSApplication.shared.terminate(nil) }
        return false
    }
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if closing { return .terminateNow }
        Task { await finish(); sender.reply(toApplicationShouldTerminate: true) }
        return .terminateLater
    }
    private func finish() async {
        closing = true
        for view in views {
            view.connection?.stop()
            do {
                if view.bridge?.isAttached != false { try await view.session.flush() }
                try await view.document?.close()
            }
            catch { cleanupRoot = false; fputs("Spike close (preserving files): \(error.localizedDescription)\n", stderr) }
            view.bridge?.detach(); view.session.close(); view.window.close()
        }
        views.removeAll()
        if cleanupRoot, let root { try? FileManager.default.removeItem(at: root) }
    }
    private func run() async throws {
        let variant = argument("--engine", default: "native"), mode = argument("--mode", default: "verify")
        guard ["native", "js"].contains(variant), ["verify", "benchmark", "open", "control", "probe"].contains(mode) else { throw SpikeFailure("Invalid engine or mode") }
        guard let confirmation = SpikeConfirmation(rawValue: argument("--confirmation", default: "accepted")),
              let textPolicy = SpikeTextPolicy(rawValue: argument("--text-policy", default: "ancestry")),
              let transport = SpikeTransport(rawValue: argument("--transport", default: "snapshot")) else { throw SpikeFailure("Invalid confirmation or text policy") }
        let source = URL(fileURLWithPath: argument("--package"))
        let count = Int(argument("--count", default: "1")) ?? 1
        guard (1...10).contains(count) else { throw SpikeFailure("Window count must be 1...10") }
        let persistent = argument("--document")
        if !persistent.isEmpty {
            guard count == 1, variant == "native" else { throw SpikeFailure("Persistent harness requires one native document") }
            cleanupRoot = false
        }
        root = persistent.isEmpty ? FileManager.default.temporaryDirectory.appendingPathComponent("hitslop-native-loro-ui-\(UUID())") : URL(fileURLWithPath: persistent).deletingLastPathComponent()
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let processesBefore = try processes()
        let started = ContinuousClock.now
        for index in 0..<count {
            let destination = persistent.isEmpty ? root.appendingPathComponent("checklist-\(index).slop") : URL(fileURLWithPath: persistent)
            if !FileManager.default.fileExists(atPath: destination.path) { try FileManager.default.copyItem(at: source, to: destination) }
            let document: SpikeDocument?
            if variant == "native" {
                let seedFile = argument("--seed")
                let seed = seedFile.isEmpty ? nil : try JSONDecoder().decode(SpikeTransfer.self, from: Data(contentsOf: URL(fileURLWithPath: seedFile)))
                document = try SpikeDocument(root: destination,
                    schema: SpikeJSON(data: Data(contentsOf: destination.appendingPathComponent("data.schema.json"))),
                    initial: SpikeJSON(data: Data(contentsOf: destination.appendingPathComponent("assets/initial.json"))), seed: seed, confirmation: confirmation, transport: transport)
                try await document?.start()
            } else { document = nil }
            let session = try SlopRuntimeSession(packageURL: destination)
            let bridge = document.map { SpikeBridge(document: $0, webView: session.webView, textPolicy: textPolicy) }
            let window = NSWindow(contentRect: NSRect(x: 100 + index * 24, y: 150 + index * 16, width: 480, height: 620),
                                  styleMask: [.titled, .closable, .resizable], backing: .buffered, defer: false)
            window.isReleasedWhenClosed = false; window.title = "Loro spike · \(variant) · \(index + 1)"; window.delegate = self
            window.contentView = session.webView; window.makeKeyAndOrderFront(nil)
            let relayFile = argument("--relay-config")
            let connection: SpikeConnection?
            if !relayFile.isEmpty, let document {
                connection = SpikeConnection(document: document, configuration: try JSONDecoder().decode(SpikeRelayConfiguration.self, from: Data(contentsOf: URL(fileURLWithPath: relayFile))))
            } else { connection = nil }
            views.append(View(session: session, document: document, bridge: bridge, window: window, connection: connection))
            session.load()
        }
        for view in views { try await view.session.waitUntilReady(timeout: .seconds(30)) }
        let opening = milliseconds(ContinuousClock.now - started)
        NSApplication.shared.activate(ignoringOtherApps: true)
        if mode == "open" { for view in views { view.connection?.start() }; return }
        if mode == "control" {
            writeControl(["event": "ready"])
            Task.detached { [weak self] in
                while let line = readLine() { await self?.control(line) }
            }
            return
        }
        var result: [String: Any] = ["engine": variant, "mode": mode, "windows": count, "opening_ms": opening,
                                    "confirmation": confirmation.rawValue, "textPolicy": textPolicy.rawValue, "os": ProcessInfo.processInfo.operatingSystemVersionString, "architecture": architecture]
        if mode == "probe" {
            let script = try String(contentsOfFile: argument("--script"), encoding: .utf8)
            let probe = try await evaluate(views[0], script) as? [String: Any] ?? [:]
            result.merge(probe) { _, new in new }
        }
        else if mode == "verify" {
            let checks = try await verify(views[0], native: variant == "native")
            result["checks"] = checks
            result["passed"] = checks.allSatisfy { $0["passed"] as? Bool == true }
        }
        else {
            try await Task.sleep(for: .milliseconds(500))
            result["memory"] = try memory(before: processesBefore)
            result["edits"] = try await evaluate(views[0], """
                const store = window.__spikeStore, ack = [], paint = [], flush = [];
                for (let i = 0; i < 100; i++) {
                    const start = performance.now();
                    await store.change(data => { data.tasks[1].done = !data.tasks[1].done; });
                    ack.push(performance.now() - start);
                    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                    paint.push(performance.now() - start);
                }
                for (let i = 0; i < 10; i++) {
                    await store.change(data => { data.title = 'Flush measurement ' + i; });
                    const start = performance.now(); await store.flush(); flush.push(performance.now() - start);
                }
                let typing = null;
                if (window.__spikeMetrics) {
                    await store.change(data=>{data.tasks[0].text='abc';}); await store.flush();
                    await new Promise(r=>setTimeout(r,30));
                    const field=document.querySelector('textarea[aria-label="Task 1"]');field.focus();
                    const metrics=window.__spikeMetrics, offset=metrics.inputAck.length; metrics.maxPending=0;
                    for(let i=0;i<40;i++) {
                        field.value+='x';field.setSelectionRange(field.value.length,field.value.length);
                        field.dispatchEvent(new InputEvent('input',{bubbles:true}));
                        await new Promise(r=>setTimeout(r,50));
                    }
                    await store.flush();await new Promise(r=>setTimeout(r,40));
                    typing={cadence_ms:50,inputs:40,maxPending:metrics.maxPending,pendingAfterFlush:metrics.pending,
                        correct:store.current.tasks[0].text==='abc'+'x'.repeat(40)&&field.value===store.current.tasks[0].text,
                        input_to_ack_samples:metrics.inputAck.slice(offset),queue_wait_samples:metrics.queueWait.slice(offset)};
                }
                const summary = values => { const sorted = values.toSorted((a,b) => a-b); return { p50: sorted[Math.floor(sorted.length*.5)], p95: sorted[Math.ceil(sorted.length*.95)-1], max: sorted.at(-1), samples: values }; };
                return { acknowledgement_ms: summary(ack), paint_ms: summary(paint), flush_ms: summary(flush),typing };
                """)
        }
        result["runtime"] = try await evaluate(views[0], """
            return { wasmCalls: window.__spikeWasmCalls ?? null, runtimeResources: performance.getEntriesByType('resource').map(e=>e.name).filter(n=>n.includes('document-runtime-')) };
            """)
        let output = argument("--output")
        if !output.isEmpty {
            let url = URL(fileURLWithPath: output)
            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys, .prettyPrinted]).write(to: url)
            if mode == "verify", let image = try await views[0].session.webView.takeSnapshot(configuration: nil).tiffRepresentation,
               let png = NSBitmapImageRep(data: image)?.representation(using: .png, properties: [:]) {
                try png.write(to: url.deletingPathExtension().appendingPathExtension("png"))
            }
        }
        print(String(decoding: try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys]), as: UTF8.self))
        await finish(); exit(result["passed"] as? Bool == false ? 2 : 0)
    }
    private func evaluate(_ view: View, _ script: String) async throws -> Any {
        try await view.session.webView.callAsyncJavaScript(script, arguments: [:], in: nil, contentWorld: .page) ?? NSNull()
    }
    private func writeControl(_ value: [String: Any]) {
        if let bytes = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]) {
            FileHandle.standardOutput.write(bytes + Data([10]))
        }
    }
    private func control(_ line: String) async {
        var id = ""
        do {
            let command = try SpikeJSON(data: Data(line.utf8)); id = command["id"].string ?? ""
            guard let view = views.first, let document = view.document else { throw SpikeFailure("No document") }
            let value: Any
            switch command["method"].string {
            case "frame": value = try JSONSerialization.jsonObject(with: JSONEncoder().encode(await document.frame()))
            case "queue": value = try JSONSerialization.jsonObject(with: JSONEncoder().encode(await document.queuedBatches()))
            case "queueCount": value = await document.queuedBatchCount()
            case "cursor": value = await document.deliveryCursor()
            case "invalidBatch": value = try JSONSerialization.jsonObject(with: JSONEncoder().encode(await document.invalidBatchFixture(command["kind"].string ?? "")))
            case "workload":
                let count = Int(command["count"].number ?? 1), start = Int(command["start"].number ?? 0)
                let padding = Int(command["padding"].number ?? 0)
                guard count > 0, count <= 50, padding >= 0, padding <= 2_000_000 else { throw SpikeFailure("Invalid workload") }
                let session = UUID().uuidString
                var snapshots = 0
                for index in 0..<count {
                    let frame = try await document.frame(); var after = frame.data
                    let text = padding == 0 ? "Incremental edit \(start + index)" : (0..<padding).map { _ in "abcdefghijklmnopqrstuvwxyz0123456789".randomElement()! }.map(String.init).joined()
                    after["title"] = .string(text)
                    _ = try await document.apply(.init(session: session, sequence: index + 1, base: frame.revision, after: after))
                    snapshots += try await document.snapshot().count
                }
                value = ["edits": count, "snapshotBytes": snapshots]
            case "networkFault": view.connection?.injectNetworkFault(command["point"].string); value = true
            case "transfer": value = try JSONSerialization.jsonObject(with: JSONEncoder().encode(await document.transfer()))
            case "flush": try await view.session.flush(); try await document.flush(); value = true
            case "keyboard":
                view.window.makeKeyAndOrderFront(nil)
                NSApplication.shared.activate(ignoringOtherApps: true)
                let characters = command["text"].string ?? ""
                for character in characters {
                    let text = command["shift"] == .bool(true) ? String(character).uppercased() : String(character)
                    for type in [NSEvent.EventType.keyDown, .keyUp] {
                        guard let event = NSEvent.keyEvent(with: type, location: .zero, modifierFlags: (command["command"] == .bool(true) ? NSEvent.ModifierFlags.command : []).union(command["shift"] == .bool(true) ? .shift : []), timestamp: ProcessInfo.processInfo.systemUptime,
                            windowNumber: view.window.windowNumber, context: nil, characters: text, charactersIgnoringModifiers: text, isARepeat: false, keyCode: text == "\u{7f}" ? 51 : text.lowercased() == "z" ? 6 : 0) else { throw SpikeFailure("Cannot create keyboard event") }
                        if type == .keyDown, event.modifierFlags.contains(.command), NSApplication.shared.mainMenu?.performKeyEquivalent(with: event) == true { continue }
                        NSApplication.shared.sendEvent(event)
                    }
                }
                value = true
            case "history":
                guard let manager = view.window.firstResponder?.undoManager else { throw SpikeFailure("No native editing history") }
                let redo = command["redo"] == .bool(true)
                let available = redo ? manager.canRedo : manager.canUndo
                if redo { manager.redo() } else { manager.undo() }
                value = ["available": available]
            case "storage": await document.configureStorage(milliseconds: command["milliseconds"].number ?? 0, failure: command["failure"].string); value = true
            case "evaluate": value = try await evaluate(view, command["script"].string ?? "")
            case "online": view.connection?.start(); value = true
            case "offline": view.connection?.stop(); value = true
            case "status": value = try JSONSerialization.jsonObject(with: (view.connection?.status() ?? .null).encoded())
            case "detach": view.bridge?.detach(); value = true
            case "reload": view.session.load(); try await view.session.waitUntilReady(timeout: .seconds(30)); value = true
            case "screenshot":
                guard let image = try await view.session.webView.takeSnapshot(configuration: nil).tiffRepresentation,
                      let png = NSBitmapImageRep(data: image)?.representation(using: .png, properties: [:]),
                      let path = command["path"].string else { throw SpikeFailure("Screenshot failed") }
                try png.write(to: URL(fileURLWithPath: path)); value = true
            case "close": writeControl(["id": id, "value": true]); await finish(); NSApplication.shared.terminate(nil); return
            default: throw SpikeFailure("Unknown control")
            }
            writeControl(["id": id, "value": value])
        } catch { writeControl(["id": id, "error": error.localizedDescription]) }
    }
    private func verify(_ view: View, native: Bool) async throws -> [[String: Any]] {
        let checks = try await evaluate(view, """
            const store = window.__spikeStore;
            const native = \(native ? "true" : "false");
            const bridge = body => window.webkit.messageHandlers.hitslopNativeSpike.postMessage(body);
            const assert = (value, name, details = {}) => { checks.push({name, passed:!!value, ...details}); };
            const checks = [];
            const wait = () => new Promise(resolve => setTimeout(resolve, 30));
            const until = async predicate => { const deadline=performance.now()+2000; while (!await predicate() && performance.now()<deadline) await new Promise(r=>setTimeout(r,5)); };
            if (native) await bridge({ method:'delay', milliseconds:120 });
            const checkboxes = [...document.querySelectorAll('[data-checkbox-root]')];
            const initially = store.current.tasks[1].done;
            checkboxes[1].click(); checkboxes[1].click(); await store.flush();
            assert(store.current.tasks[1].done === initially, 'rapid repeated real checkbox clicks');
            const first = store.change(data => { data.tasks[0].done = false; });
            const second = store.change(data => { data.tasks[1].done = true; });
            await Promise.all([first, second]);
            assert(!store.current.tasks[0].done && store.current.tasks[1].done, 'rapid distinct checkboxes');
            const original = store.current.tasks[1].done;
            await Promise.all(Array.from({length:6}, () => store.change(data => { data.tasks[1].done = !data.tasks[1].done; })));
            assert(store.current.tasks[1].done === original, 'ordered repeated toggles');
            if (native) {
                const before = structuredClone(store.current);
                const pending = store.change(data => { data.title = 'Local overlapping request'; });
                await until(async () => (await bridge({method:'open'})).data.title === 'Local overlapping request');
                const remote = (await bridge({method:'open'})).data; remote.tasks[2].archived = true;
                await bridge({method:'remote', after:remote});
                await until(() => store.current.tasks[2].archived);
                await pending;
                assert(store.current.title === 'Local overlapping request' && store.current.tasks[2].archived, 'newer remote publication survives delayed acknowledgement', {actual:store.current.title, archived:store.current.tasks[2].archived});
                await bridge({ method:'delay', milliseconds:0 });
            }
            const input = document.querySelector('input[aria-label="New task"]');
            input.value = 'Spike new task'; input.dispatchEvent(new Event('input',{bubbles:true})); input.form.requestSubmit();
            await store.flush(); await wait();
            assert(store.current.tasks.some(t=>t.text==='Spike new task'), 'real composer adds task');
            const added = store.current.tasks.find(t=>t.text==='Spike new task');
            await window.__spikeActions.move(added.id,-1); await wait();
            assert(store.current.tasks.at(-1).id !== added.id, 'pilot reorder handler');
            await window.__spikeActions.remove(added.id);
            assert(!store.current.tasks.some(t=>t.id===added.id), 'pilot delete handler');
            await window.__spikeActions.undo(); await store.flush();
            assert(store.current.tasks.filter(t=>t.id===added.id).length === 1, 'pilot undo restores exactly once');
            const title = document.querySelector('textarea[aria-label="Checklist title"]');
            title.focus(); title.value = 'A😀 é 👩🏽‍💻'; title.setSelectionRange(title.value.length,title.value.length);
            title.dispatchEvent(new Event('input',{bubbles:true})); await store.flush(); await wait();
            assert(store.current.title === 'A😀 é 👩🏽‍💻' && title.value === store.current.title, 'Unicode text round-trip');
            assert(title.selectionStart === title.value.length, 'caret retained after acknowledgement');
            if (native) {
                const prior = store.current.title;
                title.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
                title.value = '日本'; title.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));
                await store.flush(); assert(store.current.title === prior, 'composition draft remains local');
                title.value = '日本語'; title.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'日本語'}));
                title.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:false}));
                await store.flush(); await wait();
                assert(store.current.title === '日本語', 'composition commits final text');
                // A whole-string draft can become stale while its first edit awaits acknowledgement.
                // Exercise S.Text (task text), not the intentionally atomic title field.
                await store.change(data => { data.tasks[0].text = 'abc'; }); await wait();
                const text = document.querySelector('textarea[aria-label="Task 1"]'); text.focus();
                await bridge({method:'delay',milliseconds:120});
                text.value = 'abcX'; text.dispatchEvent(new Event('input',{bubbles:true}));
                await until(async () => (await bridge({method:'open'})).data.tasks[0].text === 'abcX');
                const concurrent = (await bridge({method:'open'})).data; concurrent.tasks[0].text = 'R' + concurrent.tasks[0].text;
                await bridge({method:'remote',after:concurrent}); await wait();
                text.value += 'Z'; text.dispatchEvent(new Event('input',{bubbles:true}));
                await store.flush(); await wait();
                assert(store.current.tasks[0].text === 'RabcXZ', 'same-field remote text survives a second pending local draft', {expected:'RabcXZ', actual:store.current.tasks[0].text});
                for (const delay of [0,20,100,500]) {
                    for (const scenario of [
                        {name:'insertion',remote:'RabcX',expected:'RabcXZ'},
                        {name:'deletion',remote:'bcX',expected:'bcXZ'},
                        {name:'unicode',remote:'a😀bcX',expected:'a😀bcXZ'},
                        {name:'replacement',remote:'REPLACED',expected:null},
                        {name:'composition',remote:'RabcX',expected:'RabcX日本語'},
                        {name:'reorder',remote:'RabcX',expected:'RabcXZ'},
                    ]) {
                        await bridge({method:'delay',milliseconds:0});
                        const id = store.current.tasks[0].id;
                        await store.change(data=>{data.tasks.find(t=>t.id===id).text='abc';}); await wait();
                        const field = document.querySelector('textarea[aria-label="Task 1"]'); field.focus();
                        await bridge({method:'delay',milliseconds:delay});
                        field.value='abcX';field.dispatchEvent(new Event('input',{bubbles:true}));
                        await until(async()=>(await bridge({method:'open'})).data.tasks.find(t=>t.id===id).text==='abcX');
                        // Composition holds its displayed base even when no request is pending.
                        if(scenario.name==='composition') field.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
                        const remote=(await bridge({method:'open'})).data;
                        remote.tasks.find(t=>t.id===id).text=scenario.remote;
                        if(scenario.name==='reorder') remote.tasks.reverse();
                        await bridge({method:'remote',after:remote});await wait();
                        if(scenario.name==='composition') {
                            field.value='abcX日本';field.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));
                            field.value='abcX日本語';field.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'日本語'}));
                        } else {field.value+='Z';field.dispatchEvent(new Event('input',{bubbles:true}));}
                        await store.flush();await wait();
                        const actual=store.current.tasks.find(t=>t.id===id).text;
                        const good=scenario.expected===null?actual.includes('REPLACED')&&actual.includes('Z'):actual===scenario.expected;
                        assert(good,`draft ${scenario.name} at ${delay}ms`,{actual,expected:scenario.expected});
                        if(scenario.name==='reorder') assert(store.current.tasks.at(-1).id===id,`draft preserves remote reorder at ${delay}ms`);
                    }
                }
                await bridge({method:'delay',milliseconds:120});
                const deletingId=store.current.tasks[0].id;
                const deletingField=document.querySelector('textarea[aria-label="Task 1"]');
                deletingField.value+=' pending';deletingField.dispatchEvent(new Event('input',{bubbles:true}));
                await until(async()=>(await bridge({method:'open'})).data.tasks.find(t=>t.id===deletingId).text.endsWith(' pending'));
                const deletingRemote=(await bridge({method:'open'})).data;
                deletingRemote.tasks=deletingRemote.tasks.filter(t=>t.id!==deletingId);
                await bridge({method:'remote',after:deletingRemote});await store.flush();await wait();
                assert(!store.current.tasks.some(t=>t.id===deletingId),'remote deletion survives pending input acknowledgement');
                await bridge({method:'delay',milliseconds:0});
                assert(window.__spikeWasmCalls === 0, 'no WASM calls');
                assert(!performance.getEntriesByType('resource').some(e=>e.name.includes('document-runtime-')), 'no engine script fetched');
            }
            return checks;
            """)
        // The owner survives a renderer reload; load resets the renderer readiness barrier.
        let before = try await evaluate(view, "return JSON.stringify(window.__spikeStore.current)") as? String
        view.session.load(); try await view.session.waitUntilReady(timeout: .seconds(30))
        let after = try await evaluate(view, "return JSON.stringify(window.__spikeStore.current)") as? String
        guard let before, let after, try SpikeJSON(data: Data(before.utf8)) == SpikeJSON(data: Data(after.utf8)) else { throw SpikeFailure("Reload changed the document: \(before ?? "nil") -> \(after ?? "nil")") }
        let displayed = try await evaluate(view, "return document.querySelector('textarea[aria-label=\"Checklist title\"]').value") as? String
        guard displayed == (try SpikeJSON(data: Data(after.utf8)))["title"].string else { throw SpikeFailure("Rendered title is stale after reload") }
        var result = checks as? [[String: Any]] ?? []
        result.append(["name": "renderer reload retains accepted state", "passed": true])
        result.append(["name": "rendered title refreshes after reload", "passed": true])
        if let document = view.document {
            // A complete independent package combines existing immutable-copy plumbing
            // with native state creation, without asking guest JS for a checkpoint.
            view.bridge?.detach()
            let snapshot = try await document.snapshot()
            guard !snapshot.isEmpty else { throw SpikeFailure("Native snapshot was empty") }
            let destination = root.appendingPathComponent("independent.slop")
            try SlopDuplicator.duplicate(from: view.session.package.rootURL, to: destination)
            for name in ["state", "stores/data.json"] { try FileManager.default.removeItem(at: destination.appendingPathComponent(name)) }
            let copy = try await document.independentCopy(to: destination)
            try await copy.flush()
            _ = try SlopPackage(rootURL: destination)
            guard try await copy.frame().data == document.frame().data else { throw SpikeFailure("Independent copy lost content") }
            try await copy.close()
            result.append(["name": "snapshot and copy after bridge detach", "passed": true])
        }
        return result
    }
    private struct ProcessRow { let pid: Int32; let parent: Int32; let rss: Int; let command: String }
    private func processes() throws -> [ProcessRow] {
        let process = Process(), pipe = Pipe()
        process.executableURL = URL(fileURLWithPath: "/bin/ps"); process.arguments = ["-axo", "pid=,ppid=,rss=,comm="]
        process.standardOutput = pipe
        try process.run()
        let bytes = pipe.fileHandleForReading.readDataToEndOfFile(); process.waitUntilExit()
        return String(decoding: bytes, as: UTF8.self).split(separator: "\n").compactMap { line in
            let fields = line.split(maxSplits: 3, whereSeparator: \.isWhitespace)
            guard fields.count == 4, let pid = Int32(fields[0]), let parent = Int32(fields[1]), let rss = Int(fields[2]) else { return nil }
            return ProcessRow(pid: pid, parent: parent, rss: rss, command: String(fields[3]))
        }
    }
    private func memory(before: [ProcessRow]) throws -> [String: Any] {
        let after = try processes(), prior = Set(before.map(\.pid))
        // Private diagnostic selector only in this opt-in harness, never the app.
        var contentPIDs = Set<Int32>()
        for view in views {
            let key = "_webProcessIdentifier"
            if view.session.webView.responds(to: NSSelectorFromString(key)), let value = view.session.webView.value(forKey: key) as? NSNumber {
                contentPIDs.insert(value.int32Value)
            }
        }
        let candidates = after.filter { $0.command.contains("WebKit") && (!prior.contains($0.pid) || contentPIDs.contains($0.pid)) }
        let host = after.first { $0.pid == getpid() }?.rss ?? 0
        return ["host_rss_mib": Double(host) / 1024, "webkit_rss_mib": Double(candidates.reduce(0) { $0 + $1.rss }) / 1024,
                "content_pids": contentPIDs.sorted(), "attribution": "Direct WebContent PIDs plus WebKit processes newly observed during this isolated run; summed RSS can double-count shared pages.",
                "processes": candidates.map { ["pid": $0.pid, "ppid": $0.parent, "rss_kib": $0.rss, "command": $0.command] as [String: Any] }]
    }
    private func milliseconds(_ duration: Duration) -> Double { Double(duration.components.seconds) * 1000 + Double(duration.components.attoseconds) / 1e15 }
    private var architecture: String {
        #if arch(arm64)
        "arm64"
        #else
        "x86_64"
        #endif
    }
}

import AppKit
import HitSlopCatalog
import HitSlopCore
import HitSlopFirebase
import HitSlopHost
import HitSlopRuntime
import Sparkle
import SwiftUI
import UniformTypeIdentifiers

@main struct hitSlopApp: App {
    @NSApplicationDelegateAdaptor(HitSlopAppDelegate.self) private var delegate
    var body: some Scene {
        Settings {
            UpdateSettingsView(updater: delegate.updater)
        }
    }
}

private struct UpdateSettingsView: View {
    let updater: SPUUpdater
    var body: some View {
        Form {
            Toggle("Check for updates automatically", isOn: Binding(
                get: { updater.automaticallyChecksForUpdates },
                set: { updater.automaticallyChecksForUpdates = $0 }
            ))
        }
        .formStyle(.grouped)
        .frame(width: 420)
        .padding()
    }
}

@MainActor final class HitSlopAppDelegate: NSObject, NSApplicationDelegate, NSMenuItemValidation, NSMenuDelegate {
    private var catalog: NSWindowController?
    private var documents: [String: SlopDocumentWindowController] = [:]
    private var recentMenu: NSMenu?
    private let updaterController = SPUStandardUpdaterController(startingUpdater: true, updaterDelegate: nil, userDriverDelegate: nil)
    var updater: SPUUpdater { updaterController.updater }
    private var catalogURL: URL { HitSlopFirebase.catalogURL(default: URL(string: Bundle.main.object(forInfoDictionaryKey: "CatalogURL") as? String ?? "https://api.hitslop.com")!) }

    func applicationWillFinishLaunching(_ notification: Notification) {
        HitSlopFirebase.configure()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular); installMenus()
        let skillVersion = "\(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "development")-\(Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "0")"
        Task.detached(priority: .utility) {
            do {
                for conflict in try SlopAgentSkills.sync(appVersion: skillVersion) {
                    NSLog("Left existing agent skill unchanged: %@", conflict.path)
                }
            } catch { NSLog("Could not refresh agent skills: %@", error.localizedDescription) }
        }
        let urls = CommandLine.arguments.dropFirst().filter { $0.hasSuffix(".slop") }.map(URL.init(fileURLWithPath:))
        if urls.isEmpty { showCatalog() } else { urls.forEach(openDocument) }
    }
    func application(_ application: NSApplication, open urls: [URL]) { urls.filter { $0.pathExtension.lowercased() == "slop" }.forEach(openDocument) }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        Task {
            do {
                for document in documents.values { try await document.prepareToClose() }
                await SlopDocumentWindowController.finishAssetRefreshesForTermination()
                sender.reply(toApplicationShouldTerminate: true)
            } catch {
                let alert = NSAlert(error: error)
                alert.messageText = "Changes could not be saved"
                alert.runModal()
                sender.reply(toApplicationShouldTerminate: false)
            }
        }
        return .terminateLater
    }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if flag { return true }
        if !documents.isEmpty {
            documents.values.forEach { $0.revealFromDock() }
            NSApp.activate(ignoringOtherApps: true)
            return true
        }
        showCatalog()
        return true
    }
    func applicationDockMenu(_ sender: NSApplication) -> NSMenu? {
        let menu = NSMenu()
        let open = documents.values.sorted { $0.documentTitle.localizedStandardCompare($1.documentTitle) == .orderedAscending }
        for controller in open {
            let item = NSMenuItem(title: controller.documentTitle, action: #selector(focusDocumentFromDock(_:)), keyEquivalent: "")
            item.target = self
            item.representedObject = controller.packageURL
            item.image = controller.dockMenuImage
            menu.addItem(item)
        }
        if !open.isEmpty { menu.addItem(.separator()) }
        let catalogItem = NSMenuItem(title: "Catalog", action: #selector(showCatalog), keyEquivalent: "")
        catalogItem.target = self
        menu.addItem(catalogItem)
        return menu
    }
    @objc private func focusDocumentFromDock(_ sender: NSMenuItem) {
        guard let url = sender.representedObject as? URL else { return }
        documents[url.standardizedFileURL.path]?.revealFromDock()
        NSApp.activate(ignoringOtherApps: true)
    }

    @objc func showCatalog() {
        if catalog == nil {
            let root = CatalogView(catalogURL: catalogURL, openDocument: { [weak self] in self?.openDocument($0) })
            let host = NSHostingController(rootView: root)
            let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1040, height: 720), styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView], backing: .buffered, defer: false)
            window.title = ""; window.titleVisibility = .hidden; window.titlebarAppearsTransparent = true; window.isReleasedWhenClosed = false
            window.minSize = NSSize(width: 900, height: 600); window.contentViewController = host; window.center(); catalog = NSWindowController(window: window)
        }
        catalog?.showWindow(nil); catalog?.window?.deminiaturize(nil); catalog?.window?.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
    }

    private func openDocument(_ url: URL) {
        if DocumentFactory.isManagedTemplatePackage(url) {
            createDocument(fromTemplate: url)
            return
        }
        let key = url.standardizedFileURL.path
        if let existing = documents[key] { existing.showWindow(nil); existing.window?.makeKeyAndOrderFront(nil); return }
        Task { @MainActor in
            if let existing = documents[key] { existing.showWindow(nil); existing.window?.makeKeyAndOrderFront(nil); return }
            do {
                try await SlopCloud.downloadIfNeeded(url)
                let controller = try SlopDocumentWindowController(packageURL: url)
                controller.onClose = { [weak self] in guard let self else { return }; self.documents.removeValue(forKey: key); if self.documents.isEmpty { self.showCatalog() } }
                controller.onOpenDocument = { [weak self] in self?.openDocument($0) }
                documents[key] = controller; controller.showWindow(nil); controller.window?.makeKeyAndOrderFront(nil)
                catalog?.window?.orderOut(nil); NSDocumentController.shared.noteNewRecentDocumentURL(url); NSApp.activate(ignoringOtherApps: true)
                HitSlopFirebase.log("document_opened")
            } catch { let alert = NSAlert(error: error); alert.messageText = "Could not open slop"; alert.runModal() }
        }
    }

    private func createDocument(fromTemplate url: URL) {
        showCatalog()
        let slug: String
        do {
            let package = try SlopPackage(rootURL: url)
            try package.validateAsTemplate()
            slug = package.manifest.slug
        } catch {
            let alert = NSAlert(error: error)
            alert.messageText = "Could not create slop"
            if let window = catalog?.window { alert.beginSheetModal(for: window) }
            else { alert.runModal() }
            return
        }
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.slop]
        panel.canCreateDirectories = true
        panel.directoryURL = SlopCloud.defaultCreationDirectory()
        panel.nameFieldStringValue = "\(slug).slop"
        let complete: (NSApplication.ModalResponse) -> Void = { [weak self] response in
            guard let self, response == .OK, let destination = panel.url else { return }
            do {
                try DocumentFactory(catalogURL: self.catalogURL).create(fromLocalPackage: url, at: destination)
                SlopPreviewWriter.installExistingPreview(for: destination)
                NSDocumentController.shared.noteNewRecentDocumentURL(destination)
                self.openDocument(destination)
            } catch {
                let alert = NSAlert(error: error)
                alert.messageText = "Could not create slop"
                alert.runModal()
            }
        }
        if let window = catalog?.window { panel.beginSheetModal(for: window, completionHandler: complete) }
        else { complete(panel.runModal()) }
    }

    @objc private func openPanel() {
        let panel = NSOpenPanel(); panel.allowedContentTypes = [.slop]; panel.allowsMultipleSelection = true
        panel.directoryURL = SlopCloud.defaultCreationDirectory()
        guard panel.runModal() == .OK else { return }; panel.urls.forEach(openDocument)
    }
    @objc private func duplicateActive() { activeDocument?.duplicateFromMenu() }
    @objc private func exportPNG() { activeDocument?.exportPNGFromMenu() }
    @objc private func exportPDF() { activeDocument?.exportPDFFromMenu() }
    @objc private func shareActive() { activeDocument?.shareFromMenu() }
    @objc private func togglePin() { activeDocument?.togglePinFromMenu() }
    @objc private func showSettings() { NSApp.sendAction(Selector(("showSettingsWindow:")), to: nil, from: nil) }
    @objc private func openWebsite() { NSWorkspace.shared.open(catalogURL) }
    @objc private func openRecent(_ sender: NSMenuItem) { if let url = sender.representedObject as? URL { openDocument(url) } }
    @objc private func clearRecent() { NSDocumentController.shared.clearRecentDocuments(nil) }
    private var activeDocument: SlopDocumentWindowController? { let candidate = NSApp.keyWindow ?? NSApp.mainWindow; return documents.values.first { $0.owns(candidate) } }

    private func installMenus() {
        let main = NSMenu(), appItem = NSMenuItem(), fileItem = NSMenuItem(), editItem = NSMenuItem(), windowItem = NSMenuItem(), helpItem = NSMenuItem()
        main.addItem(appItem); main.addItem(fileItem); main.addItem(editItem); main.addItem(windowItem); main.addItem(helpItem)

        let app = NSMenu(title: "hitSlop"); appItem.submenu = app
        app.addItem(withTitle: "About hitSlop", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        let updates = app.addItem(withTitle: "Check for Updates…", action: #selector(SPUStandardUpdaterController.checkForUpdates(_:)), keyEquivalent: "")
        updates.target = updaterController
        app.addItem(.separator())
        item(app, "Settings…", #selector(showSettings), ",")
        app.addItem(.separator())
        let services = NSMenuItem(title: "Services", action: nil, keyEquivalent: "")
        let servicesMenu = NSMenu(title: "Services")
        services.submenu = servicesMenu
        NSApp.servicesMenu = servicesMenu
        app.addItem(services)
        app.addItem(.separator())
        app.addItem(withTitle: "Hide hitSlop", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        let hideOthers = app.addItem(withTitle: "Hide Others", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h")
        hideOthers.keyEquivalentModifierMask = [.command, .option]
        app.addItem(withTitle: "Show All", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        app.addItem(.separator())
        app.addItem(withTitle: "Quit hitSlop", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        let file = NSMenu(title: "File"); fileItem.submenu = file
        item(file, "New from Template…", #selector(showCatalog), "n")
        item(file, "Open…", #selector(openPanel), "o")
        let recentItem = NSMenuItem(title: "Open Recent", action: nil, keyEquivalent: "")
        let recent = NSMenu(title: "Open Recent"); recent.delegate = self; recentItem.submenu = recent; recentMenu = recent
        file.addItem(recentItem)
        file.addItem(.separator())
        item(file, "Duplicate…", #selector(duplicateActive), "d")
        let export = NSMenuItem(title: "Export", action: nil, keyEquivalent: ""), exportMenu = NSMenu(title: "Export"); export.submenu = exportMenu; file.addItem(export)
        item(exportMenu, "Export PNG…", #selector(exportPNG), ""); item(exportMenu, "Export PDF…", #selector(exportPDF), "")
        item(file, "Share…", #selector(shareActive), "")
        file.addItem(.separator())
        file.addItem(withTitle: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")

        let edit = NSMenu(title: "Edit"); editItem.submenu = edit
        edit.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        let redo = edit.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "z")
        redo.keyEquivalentModifierMask = [.command, .shift]
        edit.addItem(.separator())
        edit.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")

        let windows = NSMenu(title: "Window"); windowItem.submenu = windows
        windows.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windows.addItem(withTitle: "Zoom", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        item(windows, "Always on Top", #selector(togglePin), "")
        windows.addItem(.separator())
        windows.addItem(withTitle: "Bring All to Front", action: #selector(NSApplication.arrangeInFront(_:)), keyEquivalent: "")

        let help = NSMenu(title: "Help"); helpItem.submenu = help
        item(help, "hitSlop Website", #selector(openWebsite), "")

        NSApp.windowsMenu = windows
        NSApp.helpMenu = help
        NSApp.mainMenu = main
    }
    func menuNeedsUpdate(_ menu: NSMenu) {
        guard menu === recentMenu else { return }
        menu.removeAllItems()
        let urls = NSDocumentController.shared.recentDocumentURLs.filter {
            $0.pathExtension.lowercased() == "slop" && !DocumentFactory.isManagedTemplatePackage($0)
        }
        if urls.isEmpty {
            let empty = menu.addItem(withTitle: "No Recent Documents", action: nil, keyEquivalent: "")
            empty.isEnabled = false
        } else {
            for url in urls {
                let recent = menu.addItem(withTitle: url.lastPathComponent, action: #selector(openRecent(_:)), keyEquivalent: "")
                recent.representedObject = url
                recent.target = self
            }
            menu.addItem(.separator())
            let clear = menu.addItem(withTitle: "Clear Menu", action: #selector(clearRecent), keyEquivalent: "")
            clear.target = self
        }
    }
    @discardableResult private func item(_ menu: NSMenu, _ title: String, _ action: Selector, _ key: String) -> NSMenuItem { let value = menu.addItem(withTitle: title, action: action, keyEquivalent: key); value.target = self; return value }
    func validateMenuItem(_ menuItem: NSMenuItem) -> Bool {
        if [#selector(duplicateActive), #selector(exportPNG), #selector(exportPDF), #selector(shareActive), #selector(togglePin)].contains(menuItem.action) { if menuItem.action == #selector(togglePin) { menuItem.state = activeDocument?.isPinned == true ? .on : .off }; return activeDocument != nil }
        return true
    }
}

import AppKit
import HitSlopCatalog
import HitSlopHost
import SwiftUI
import UniformTypeIdentifiers

@main struct hitSlopApp: App {
    @NSApplicationDelegateAdaptor(HitSlopAppDelegate.self) private var delegate
    var body: some Scene { Settings { EmptyView() } }
}

@MainActor final class HitSlopAppDelegate: NSObject, NSApplicationDelegate, NSMenuItemValidation {
    private var catalog: NSWindowController?
    private var documents: [String: SlopDocumentWindowController] = [:]
    private var deploymentURL: String { Bundle.main.object(forInfoDictionaryKey: "ConvexDeploymentURL") as? String ?? "https://giddy-opossum-593.convex.cloud" }
    private var catalogURL: URL { URL(string: Bundle.main.object(forInfoDictionaryKey: "CatalogURL") as? String ?? "https://hitslop.app")! }

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular); installMenus()
        let urls = CommandLine.arguments.dropFirst().filter { $0.hasSuffix(".slop") }.map(URL.init(fileURLWithPath:))
        if urls.isEmpty { showCatalog() } else { urls.forEach(openDocument) }
    }
    func application(_ application: NSApplication, open urls: [URL]) { urls.filter { $0.pathExtension.lowercased() == "slop" }.forEach(openDocument) }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool { if !flag { showCatalog() }; return true }

    @objc func showCatalog() {
        if catalog == nil {
            let root = CatalogView(deploymentURL: deploymentURL, catalogURL: catalogURL, openDocument: { [weak self] in self?.openDocument($0) })
            let host = NSHostingController(rootView: root)
            let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1040, height: 720), styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView], backing: .buffered, defer: false)
            window.title = ""; window.titleVisibility = .hidden; window.titlebarAppearsTransparent = true; window.isReleasedWhenClosed = false
            window.minSize = NSSize(width: 760, height: 560); window.contentViewController = host; window.center(); catalog = NSWindowController(window: window)
        }
        catalog?.showWindow(nil); catalog?.window?.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
    }

    private func openDocument(_ url: URL) {
        let key = url.standardizedFileURL.path
        if let existing = documents[key] { existing.showWindow(nil); existing.window?.makeKeyAndOrderFront(nil); return }
        do {
            let controller = try SlopDocumentWindowController(packageURL: url)
            controller.onClose = { [weak self] in guard let self else { return }; self.documents.removeValue(forKey: key); if self.documents.isEmpty { self.showCatalog() } }
            controller.onOpenDocument = { [weak self] in self?.openDocument($0) }
            documents[key] = controller; controller.showWindow(nil); controller.window?.makeKeyAndOrderFront(nil)
            catalog?.window?.orderOut(nil); NSDocumentController.shared.noteNewRecentDocumentURL(url); NSApp.activate(ignoringOtherApps: true)
        } catch { let alert = NSAlert(error: error); alert.messageText = "Could not open slop"; alert.runModal() }
    }
    @objc private func openPanel() { let panel = NSOpenPanel(); panel.allowedContentTypes = [.slop]; panel.allowsMultipleSelection = true; guard panel.runModal() == .OK else { return }; panel.urls.forEach(openDocument) }
    @objc private func duplicateActive() { activeDocument?.duplicateFromMenu() }
    @objc private func exportPNG() { activeDocument?.exportPNGFromMenu() }
    @objc private func exportPDF() { activeDocument?.exportPDFFromMenu() }
    @objc private func shareActive() { activeDocument?.shareFromMenu() }
    @objc private func togglePin() { activeDocument?.togglePinFromMenu() }
    private var activeDocument: SlopDocumentWindowController? { let candidate = NSApp.keyWindow ?? NSApp.mainWindow; return documents.values.first { $0.owns(candidate) } }

    private func installMenus() {
        let main = NSMenu(), appItem = NSMenuItem(), fileItem = NSMenuItem(), editItem = NSMenuItem(), windowItem = NSMenuItem()
        main.addItem(appItem); main.addItem(fileItem); main.addItem(editItem); main.addItem(windowItem)
        let app = NSMenu(title: "hitSlop"); appItem.submenu = app
        app.addItem(withTitle: "About hitSlop", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: ""); app.addItem(.separator()); app.addItem(withTitle: "Hide hitSlop", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h"); app.addItem(.separator()); app.addItem(withTitle: "Quit hitSlop", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        let file = NSMenu(title: "File"); fileItem.submenu = file
        item(file, "New from Template…", #selector(showCatalog), "n"); item(file, "Open…", #selector(openPanel), "o"); file.addItem(.separator()); item(file, "Duplicate…", #selector(duplicateActive), "d")
        let export = NSMenuItem(title: "Export", action: nil, keyEquivalent: ""), exportMenu = NSMenu(title: "Export"); export.submenu = exportMenu; file.addItem(export)
        item(exportMenu, "Export PNG…", #selector(exportPNG), ""); item(exportMenu, "Export PDF…", #selector(exportPDF), ""); item(file, "Share…", #selector(shareActive), ""); file.addItem(.separator()); file.addItem(withTitle: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        let edit = NSMenu(title: "Edit"); editItem.submenu = edit
        edit.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x"); edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c"); edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v"); edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        let windows = NSMenu(title: "Window"); windowItem.submenu = windows; windows.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m"); item(windows, "Always on Top", #selector(togglePin), ""); NSApp.windowsMenu = windows; NSApp.mainMenu = main
    }
    @discardableResult private func item(_ menu: NSMenu, _ title: String, _ action: Selector, _ key: String) -> NSMenuItem { let value = menu.addItem(withTitle: title, action: action, keyEquivalent: key); value.target = self; return value }
    func validateMenuItem(_ menuItem: NSMenuItem) -> Bool {
        if [#selector(duplicateActive), #selector(exportPNG), #selector(exportPDF), #selector(shareActive), #selector(togglePin)].contains(menuItem.action) { if menuItem.action == #selector(togglePin) { menuItem.state = activeDocument?.isPinned == true ? .on : .off }; return activeDocument != nil }
        return true
    }
}

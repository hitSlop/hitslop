import AppKit
import SlopCore
import UniformTypeIdentifiers

@MainActor
public final class HitSlopApplicationDelegate: NSObject, NSApplicationDelegate, NSMenuItemValidation {
    private var picker: TemplatePickerWindowController?
    private var documents: [String: SlopDocumentWindowController] = [:]

    public override init() { super.init() }

    public func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        installMenus()
        let arguments = CommandLine.arguments.dropFirst().filter { !$0.hasPrefix("-") }
        for argument in arguments where argument.hasSuffix(".slop") {
            openDocument(at: URL(fileURLWithPath: argument))
        }
        DispatchQueue.main.async { [weak self] in
            guard let self, self.documents.isEmpty else { return }
            self.showTemplatePicker()
        }
    }

    public func application(_ application: NSApplication, open urls: [URL]) {
        urls.forEach(openDocument)
    }

    public func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
    public func applicationShouldSaveApplicationState(_ app: NSApplication) -> Bool { false }
    public func applicationShouldRestoreApplicationState(_ app: NSApplication) -> Bool { false }

    public func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !flag { showTemplatePicker() }
        return true
    }

    @objc public func showTemplatePicker() {
        if let picker {
            picker.showWindow(nil)
            picker.window?.makeKeyAndOrderFront(nil)
            return
        }
        let controller = TemplatePickerWindowController(
            recents: NSDocumentController.shared.recentDocumentURLs,
            create: { [weak self] template in self?.createDocument(from: template) },
            openRecent: { [weak self] url in self?.openDocument(at: url) },
            openExisting: { [weak self] in self?.showOpenPanel() },
            clearRecents: { [weak self] in self?.clearRecentsAndRefreshPicker() }
        )
        picker = controller
        controller.showWindow(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    @objc public func showOpenPanel() {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.canChooseFiles = true
        panel.treatsFilePackagesAsDirectories = false
        panel.allowedContentTypes = [.slop]
        panel.message = "Open an ElementaryUI .slop app"
        guard panel.runModal() == .OK, let url = panel.url else { return }
        openDocument(at: url)
    }

    public func openDocument(at url: URL) {
        let canonical = url.standardizedFileURL.path
        if let existing = documents[canonical] {
            existing.showWindow(nil)
            existing.window?.makeKeyAndOrderFront(nil)
            return
        }
        do {
            let controller = try SlopDocumentWindowController(packageURL: url)
            controller.onClose = { [weak self] in self?.documents.removeValue(forKey: canonical) }
            controller.onOpenDocument = { [weak self] newURL in self?.openDocument(at: newURL) }
            documents[canonical] = controller
            controller.showWindow(nil)
            controller.window?.makeKeyAndOrderFront(nil)
            picker?.close()
            picker = nil
            NSDocumentController.shared.noteNewRecentDocumentURL(url)
            installMenus()
            NSApp.activate(ignoringOtherApps: true)
        } catch {
            present(error: error, title: "Could not open document")
        }
    }

    @objc private func clearRecentDocuments() {
        NSDocumentController.shared.clearRecentDocuments(nil)
        installMenus()
    }

    private func clearRecentsAndRefreshPicker() {
        NSDocumentController.shared.clearRecentDocuments(nil)
        picker?.close()
        picker = nil
        installMenus()
        showTemplatePicker()
    }

    @objc private func openRecentDocument(_ sender: NSMenuItem) {
        guard let url = sender.representedObject as? URL else { return }
        openDocument(at: url)
    }

    @objc private func showSettings(_ sender: Any?) {
        NSApp.sendAction(Selector(("showSettingsWindow:")), to: nil, from: sender)
    }

    @objc private func duplicateActiveDocument() { activeDocument?.duplicateFromMenu() }
    @objc private func exportActivePNG() { activeDocument?.exportPNGFromMenu() }
    @objc private func exportActivePDF() { activeDocument?.exportPDFFromMenu() }
    @objc private func shareActiveDocument() { activeDocument?.shareFromMenu() }
    @objc private func showActiveAppearance() { activeDocument?.showAppearance() }
    @objc private func toggleActivePin() { activeDocument?.togglePinFromMenu() }

    private var activeDocument: SlopDocumentWindowController? {
        let candidate = NSApp.keyWindow ?? NSApp.mainWindow
        return documents.values.first { $0.owns(candidate) }
    }

    private func createDocument(from template: SlopTemplateDescriptor) {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.slop]
        panel.canCreateDirectories = true
        panel.prompt = "Create"
        panel.nameFieldStringValue = template.suggestedFilename
        guard panel.runModal() == .OK, let requestedURL = panel.url else { return }
        do {
            let title = requestedURL.deletingPathExtension().lastPathComponent
            let packageURL = try SlopDuplicator.duplicate(from: template.url, to: requestedURL, title: title)
            openDocument(at: packageURL)
            picker?.close()
            picker = nil
        } catch {
            present(error: error, title: "Could not create document")
        }
    }

    private func installMenus() {
        let main = NSMenu()
        let appItem = NSMenuItem()
        main.addItem(appItem)
        let appMenu = NSMenu(title: "hitSlop")
        appItem.submenu = appMenu
        appMenu.addItem(withTitle: "About hitSlop", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        let settings = appMenu.addItem(withTitle: "Settings…", action: #selector(showSettings(_:)), keyEquivalent: ",")
        settings.target = self
        appMenu.addItem(.separator())
        let services = NSMenu(title: "Services")
        let servicesItem = appMenu.addItem(withTitle: "Services", action: nil, keyEquivalent: "")
        servicesItem.submenu = services
        NSApp.servicesMenu = services
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Hide hitSlop", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        let hideOthers = appMenu.addItem(withTitle: "Hide Others", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h")
        hideOthers.keyEquivalentModifierMask = [.command, .option]
        appMenu.addItem(withTitle: "Show All", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit hitSlop", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        let fileItem = NSMenuItem()
        main.addItem(fileItem)
        let fileMenu = NSMenu(title: "File")
        fileItem.submenu = fileMenu
        let newItem = fileMenu.addItem(withTitle: "New from Template…", action: #selector(showTemplatePicker), keyEquivalent: "n")
        newItem.target = self
        let openItem = fileMenu.addItem(withTitle: "Open…", action: #selector(showOpenPanel), keyEquivalent: "o")
        openItem.target = self
        let recentItem = fileMenu.addItem(withTitle: "Open Recent", action: nil, keyEquivalent: "")
        let recentMenu = NSMenu(title: "Open Recent")
        recentItem.submenu = recentMenu
        let recentURLs = NSDocumentController.shared.recentDocumentURLs.filter { FileManager.default.fileExists(atPath: $0.path) }
        if recentURLs.isEmpty {
            recentMenu.addItem(withTitle: "No Recent Documents", action: nil, keyEquivalent: "").isEnabled = false
        } else {
            for url in recentURLs {
                let item = recentMenu.addItem(
                    withTitle: url.deletingPathExtension().lastPathComponent,
                    action: #selector(openRecentDocument(_:)),
                    keyEquivalent: ""
                )
                item.target = self
                item.representedObject = url
            }
            recentMenu.addItem(.separator())
            let clear = recentMenu.addItem(withTitle: "Clear Menu", action: #selector(clearRecentDocuments), keyEquivalent: "")
            clear.target = self
        }
        fileMenu.addItem(.separator())
        targetedItem(fileMenu, "Duplicate", #selector(duplicateActiveDocument), "d")
        let exportItem = fileMenu.addItem(withTitle: "Export", action: nil, keyEquivalent: "")
        let exportMenu = NSMenu(title: "Export")
        exportItem.submenu = exportMenu
        targetedItem(exportMenu, "Export PNG…", #selector(exportActivePNG), "")
        targetedItem(exportMenu, "Export PDF…", #selector(exportActivePDF), "")
        targetedItem(fileMenu, "Share…", #selector(shareActiveDocument), "")
        fileMenu.addItem(.separator())
        fileMenu.addItem(withTitle: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")

        let editItem = NSMenuItem()
        main.addItem(editItem)
        let editMenu = NSMenu(title: "Edit")
        editItem.submenu = editMenu
        editMenu.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")

        let viewItem = NSMenuItem()
        main.addItem(viewItem)
        let viewMenu = NSMenu(title: "View")
        viewItem.submenu = viewMenu
        let appearance = targetedItem(viewMenu, "Appearance…", #selector(showActiveAppearance), "a")
        appearance.keyEquivalentModifierMask = [.command, .shift]
        targetedItem(viewMenu, "Reload Theme", #selector(reloadActiveTheme), "r")

        let windowItem = NSMenuItem()
        main.addItem(windowItem)
        let windowMenu = NSMenu(title: "Window")
        windowItem.submenu = windowMenu
        windowMenu.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "Zoom", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        windowMenu.addItem(.separator())
        targetedItem(windowMenu, "Always on Top", #selector(toggleActivePin), "")
        windowMenu.addItem(.separator())
        windowMenu.addItem(withTitle: "Bring All to Front", action: #selector(NSApplication.arrangeInFront(_:)), keyEquivalent: "")
        NSApp.windowsMenu = windowMenu
        NSApp.mainMenu = main
    }

    @objc private func reloadActiveTheme() { activeDocument?.reloadThemeFromMenu() }

    @discardableResult
    private func targetedItem(_ menu: NSMenu, _ title: String, _ action: Selector, _ key: String) -> NSMenuItem {
        let item = menu.addItem(withTitle: title, action: action, keyEquivalent: key)
        item.target = self
        return item
    }

    public func validateMenuItem(_ menuItem: NSMenuItem) -> Bool {
        switch menuItem.action {
        case #selector(duplicateActiveDocument), #selector(exportActivePNG), #selector(exportActivePDF),
             #selector(shareActiveDocument), #selector(showActiveAppearance), #selector(reloadActiveTheme),
             #selector(toggleActivePin):
            if menuItem.action == #selector(toggleActivePin) {
                menuItem.state = activeDocument?.isPinned == true ? .on : .off
            }
            return activeDocument != nil
        default:
            return true
        }
    }

    private func present(error: Error, title: String) {
        let alert = NSAlert(error: error)
        alert.messageText = title
        alert.runModal()
    }
}

public extension UTType {
    static let slop = UTType(exportedAs: "com.hitslop.slop", conformingTo: .package)
}

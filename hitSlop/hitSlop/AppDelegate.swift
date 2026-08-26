import AppKit
import UniformTypeIdentifiers

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    private var picker: TemplatePickerWindowController?
    private var documents: [String: SlopDocumentWindowController] = [:]
    private var keyboardMonitor: Any?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        installMenus()
        installKeyboardMonitor()

        let arguments = CommandLine.arguments.dropFirst().filter { !$0.hasPrefix("-") }
        for argument in arguments where argument.hasSuffix(".slop") {
            openDocument(at: URL(fileURLWithPath: argument))
        }
        DispatchQueue.main.async { [weak self] in
            guard let self, self.documents.isEmpty else { return }
            self.showTemplatePicker()
        }
    }

    func application(_ application: NSApplication, open urls: [URL]) {
        urls.forEach(openDocument)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }
    func applicationShouldSaveApplicationState(_ app: NSApplication) -> Bool { false }
    func applicationShouldRestoreApplicationState(_ app: NSApplication) -> Bool { false }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !flag { showTemplatePicker() }
        return true
    }

    func applicationWillTerminate(_ notification: Notification) {
        if let keyboardMonitor { NSEvent.removeMonitor(keyboardMonitor) }
    }

    @objc func showTemplatePicker() {
        if let picker {
            picker.showWindow(nil)
            picker.window?.makeKeyAndOrderFront(nil)
            return
        }
        let controller = TemplatePickerWindowController(
            create: { [weak self] template in self?.createDocument(from: template) },
            openExisting: { [weak self] in self?.showOpenPanel() }
        )
        picker = controller
        controller.showWindow(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    @objc func showOpenPanel() {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.canChooseFiles = true
        panel.treatsFilePackagesAsDirectories = false
        panel.allowedContentTypes = [.slop]
        panel.message = "Open a .slop document"
        guard panel.runModal() == .OK, let url = panel.url else { return }
        openDocument(at: url)
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
            let packageURL = try SlopPackage.clone(from: template.url, to: requestedURL, title: title)
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                self.openDocument(at: packageURL)
                self.picker?.close()
                self.picker = nil
            }
        } catch {
            present(error: error, title: "Could not create document")
        }
    }

    func openDocument(at url: URL) {
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
            controller.window?.orderFrontRegardless()
            picker?.close()
            picker = nil
            NSDocumentController.shared.noteNewRecentDocumentURL(url)
            NSApp.activate(ignoringOtherApps: true)
        } catch {
            present(error: error, title: "Could not open document")
        }
    }

    private func present(error: Error, title: String) {
        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = title
        alert.informativeText = error.localizedDescription
        alert.runModal()
    }

    private func installMenus() {
        let main = NSMenu()

        let appItem = NSMenuItem()
        main.addItem(appItem)
        let appMenu = NSMenu()
        appItem.submenu = appMenu
        appMenu.addItem(withTitle: "About hitSlop", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
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
        fileMenu.addItem(.separator())
        let closeItem = fileMenu.addItem(withTitle: "Close", action: #selector(closeKeyWindow), keyEquivalent: "w")
        closeItem.target = self

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

        NSApp.mainMenu = main
    }

    @objc private func closeKeyWindow() {
        NSApp.keyWindow?.performClose(nil)
    }

    private func installKeyboardMonitor() {
        keyboardMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            guard event.modifierFlags.intersection(.deviceIndependentFlagsMask) == .command,
                  event.charactersIgnoringModifiers?.lowercased() == "w",
                  NSApp.keyWindow is FramelessDocumentWindow
            else { return event }
            self?.closeKeyWindow()
            return nil
        }
    }
}

extension UTType {
    static let slop = UTType(exportedAs: "com.hitslop.slop", conformingTo: .package)
}

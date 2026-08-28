import AppKit
import SlopCore
import UniformTypeIdentifiers

@MainActor
public final class HitSlopApplicationDelegate: NSObject, NSApplicationDelegate {
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
            create: { [weak self] template in self?.createDocument(from: template) },
            openExisting: { [weak self] in self?.showOpenPanel() }
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
            NSApp.activate(ignoringOtherApps: true)
        } catch {
            present(error: error, title: "Could not open document")
        }
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
        NSApp.mainMenu = main
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

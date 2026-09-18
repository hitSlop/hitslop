import AppKit
import ComposableArchitecture
import HitSlopCore
import HitSlopFeatures
import HitSlopFirebase
import HitSlopHost
import HitSlopRuntime
import SwiftUI

/// The macOS composition root. Stores own decisions; services own native resources.
@MainActor public final class SlopApplicationCoordinator {
    let store: StoreOf<AppFeature>
    private let accountServices: AccountServices
    private let presentsWindows: Bool
    private let alerts = NativeAlertPresenter()
    private let native: NativeDocumentServices
    private let catalogServices: CatalogServices
    private var catalogWindow: NSWindowController?
    private var observation: ObserveToken?
    private var documentObservations: [UUID: ObserveToken] = [:]
    private var sharing: [UUID: DocumentSharing] = [:]
    private var invitationPanel: NSPanel?

    // NotificationCenter removal is thread-safe; registration and all callbacks stay on MainActor.
    nonisolated(unsafe) private var notifications: [NSObjectProtocol] = []
    private var previousDocumentCount = 0

    public convenience init(catalogURL: URL, templatesURL: URL = DocumentFactory.defaultTemplatesRoot) {
        self.init(catalogURL: catalogURL, templatesURL: templatesURL, presentsWindows: true)
    }

    /// Native integration tests use hidden windows and avoid modifying the user's recents.
    init(catalogURL: URL, templatesURL: URL, presentsWindows: Bool) {
        let accountServices = AccountServices()
        self.accountServices = accountServices
        self.presentsWindows = presentsWindows
        let native = NativeDocumentServices(templatesURL: templatesURL, presentsWindows: presentsWindows)
        let catalogServices = CatalogServices(catalogURL: catalogURL, templatesURL: templatesURL)
        self.native = native; self.catalogServices = catalogServices
        store = Store(initialState: AppFeature.State()) { AppFeature() } withDependencies: {
            $0.catalogClient = presentsWindows ? catalogServices.client : .empty
            $0.documentClient = native.client
            $0.accountClient = presentsWindows ? accountServices.client : .empty
        }
        if presentsWindows { store.send(.account(.start)) }
        native.onOpened = { [weak self] id, controller in self?.connect(id, controller: controller) }
        native.onFocused = { [weak self] in self?.updateFocus() }
        observation = observe { [weak self] in
            guard let self else { return }
            let count = self.store.documents.count
            if count == 0 && self.previousDocumentCount > 0 && self.store.quitPhase == .running { self.showCatalog() }
            self.previousDocumentCount = count
            if self.presentsWindows, let alert = self.store.alert {
                self.alerts.enqueue(alert, window: NSApp.keyWindow ?? self.catalogWindow?.window, isCurrent: { [weak self] in
                    self?.store.alert?.id == alert.id
                }, dismiss: { [weak self] in self?.store.send(.alert(.dismiss)) }, send: { [weak self] action in self?.store.send(.alert(.presented(action))) })
            }
        }
        for name in [NSWindow.didBecomeKeyNotification, NSWindow.didResignKeyNotification, NSWindow.didBecomeMainNotification, NSWindow.didResignMainNotification] {
            notifications.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                Task { @MainActor in self?.updateFocus() }
            })
        }
    }

    deinit { for token in notifications { NotificationCenter.default.removeObserver(token) } }

    public var accountSettings: some View { AccountSettingsView(store: store.scope(state: \.account, action: \.account)) }
    public func handleAuthenticationURL(_ url: URL) -> Bool { accountServices.handle(url) }
    public func handleSharingURL(_ url: URL) -> Bool {
        guard url.scheme == "hitslop" else { return false }
        guard let invitation = SharingInvitation(url: url) else {
            store.send(.externalFailure("This hitSlop invitation is invalid.")); return true
        }
        let model = JoinSharingModel(
            account: store.scope(state: \.account, action: \.account),
            invitation: invitation,
            api: cloudAPI,
            opened: { [weak self] in self?.openDocument($0) }
        )
        let panel = NSPanel(contentRect: NSRect(x: 0, y: 0, width: 380, height: 300), styleMask: [.titled, .closable], backing: .buffered, defer: false)
        panel.isReleasedWhenClosed = false; panel.title = "Join document"
        panel.contentViewController = NSHostingController(rootView: JoinSharingView(model: model))
        model.finished = { [weak panel] in panel?.close() }
        invitationPanel?.close(); invitationPanel = panel
        panel.center(); panel.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
        return true
    }
    private var cloudAPI: SlopCloudAPI {
        SlopCloudAPI(origin: catalogServices.catalogURL) { [accountServices] in try await accountServices.idToken() }
    }

    public var hasOpenDocuments: Bool { !store.documents.isEmpty }
    public var documentControllers: [SlopDocumentWindowController] { Array(native.controllers.values) }
    public var canPerformDocumentCommands: Bool {
        guard let id = activeID else { return false }
        return store.documents[id: id]?.acceptsCommands == true
    }
    public var isActiveDocumentPinned: Bool { activeID.flatMap { store.documents[id: $0]?.isPinned } ?? false }
    private var activeID: UUID? {
        // Resolve at invocation as well as observing focus; modal panels cannot retarget an existing operation.
        let candidate = NSApp.keyWindow ?? NSApp.mainWindow
        return native.controllers.first { $0.value.owns(candidate) }?.key
    }
    private func updateFocus() { store.send(.focused(activeID)) }

    public func showCatalog() {
        guard presentsWindows, store.quitPhase == .running else { return }
        if catalogWindow == nil {
            let host = NSHostingController(rootView: CatalogView(store: store.scope(state: \.catalog, action: \.catalog), account: store.scope(state: \.account, action: \.account)))
            let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1040, height: 720), styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView], backing: .buffered, defer: false)
            window.title = ""; window.titleVisibility = .hidden; window.titlebarAppearsTransparent = true; window.isReleasedWhenClosed = false
            window.minSize = NSSize(width: 900, height: 600); window.contentViewController = host; window.center()
            catalogWindow = NSWindowController(window: window)
        }
        catalogWindow?.showWindow(nil); catalogWindow?.window?.deminiaturize(nil)
        catalogWindow?.window?.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
    }

    public func openDocument(_ url: URL) {
        guard store.quitPhase == .running else { return }
        let canonical = url.standardizedFileURL.resolvingSymlinksInPath()
        if DocumentFactory.isManagedTemplatePackage(canonical, templatesRoot: catalogServices.templatesURL) {
            showCatalog()
            Task { do {
                let package = try await SlopPreparation.run {
                    let package = try SlopPackage(rootURL: canonical)
                    try package.validateAsTemplate()
                    return package
                }
                guard store.quitPhase == .running else { return }
                var entry = CatalogEntry(id: "local:\(package.manifest.slug)", source: .local(canonical), title: package.manifest.title)
                CatalogServices.apply(package.manifest, to: &entry)
                store.send(.catalog(.primaryAction(entry)))
            } catch { store.send(.externalFailure(error.localizedDescription)) } }
        } else { store.send(.openDocument(canonical)) }
    }
    public func revealDocuments() {
        for controller in native.controllers.values { controller.revealFromDock() }
        NSApp.activate(ignoringOtherApps: true)
    }
    public func sendToActiveDocument(_ command: SlopDocumentCommand) {
        guard let id = activeID else { return }
        store.send(.documents(.element(id: id, action: .command(command.featureCommand))))
    }
    public func clearRecentDocuments() {
        NSDocumentController.shared.clearRecentDocuments(nil)
        store.send(.catalog(.refreshRecents))
    }
    public func requestQuit() { store.send(.quitRequested) }

    private func send(_ action: DocumentFeature.Action, to id: UUID) {
        guard store.documents[id: id] != nil else { return }
        store.send(.documents(.element(id: id, action: action)))
    }
    private func connect(_ id: UUID, controller: SlopDocumentWindowController) {
        controller.onCommand = { [weak self] command in self?.send(.command(command.featureCommand), to: id) }
        controller.onRuntimeReady = { [weak self] in self?.send(.runtimeReady, to: id) }
        controller.onRuntimeFailure = { [weak self] message in self?.send(.runtimeFailed(message), to: id) }
        let sharing = DocumentSharing(controller: controller, account: store.scope(state: \.account, action: \.account), api: cloudAPI)
        self.sharing[id] = sharing
        if presentsWindows { sharing.start() }
        controller.onShare = { sharing.show() }
        controller.onPrepareClose = { await sharing.pauseAndDrain() }
        controller.onCloseCancelled = { sharing.reconnect() }
        controller.onClose = { [weak self] in
            self?.sharing[id]?.stop()
            self?.sharing[id] = nil
            self?.documentObservations.removeValue(forKey: id)
        }
        if let document = store.scope(state: \.documents[id: id], action: \.documents[id: id]) {
            documentObservations[id] = observe { [weak self, weak controller] in
                controller?.updatePresentation(pinned: document.isPinned, commandsEnabled: document.acceptsCommands, runtimeError: document.runtimeError)
                if self?.presentsWindows == true, let alert = document.alert {
                    self?.alerts.enqueue(alert, window: controller?.window, isCurrent: { [weak self] in
                        self?.store.documents[id: id]?.alert?.id == alert.id
                    }, dismiss: { [weak self] in self?.send(.alert(.dismiss), to: id) })
                }
            }
        }
        catalogWindow?.window?.orderOut(nil)
    }

}

@MainActor private final class NativeDocumentServices {
    private let templatesURL: URL
    private let presentsWindows: Bool
    init(templatesURL: URL, presentsWindows: Bool) { self.templatesURL = templatesURL; self.presentsWindows = presentsWindows }
    var controllers: [UUID: SlopDocumentWindowController] = [:]
    var onOpened: ((UUID, SlopDocumentWindowController) -> Void)?
    var onFocused: (() -> Void)?
    var client: DocumentClient {
        DocumentClient(
            open: { [self] id, url in try await open(id, url: url) },
            focus: { [self] id in await focus(id) },
            perform: { [self] id, command in try await perform(id, command: command) },
            prepareToQuit: { [self] id in try await prepareToQuit(id) },
            finishAssetRefreshes: { await SlopDocumentWindowController.finishAssetRefreshesForTermination() },
            replyToQuit: { allowed in await MainActor.run { NSApp.reply(toApplicationShouldTerminate: allowed) } }
        )
    }
    func controller(_ id: UUID) throws -> SlopDocumentWindowController {
        guard let controller = controllers[id] else { throw SlopPackageError.invalid("The document is no longer open.") }
        return controller
    }
    private func open(_ id: UUID, url: URL) async throws -> String {
        guard !DocumentFactory.isManagedTemplatePackage(url, templatesRoot: templatesURL) else {
            throw SlopPackageError.invalid("Create a document from this template before opening it.")
        }
        try Task.checkCancellation()
        let controller = try await SlopDocumentWindowController.open(packageURL: url)
        controllers[id] = controller
        onOpened?(id, controller)
        if presentsWindows {
            controller.showWindow(nil); controller.window?.makeKeyAndOrderFront(nil)
            NSDocumentController.shared.noteNewRecentDocumentURL(url); NSApp.activate(ignoringOtherApps: true)
        }
        onFocused?()
        HitSlopFirebase.log("document_opened")
        return controller.documentTitle
    }
    private func prepareToQuit(_ id: UUID) async throws { try await controller(id).prepareToClose() }
    private func focus(_ id: UUID) { if presentsWindows { controllers[id]?.revealFromDock(); NSApp.activate(ignoringOtherApps: true) }; onFocused?() }
    private func perform(_ id: UUID, command: DocumentCommand) async throws -> URL? {
        let controller = try controller(id)
        let result = try await controller.perform(command.nativeCommand)
        if command == .close { controllers.removeValue(forKey: id) }
        return result
    }
}

private extension SlopDocumentCommand {
    var featureCommand: DocumentCommand {
        switch self {
        case .pin(let value): .pin(value)
        case .exportPNG: .exportPNG
        case .exportPDF: .exportPDF
        case .duplicate: .duplicate
        case .share: .share
        case .reveal: .reveal
        case .copyPath: .copyPath
        case .openEditor(let url): .openEditor(url)
        case .retry: .retry
        case .close: .close
        }
    }
}
private extension DocumentCommand {
    var nativeCommand: SlopDocumentCommand {
        switch self {
        case .pin(let value): .pin(value)
        case .exportPNG: .exportPNG
        case .exportPDF: .exportPDF
        case .duplicate: .duplicate
        case .share: .share
        case .reveal: .reveal
        case .copyPath: .copyPath
        case .openEditor(let url): .openEditor(url)
        case .retry: .retry
        case .close: .close
        }
    }
}

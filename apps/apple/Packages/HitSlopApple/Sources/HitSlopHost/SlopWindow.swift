import AppKit
import HitSlopCore
import HitSlopRuntime
import HitSlopWasm
import SwiftUI
import UniformTypeIdentifiers

private final class FramelessDocumentWindow: NSWindow {
  override var canBecomeKey: Bool { true }
  override var canBecomeMain: Bool { true }
  override func performMiniaturize(_ sender: Any?) { miniaturize(sender) }
  override func performClose(_ sender: Any?) {
    if delegate?.windowShouldClose?(self) ?? true { close() }
  }
  override func validateMenuItem(_ menuItem: NSMenuItem) -> Bool {
    // AppKit disables Close for borderless windows despite our custom
    // performClose implementation and asynchronous save-on-close delegate.
    if menuItem.action == #selector(NSWindow.performClose(_:)) { return true }
    return super.validateMenuItem(menuItem)
  }
}

func slopDocumentWindowStyleMask(resizable: Bool) -> NSWindow.StyleMask {
  var mask: NSWindow.StyleMask = [.borderless, .miniaturizable]
  if resizable { mask.insert(.resizable) }
  return mask
}

func slopDockMenuImage(iconURL: URL, fallbackURL: URL) -> NSImage {
  let source = NSImage(contentsOf: iconURL) ?? NSWorkspace.shared.icon(forFile: fallbackURL.path)
  let image = (source.copy() as? NSImage) ?? source
  image.size = NSSize(width: 16, height: 16)
  return image
}

func dynamicSlopWindowFrame(current: NSRect, requested: NSSize, visible: NSRect?) -> NSRect {
  let size = NSSize(
    width: min(requested.width, visible?.width ?? requested.width),
    height: min(requested.height, visible?.height ?? requested.height)
  )
  var origin = NSPoint(x: current.minX, y: current.maxY - size.height)
  if let visible {
    origin.x = min(max(origin.x, visible.minX), visible.maxX - size.width)
    origin.y = min(max(origin.y, visible.minY), visible.maxY - size.height)
  }
  return NSRect(origin: origin, size: size)
}

private class HoverView: NSView {
  var changed: ((Bool) -> Void)?
  private var area: NSTrackingArea?
  override func updateTrackingAreas() {
    if let area { removeTrackingArea(area) }
    let next = NSTrackingArea(
      rect: bounds, options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect], owner: self)
    addTrackingArea(next)
    area = next
    super.updateTrackingAreas()
  }
  override func mouseEntered(with event: NSEvent) { changed?(true) }
  override func mouseExited(with event: NSEvent) { changed?(false) }
}

private final class ShapedView: HoverView {
  let windowMask: SlopWindowMask
  private let maskLayer: CALayer
  init(frame: NSRect, windowMask: SlopWindowMask) {
    self.windowMask = windowMask
    maskLayer = windowMask.makeLayer()
    super.init(frame: frame)
    wantsLayer = true
    windowMask.installBacking(on: layer)
    layer?.mask = maskLayer
  }
  required init?(coder: NSCoder) { nil }
  override func layout() {
    super.layout()
    windowMask.update(maskLayer, bounds: bounds)
  }
  override func hitTest(_ point: NSPoint) -> NSView? {
    windowMask.contains(point, in: bounds) ? super.hitTest(point) : nil
  }
}

@MainActor final class SlopToolbarDragHandleView: NSImageView {
  var onDrag: (NSEvent) -> Void

  init(onDrag: @escaping (NSEvent) -> Void) {
    self.onDrag = onDrag
    super.init(frame: .zero)
    image = NSImage(
      systemSymbolName: "circle.grid.3x3.fill", accessibilityDescription: "Drag window")?
      .withSymbolConfiguration(.init(pointSize: 8, weight: .medium))
    imageScaling = .scaleProportionallyDown
    contentTintColor = .secondaryLabelColor
    setAccessibilityElement(true)
    setAccessibilityLabel("Drag window")
  }

  required init?(coder: NSCoder) { nil }
  override func resetCursorRects() {
    super.resetCursorRects()
    addCursorRect(bounds, cursor: .openHand)
  }
  override func mouseDown(with event: NSEvent) { onDrag(event) }
}

private struct ToolbarDragHandle: NSViewRepresentable {
  let onDrag: (NSEvent) -> Void

  func makeNSView(context: Context) -> SlopToolbarDragHandleView {
    SlopToolbarDragHandleView(onDrag: onDrag)
  }
  func updateNSView(_ view: SlopToolbarDragHandleView, context: Context) { view.onDrag = onDrag }
}

@MainActor enum SlopDocumentAssetRefreshQueue {
  private struct Job {
    let snapshot: SlopRenderSnapshot
    let destination: URL
    let generation: UUID
  }
  private static var generations: [URL: UUID] = [:]
  private static var pending: [Job] = []
  private static var worker: Task<Void, Never>?
  private static var rendering = false

  static func invalidate(_ url: URL) {
    let key = url.standardizedFileURL
    generations[key] = UUID()
    pending.removeAll { $0.destination == key }
  }
  static func schedule(snapshot: SlopRenderSnapshot, presentedURL: URL) {
    let key = presentedURL.standardizedFileURL
    invalidate(key)
    let generation = generations[key]!
    pending.append(Job(snapshot: snapshot, destination: key, generation: generation))
    startWorkerIfNeeded()
  }
  private static func startWorkerIfNeeded() {
    guard worker == nil, !pending.isEmpty else { return }
    worker = Task { @MainActor in
      defer {
        rendering = false
        worker = nil
        startWorkerIfNeeded()
      }
      while !pending.isEmpty, !Task.isCancelled {
        let job = pending.removeFirst()
        rendering = true
        defer { rendering = false }
        do {
          let assets = try await SlopRenderer.documentAssetsPNGData(snapshot: job.snapshot)
          guard !Task.isCancelled, generations[job.destination] == job.generation else { continue }
          if let preview = assets.previewPNG {
            do { try SlopPreviewWriter.write(preview, to: job.destination) } catch {
              print("[hitSlop assets] Preview write failed: \(error.localizedDescription)")
            }
          }
          if let icon = assets.finderIconPNG {
            await SlopPreviewWriter.installFinderIconAsync(
              icon, for: job.destination,
              isCurrent: { generations[job.destination] == job.generation && !Task.isCancelled })
          }
        } catch { print("[hitSlop assets] Refresh failed: \(error.localizedDescription)") }
      }
    }
  }
  static func finishForTermination(grace: Duration = .seconds(5)) async {
    // Do not start another WebView while quitting. Its synchronous construction
    // could consume the entire grace period before the timer gets to run.
    pending.removeAll()
    if !rendering {
      worker?.cancel()
      generations.removeAll()
      return
    }
    let deadline = ContinuousClock.now.advanced(by: grace)
    while worker != nil, ContinuousClock.now < deadline {
      try? await Task.sleep(for: .milliseconds(40))
    }
    if worker != nil {
      worker?.cancel()
      pending.removeAll()
      generations.removeAll()
    }
  }
}

public enum SlopDocumentCommand: Equatable, Sendable {
  case pin(Bool)
  case exportPNG, exportPDF, duplicate, reveal, copyPath
  case openEditor(URL)
  case retry, close
}

@MainActor
public final class SlopDocumentWindowController: NSWindowController, NSWindowDelegate,
  SlopRuntimeSessionDelegate
{
  public let packageURL: URL
  public let session: SlopRuntimeSession
  public var onClose: (() -> Void)?
  public var onPrepareClose: (() async -> Void)?
  public var onCloseCancelled: (() -> Void)?
  public var onOpenDocument: ((URL) -> Void)?
  public var onCommand: ((SlopDocumentCommand) -> Void)?
  public var onRuntimeReady: (() -> Void)?
  public var onRuntimeFailure: ((String) -> Void)?
  private let opened: SlopOpenedDocument
  private var toolbar: NSPanel?, toolbarHost: NSHostingView<SlopToolbar>?,
    hideWork: DispatchWorkItem?
  private var failedOverlay: NSHostingView<FailureOverlay>?
  private var presentedRuntimeError: String?
  private var documentAttention: NSPanel?
  private var attentionIsSaveFailure = false
  private var attentionMessage: String?
  private var commandsEnabled = true

  public convenience init(packageURL: URL) throws {
    try self.init(opened: SlopOpenedDocument(presentedURL: packageURL))
  }

  public static func open(packageURL: URL) async throws -> SlopDocumentWindowController {
    let opened = try await SlopOpenedDocument.open(presentedURL: packageURL)
    do {
      try Task.checkCancellation()
      return try SlopDocumentWindowController(opened: opened)
    } catch {
      try await opened.session.closeAndWait()
      throw error
    }
  }

  private init(opened: SlopOpenedDocument) throws {
    self.opened = opened
    self.packageURL = opened.presentedURL
    session = opened.session
    SlopRenderer.installCLIExport(on: session)
    let windowMask = try SlopWindowMask(package: session.package)
    let spec = session.package.manifest.presentation
    let size = NSSize(width: spec.width, height: spec.height)
    let window = FramelessDocumentWindow(
      contentRect: NSRect(origin: .zero, size: size),
      styleMask: slopDocumentWindowStyleMask(resizable: session.package.isResizable),
      backing: .buffered, defer: false)
    window.title = session.package.manifest.title
    window.minSize = NSSize(width: 240, height: 180)
    window.isOpaque = false
    window.backgroundColor = .clear
    window.hasShadow = !session.package.usesTransparentBackground || session.package.isSkinned
    window.isReleasedWhenClosed = false
    window.tabbingMode = .disallowed
    window.representedURL = opened.presentedURL
    window.miniwindowTitle = session.package.manifest.title
    window.miniwindowImage = NSImage(contentsOf: session.package.iconURL)
    if session.package.shape == .ellipse, spec.width == spec.height {
      window.contentAspectRatio = NSSize(width: 1, height: 1)
    }
    let container = ShapedView(frame: NSRect(origin: .zero, size: size), windowMask: windowMask)
    session.webView.frame = container.bounds
    session.webView.autoresizingMask = [.width, .height]
    container.addSubview(session.webView)
    window.contentView = container
    window.center()
    super.init(window: window)
    window.delegate = self
    session.delegate = self
    container.changed = { [weak self] in $0 ? self?.showToolbar() : self?.scheduleHide() }
    setupToolbar()
    SlopDocumentAssetRefreshQueue.invalidate(self.packageURL)
    SlopPreviewWriter.installExistingPreview(for: session.package)
    session.load()
  }
  required init?(coder: NSCoder) { nil }

  public func runtimeSessionDidBecomeReady(_ session: SlopRuntimeSession) {
    if let onRuntimeReady { onRuntimeReady() } else { updateRuntimeFailure(nil) }
  }
  public func runtimeSession(_ session: SlopRuntimeSession, resizeContentTo requested: CGSize)
    throws -> CGSize
  {
    guard let window else { throw SlopPackageError.invalid("document window is unavailable") }
    let frame = dynamicSlopWindowFrame(
      current: window.frame, requested: requested,
      visible: window.screen?.visibleFrame ?? NSScreen.main?.visibleFrame)
    window.setFrame(frame, display: true, animate: true)
    if toolbar?.isVisible == true { showToolbar() }
    return frame.size
  }
  public func runtimeSession(_ session: SlopRuntimeSession, didFail error: Error) {
    if let onRuntimeFailure {
      onRuntimeFailure(error.localizedDescription)
    } else {
      updateRuntimeFailure(error.localizedDescription)
    }
  }

  public func runtimeSession(_ session: SlopRuntimeSession, didReport issue: SlopRuntimeIssue) {
    guard guestIssue?.message != issue.message else { return }
    issueGeneration += 1
    guestIssue = issue
    showDocumentAttention()
  }
  public func runtimeSession(_ session: SlopRuntimeSession, saveStatus: WasmSaveStatus) {
    window?.isDocumentEdited = saveStatus.status != "saved"
    if let message = saveStatus.error {
      attentionMessage = message
      showDocumentAttention()
    } else if saveStatus.status == "saved" {
      attentionMessage = nil
      if attentionIsSaveFailure, let panel = documentAttention {
        window?.endSheet(panel, returnCode: .abort)
        panel.orderOut(nil)
      }
    }
  }
  private var guestIssue: SlopRuntimeIssue?
  private var issueGeneration = 0
  public func runtimeSessionRecovered(_ session: SlopRuntimeSession) {
    guestIssue = nil
  }
  private func showDocumentAttention() {
    guard let message = attentionMessage ?? guestIssue?.message else { return }
    let saving = attentionMessage != nil
    let alert = NSAlert()
    alert.messageText = saving ? "Changes could not be saved" : "This slop encountered an error"
    alert.informativeText = message
    alert.addButton(withTitle: saving ? "Retry Save" : "Reload Interface")
    if !saving {
      alert.addButton(withTitle: "Dismiss")
      alert.addButton(withTitle: "Copy Details")
    }
    if let window, window.attachedSheet == nil {
      documentAttention = alert.window as? NSPanel
      attentionIsSaveFailure = saving
      alert.beginSheetModal(for: window) { [weak self] result in
        guard let self else { return }
        self.documentAttention = nil
        self.attentionIsSaveFailure = false
        if result == .alertFirstButtonReturn {
          Task {
            do {
              if saving {
                try await self.session.flush()
                self.attentionMessage = nil
                self.showDocumentAttention()
              } else {
                try await self.session.engine.reloadInterface()
              }
            } catch {
              if saving {
                self.attentionMessage = error.localizedDescription
              } else {
                self.guestIssue = SlopRuntimeIssue(
                  source: .unhandled, message: error.localizedDescription)
              }
              self.showDocumentAttention()
            }
          }
        } else if result == .alertThirdButtonReturn {
          NSPasteboard.general.clearContents()
          NSPasteboard.general.setString(message, forType: .string)
          if self.attentionMessage != nil { self.showDocumentAttention() }
        } else if result == .abort || self.attentionMessage != nil {
          self.showDocumentAttention()
        }
      }
    }
  }

  private func setupToolbar() {
    let panel = NSPanel(
      contentRect: NSRect(x: 0, y: 0, width: 388, height: 44),
      styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
    panel.isOpaque = false
    panel.backgroundColor = .clear
    panel.hasShadow = true
    panel.level = .floating
    panel.hidesOnDeactivate = false
    panel.isReleasedWhenClosed = false
    panel.isExcludedFromWindowsMenu = true
    let tracking = HoverView(
      frame: panel.contentView?.bounds ?? NSRect(x: 0, y: 0, width: 388, height: 44))
    panel.contentView = tracking
    let host = NSHostingView(rootView: toolbarView())
    host.frame = tracking.bounds
    host.autoresizingMask = [.width, .height]
    tracking.addSubview(host)
    tracking.changed = { [weak self] in
      if $0 { self?.hideWork?.cancel() } else { self?.scheduleHide() }
    }
    window?.addChildWindow(panel, ordered: .above)
    panel.orderOut(nil)
    toolbar = panel
    toolbarHost = host
  }
  private func toolbarView() -> SlopToolbar {
    SlopToolbar(
      drag: { [weak self] event in self?.dragWindow(with: event) }, pinned: isPinned,
      commandsEnabled: commandsEnabled, close: { [weak self] in self?.request(.close) },
      minimize: { [weak self] in self?.miniaturizeFromToolbar() },
      pin: { [weak self] in self?.request(.pin(!(self?.isPinned ?? false))) },
      duplicate: { [weak self] in self?.request(.duplicate) },
      png: { [weak self] in self?.request(.exportPNG) },
      pdf: { [weak self] in self?.request(.exportPDF) },
      reveal: { [weak self] in self?.request(.reveal) },
      copyPath: { [weak self] in self?.request(.copyPath) }, editors: installedEditors(),
      openEditor: { [weak self] url in self?.request(.openEditor(url)) })
  }
  private func dragWindow(with event: NSEvent) {
    hideWork?.cancel()
    window?.performDrag(with: event)
    showToolbar()
  }
  private func miniaturizeFromToolbar() {
    hideWork?.cancel()
    toolbar?.orderOut(nil)
    window?.miniaturize(nil)
  }
  private func showToolbar() {
    hideWork?.cancel()
    guard let panel = toolbar, let window, !window.isMiniaturized else { return }
    let frame = window.frame
    var x = frame.midX - panel.frame.width / 2
    var y = frame.maxY + 8
    if let visible = window.screen?.visibleFrame {
      x = min(max(x, visible.minX + 8), visible.maxX - panel.frame.width - 8)
      if y + panel.frame.height > visible.maxY { y = frame.maxY - panel.frame.height - 10 }
    }
    panel.setFrameOrigin(NSPoint(x: x, y: y))
    panel.orderFront(nil)
  }
  private func scheduleHide() {
    hideWork?.cancel()
    let work = DispatchWorkItem { [weak self] in
      guard let self else { return }
      let point = NSEvent.mouseLocation
      if self.window?.frame.contains(point) != true, self.toolbar?.frame.contains(point) != true {
        self.toolbar?.orderOut(nil)
      }
    }
    hideWork = work
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.65, execute: work)
  }
  private func togglePin() {
    window?.level = isPinned ? .normal : .floating
    toolbarHost?.rootView = toolbarView()
  }
  public var isPinned: Bool { window?.level == .floating }
  public var documentTitle: String { window?.title ?? session.package.manifest.title }
  public var dockMenuImage: NSImage {
    slopDockMenuImage(iconURL: session.package.iconURL, fallbackURL: packageURL)
  }
  public func owns(_ candidate: NSWindow?) -> Bool { candidate === window || candidate === toolbar }
  public func togglePinFromMenu() { request(.pin(!isPinned)) }
  public func duplicateFromMenu() { request(.duplicate) }
  public func exportPNGFromMenu() { request(.exportPNG) }
  public func exportPDFFromMenu() { request(.exportPDF) }
  public func updatePresentation(pinned: Bool, commandsEnabled: Bool, runtimeError: String?) {
    updateRuntimeFailure(runtimeError)
    guard isPinned != pinned || self.commandsEnabled != commandsEnabled else { return }
    window?.level = pinned ? .floating : .normal
    self.commandsEnabled = commandsEnabled
    toolbarHost?.rootView = toolbarView()
  }
  private func request(_ command: SlopDocumentCommand) {
    if let onCommand {
      onCommand(command)
      return
    }
    Task {
      do { if let url = try await perform(command) { onOpenDocument?(url) } } catch {
        present("Could not complete command", error)
      }
    }
  }
  public func perform(_ command: SlopDocumentCommand) async throws -> URL? {
    switch command {
    case .pin(let pinned):
      window?.level = pinned ? .floating : .normal
      toolbarHost?.rootView = toolbarView()
    case .duplicate:
      let panel = NSSavePanel()
      panel.allowedContentTypes = [.slop]
      panel.nameFieldStringValue =
        packageURL.deletingPathExtension().lastPathComponent + " copy.slop"
      panel.directoryURL = FileManager.default.urls(for: .desktopDirectory, in: .userDomainMask)[0]
      let response = await withCheckedContinuation { continuation in
        if let window {
          panel.beginSheetModal(for: window) { continuation.resume(returning: $0) }
        } else {
          panel.begin { continuation.resume(returning: $0) }
        }
      }
      guard response == .OK, let target = panel.url else { return nil }
      try await session.flush()
      let source = session.package.rootURL
      let destination = try await SlopPreparation.run {
        try SlopDuplicator.duplicate(from: source, to: target)
      }
      return destination

    case .exportPNG: export(.png)
    case .exportPDF: export(.pdf)
    case .reveal: reveal()
    case .copyPath: copyPath()
    case .openEditor(let app): try await openInEditor(app)
    case .retry:
      try await session.reopenSavedDocument()
      if let content = window?.contentView {
        session.webView.frame = content.bounds
        session.webView.autoresizingMask = [.width, .height]
        content.addSubview(session.webView, positioned: .below, relativeTo: failedOverlay)
      }
      updateRuntimeFailure(nil)
    case .close:
      try await prepareToClose()
      do { try await session.finish() } catch {
        onCloseCancelled?()
        throw error
      }
      closePrepared = true
      window?.close()
    }
    return nil
  }
  public func revealFromDock() {
    showWindow(nil)
    window?.deminiaturize(nil)
    window?.makeKeyAndOrderFront(nil)
  }

  private func duplicate() {
    guard let window else { return }
    let panel = NSSavePanel()
    panel.allowedContentTypes = [.slop]
    panel.nameFieldStringValue = packageURL.deletingPathExtension().lastPathComponent + " copy.slop"
    panel.directoryURL = FileManager.default.urls(for: .desktopDirectory, in: .userDomainMask)[0]
    panel.beginSheetModal(for: window) { [weak self] response in
      guard response == .OK, let self, let target = panel.url else { return }
      Task {
        do {
          try await self.session.flush()
          let source = self.session.package.rootURL
          let copy = try await SlopPreparation.run {
            try SlopDuplicator.duplicate(from: source, to: target)
          }
          self.onOpenDocument?(copy)
        } catch { self.present("Could not duplicate", error) }
      }
    }
  }
  private enum ExportKind { case png, pdf }
  private func export(_ kind: ExportKind) {
    let panel = NSSavePanel()
    panel.allowedContentTypes = [kind == .png ? .png : .pdf]
    panel.nameFieldStringValue =
      packageURL.deletingPathExtension().lastPathComponent + (kind == .png ? ".png" : ".pdf")
    guard panel.runModal() == .OK, let url = panel.url else { return }
    Task {
      do {
        try await SlopRenderer.exportDocument(
          session: session, format: kind == .png ? "png" : "pdf", output: url)
      } catch { present("Export failed", error) }
    }
  }
  private func reveal() { NSWorkspace.shared.activateFileViewerSelecting([packageURL]) }
  private func copyPath() {
    NSPasteboard.general.clearContents()
    NSPasteboard.general.setString(packageURL.path, forType: .string)
  }
  private func installedEditors() -> [(String, URL)] {
    slopOpenInCatalog().compactMap { title, bundleID, fallbackPath in
      if let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleID) {
        return (title, url)
      }
      return FileManager.default.fileExists(atPath: fallbackPath)
        ? (title, URL(fileURLWithPath: fallbackPath)) : nil
    }
  }
  private func openInEditor(_ app: URL) async throws {
    let directory = URL(fileURLWithPath: packageURL.path, isDirectory: true)
    _ = try await NSWorkspace.shared.open(
      [directory], withApplicationAt: app, configuration: NSWorkspace.OpenConfiguration())
  }

  private func updateRuntimeFailure(_ message: String?) {
    guard presentedRuntimeError != message else { return }
    presentedRuntimeError = message
    failedOverlay?.removeFromSuperview()
    failedOverlay = nil
    guard let message, let content = window?.contentView else { return }
    if session.engine.rendererDead, let panel = documentAttention {
      window?.endSheet(panel)
      panel.orderOut(nil)
      documentAttention = nil
      attentionMessage = nil
    }
    let overlay = NSHostingView(
      rootView: FailureOverlay(message: message, retry: { [weak self] in self?.request(.retry) }))
    overlay.frame = content.bounds
    overlay.autoresizingMask = [.width, .height]
    content.addSubview(overlay)
    failedOverlay = overlay
  }
  public func windowDidMove(_ notification: Notification) {
    if toolbar?.isVisible == true { showToolbar() }
  }
  private var closePrepared = false
  private var preparingClose = false
  public override func close() {
    guard let window, windowShouldClose(window) else { return }
    super.close()
  }
  public func prepareToClose() async throws {
    if session.engine.rendererDead || !session.isReady { return }
    window?.makeFirstResponder(nil)
    do {
      try await session.engine.prepareClose()
      await onPrepareClose?()
    } catch {
      await cancelPreparedClose()
      throw error
    }
    do {
      let snapshot = try await SlopRenderSnapshot.prepare(packageURL: session.package.rootURL)
      SlopDocumentAssetRefreshQueue.schedule(snapshot: snapshot, presentedURL: packageURL)
    } catch {
      print("[hitSlop assets] Could not snapshot saved document: \(error.localizedDescription)")
    }
  }
  public func cancelPreparedClose() async {
    await session.engine.cancelClose()
    onCloseCancelled?()
  }
  public static func finishAssetRefreshesForTermination() async {
    await SlopDocumentAssetRefreshQueue.finishForTermination()
  }
  public func windowShouldClose(_ sender: NSWindow) -> Bool {
    if closePrepared { return true }
    if let onCommand {
      onCommand(.close)
      return false
    }
    guard !preparingClose else { return false }
    preparingClose = true
    Task {
      defer { preparingClose = false }
      do {
        try await prepareToClose()
        try await session.finish()
        closePrepared = true
        sender.close()
      } catch {
        onCloseCancelled?()
        present("Changes could not be saved", error)
      }
    }
    return false
  }
  public func windowDidResize(_ notification: Notification) {
    if toolbar?.isVisible == true { showToolbar() }
  }
  public func windowWillMiniaturize(_ notification: Notification) {
    hideWork?.cancel()
    toolbar?.orderOut(nil)
  }
  public func windowWillClose(_ notification: Notification) {
    documentAttention?.close()
    documentAttention = nil
    toolbar?.orderOut(nil)
    if let toolbar { window?.removeChildWindow(toolbar) }
    toolbar?.close()
    toolbar = nil
    opened.close()
    onClose?()
  }
  private func present(_ title: String, _ error: Error) {
    let alert = NSAlert(error: error)
    alert.messageText = title
    alert.runModal()
  }
}

private struct FailureOverlay: View {
  let message: String, retry: () -> Void
  var body: some View {
    VStack(spacing: 12) {
      Image(systemName: "exclamationmark.triangle").font(.title)
      Text("This slop stopped responding").font(.headline)
      Text(message).font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.center)
      Button("Reopen saved document", action: retry).buttonStyle(.borderedProminent)
    }.padding(24).frame(maxWidth: .infinity, maxHeight: .infinity).background(.regularMaterial)
  }
}

private struct SlopToolbar: View {
  let drag: (NSEvent) -> Void
  let pinned: Bool, commandsEnabled: Bool, close: () -> Void, minimize: () -> Void, pin: () -> Void,
    duplicate: () -> Void, png: () -> Void, pdf: () -> Void, reveal: () -> Void,
    copyPath: () -> Void
  let editors: [(String, URL)], openEditor: (URL) -> Void
  var body: some View {
    HStack(spacing: 3) {
      ToolbarDragHandle(onDrag: drag).frame(width: 20, height: 25).help("Drag window")
      Divider().frame(height: 16)
      icon("xmark", "Close", close)
      icon("minus", "Minimize", minimize)
      icon(pinned ? "pin.fill" : "pin", pinned ? "Unpin" : "Always on Top", pin).disabled(
        !commandsEnabled)
      Divider().frame(height: 16)
      Group {
        icon("doc.on.doc", "Duplicate", duplicate)
        Menu {
          Button("Export PNG…", action: png)
          Button("Export PDF…", action: pdf)
        } label: {
          Image(systemName: "arrow.down.doc").frame(width: 25, height: 25)
        }.menuStyle(.borderlessButton).fixedSize().help("Export")
        Menu {
          ForEach(editors, id: \.1) { editor in Button(editor.0) { openEditor(editor.1) } }
          if !editors.isEmpty { Divider() }
          Button("Reveal in Finder", action: reveal)
          Button("Copy Path", action: copyPath)
        } label: {
          Image(systemName: "arrow.up.forward.square").frame(width: 25, height: 25)
        }.menuStyle(.borderlessButton).fixedSize().help("Open in")
      }.disabled(!commandsEnabled)
    }.padding(.horizontal, 9).padding(.vertical, 6).background(.ultraThinMaterial, in: Capsule())
      .overlay(Capsule().stroke(.white.opacity(0.25))).padding(2)
  }
  private func icon(_ name: String, _ help: String, _ action: @escaping () -> Void) -> some View {
    Button(action: action) {
      Image(systemName: name).frame(width: 25, height: 25).contentShape(Rectangle())
    }.buttonStyle(.plain).help(help)
  }
}

/// Launch Services first, then these fallback paths, so non-/Applications installs still appear.
func slopOpenInCatalog() -> [(String, String, String)] {
  [
    ("Open in Cursor", "com.todesktop.230313mzl4w4u92", "/Applications/Cursor.app"),
    ("Open in Visual Studio Code", "com.microsoft.VSCode", "/Applications/Visual Studio Code.app"),
    (
      "Open in VS Code Insiders", "com.microsoft.VSCodeInsiders",
      "/Applications/Visual Studio Code - Insiders.app"
    ),
    ("Open in Terminal", "com.apple.Terminal", "/System/Applications/Utilities/Terminal.app"),
    ("Open in iTerm", "com.googlecode.iterm2", "/Applications/iTerm.app"),
    ("Open in Warp", "dev.warp.Warp-Stable", "/Applications/Warp.app"),
    ("Open in Wave", "dev.commandline.waveterm", "/Applications/Wave.app"),
    ("Open in Ghostty", "com.mitchellh.ghostty", "/Applications/Ghostty.app"),
  ]
}

extension UTType {
  public static let slop = UTType(exportedAs: "com.hitslop.slop", conformingTo: .package)
}

import AppKit
import SwiftUI

/// Marks real controls without depending on SwiftUI's private view hierarchy.
struct SlopToolbarControlRegion: NSViewRepresentable {
  final class Marker: NSView {
    override func hitTest(_ point: NSPoint) -> NSView? { nil }
  }
  func makeNSView(context: Context) -> Marker { Marker() }
  func updateNSView(_ view: Marker, context: Context) {}
}

func slopToolbarDragStarted(from start: NSPoint, to point: NSPoint) -> Bool {
  hypot(point.x - start.x, point.y - start.y) >= 4
}

struct SlopToolbarVisibility {
  private(set) var outsideSince: TimeInterval?
  mutating func shouldShow(inside: Bool, interacting: Bool, visible: Bool, now: TimeInterval) -> Bool {
    if inside || interacting {
      outsideSince = nil
      return true
    }
    guard visible else { outsideSince = nil; return false }
    if outsideSince == nil { outsideSince = now }
    return now - (outsideSince ?? now) < 0.8
  }
}

@MainActor final class SlopToolbarPanel: NSPanel {
  var drag: (NSEvent) -> Void = { _ in }
  var interactionChanged: (Bool) -> Void = { _ in }

  private func descendants(of view: NSView) -> [NSView] {
    [view] + view.subviews.flatMap { descendants(of: $0) }
  }

  override func sendEvent(_ event: NSEvent) {
    guard event.type == .leftMouseDown, let contentView else {
      super.sendEvent(event)
      return
    }
    interactionChanged(true)
    defer { interactionChanged(false) }
    let views = descendants(of: contentView)
    let contains: (NSView, NSPoint) -> Bool = { view, point in
      !view.isHiddenOrHasHiddenAncestor && view.bounds.contains(view.convert(point, from: nil))
    }
    if views.contains(where: { $0 is SlopToolbarControlRegion.Marker && contains($0, event.locationInWindow) }) {
      super.sendEvent(event)
      return
    }
    let file = views.compactMap { $0 as? SlopToolbarFileButton }
      .first { contains($0, event.locationInWindow) }
    while let next = nextEvent(matching: [.leftMouseDragged, .leftMouseUp], until: .distantFuture,
                               inMode: .eventTracking, dequeue: true) {
      if next.type == .leftMouseUp {
        if let file, file.isEnabled, contains(file, next.locationInWindow) { file.performClick(nil) }
        return
      }
      if slopToolbarDragStarted(from: event.locationInWindow, to: next.locationInWindow) {
        drag(event)
        return
      }
    }
  }
}

/// A single sampler recovers missed tracking events, including in inactive pinned windows.
@MainActor final class SlopToolbarPointerSampler {
  static let shared = SlopToolbarPointerSampler()
  private struct Entry {
    weak var owner: AnyObject?
    weak var window: NSWindow?
    let update: (NSPoint, Int) -> Void
  }
  private var entries: [ObjectIdentifier: Entry] = [:]
  private var timer: Timer?

  private var observers: [NSObjectProtocol] = []

  private init() {
    for name in [NSWindow.didChangeOcclusionStateNotification, NSWindow.didDeminiaturizeNotification,
                 NSApplication.didBecomeActiveNotification, NSApplication.didUnhideNotification] {
      observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
        MainActor.assumeIsolated { self?.startSampling() }
      })
    }
    observers.append(NSWorkspace.shared.notificationCenter.addObserver(
      forName: NSWorkspace.activeSpaceDidChangeNotification, object: nil, queue: .main) { [weak self] _ in
        MainActor.assumeIsolated { self?.startSampling() }
      })
  }

  func add(_ owner: AnyObject, window: NSWindow?, update: @escaping (NSPoint, Int) -> Void) {
    entries[ObjectIdentifier(owner)] = Entry(owner: owner, window: window, update: update)
    startSampling()
  }

  private func startSampling() {
    guard timer == nil, !entries.isEmpty else { return }
    let timer = Timer(timeInterval: 0.1, repeats: true) { [weak self] _ in
      MainActor.assumeIsolated { self?.sample() }
    }
    self.timer = timer
    RunLoop.main.add(timer, forMode: .common)
  }

  func remove(_ owner: AnyObject) {
    entries.removeValue(forKey: ObjectIdentifier(owner))
    stopIfEmpty()
  }

  private func stopIfEmpty() {
    if entries.isEmpty { timer?.invalidate(); timer = nil }
  }

  private func sample() {
    entries = entries.filter { $0.value.owner != nil }
    stopIfEmpty()
    guard !entries.isEmpty else { return }
    let point = NSEvent.mouseLocation
    let front = NSWindow.windowNumber(at: point, belowWindowWithWindowNumber: 0)
    for entry in entries.values { entry.update(point, front) }
    if !entries.values.contains(where: { entry in
      guard let window = entry.window else { return false }
      return window.isVisible && window.occlusionState.contains(.visible) && !window.isMiniaturized && window.isOnActiveSpace && !NSApp.isHidden
    }) {
      timer?.invalidate()
      timer = nil
    }
  }
}

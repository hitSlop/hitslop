import AppKit
import ComposableArchitecture
import HitSlopFeatures

/// Holds presentation identity until AppKit reports dismissal. Store state remains authoritative.
@MainActor final class NativeAlertPresenter {
    typealias Present = @MainActor (AlertState<ErrorAlertAction>, NSWindow?, @escaping @MainActor (ErrorAlertAction?) -> Void) -> Void
    private struct Request {
        let alert: AlertState<ErrorAlertAction>
        weak var window: NSWindow?
        let isCurrent: @MainActor () -> Bool
        let dismiss: @MainActor () -> Void
        let send: @MainActor (ErrorAlertAction) -> Void
    }
    private var pending: [Request] = []
    private var active: [UUID: Request] = [:]
    private let present: Present

    init(present: @escaping Present = NativeAlertPresenter.presentAlert) { self.present = present }

    func enqueue(_ alert: AlertState<ErrorAlertAction>, window: NSWindow?, isCurrent: @escaping @MainActor () -> Bool, dismiss: @escaping @MainActor () -> Void, send: @escaping @MainActor (ErrorAlertAction) -> Void = { _ in }) {
        guard active[alert.id] == nil, !pending.contains(where: { $0.alert.id == alert.id }) else { return }
        pending.append(Request(alert: alert, window: window, isCurrent: isCurrent, dismiss: dismiss, send: send))
        // Never send an action from inside the observation callback that requested presentation.
        Task { [weak self] in self?.drain() }
    }

    private func drain() {
        pending.removeAll { !$0.isCurrent() }
        var index = 0
        while index < pending.count {
            let request = pending[index]
            guard !active.values.contains(where: { $0.window === request.window }) else { index += 1; continue }
            pending.remove(at: index)
            active[request.alert.id] = request
            present(request.alert, request.window) { [weak self] action in
                guard let self, let completed = self.active.removeValue(forKey: request.alert.id) else { return }
                if completed.isCurrent() {
                    if let action { completed.send(action) }
                    if completed.isCurrent() { completed.dismiss() }
                }
                Task { [weak self] in self?.drain() }
            }
        }
    }

    private static func presentAlert(_ state: AlertState<ErrorAlertAction>, window: NSWindow?, completion: @escaping @MainActor (ErrorAlertAction?) -> Void) {
        let alert = NSAlert()
        alert.messageText = String(state: state.title)
        alert.informativeText = state.message.map { String(state: $0) } ?? ""
        let buttons = Array(state.buttons)
        for button in buttons { alert.addButton(withTitle: String(state: button.label)) }
        let finish: @MainActor (NSApplication.ModalResponse) -> Void = { response in
            let index = response.rawValue - NSApplication.ModalResponse.alertFirstButtonReturn.rawValue
            completion(buttons.indices.contains(index) ? buttons[index].action.action : nil)
        }
        if let window {
            alert.beginSheetModal(for: window, completionHandler: finish)
        } else {
            finish(alert.runModal())
        }
    }
}

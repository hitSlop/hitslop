import AppKit
import ComposableArchitecture
import HitSlopFeatures
import Testing
@testable import HitSlopCatalog

@Test @MainActor func alertsStayPendingUntilDismissedAndOldCompletionCannotClearNewError() async throws {
    let window = NSWindow()
    let store = Store(initialState: DocumentFeature.State(id: UUID(), url: URL(fileURLWithPath: "/tmp/fixture.slop"))) { DocumentFeature() }
    var presented: [UUID] = []
    var callbacks: [UUID: @MainActor () -> Void] = [:]
    let presenter = NativeAlertPresenter { alert, _, completion in
        presented.append(alert.id)
        callbacks[alert.id] = { completion(nil) }
    }
    let observation = observe {
        if let alert = store.alert {
            presenter.enqueue(alert, window: window, isCurrent: { store.alert?.id == alert.id }, dismiss: {
                store.send(.alert(.dismiss))
            })
        }
    }
    defer { withExtendedLifetime(observation) {} }
    store.send(.saveFailed("Offline"))
    let firstID = try #require(store.alert?.id)
    try await waitForCoordinator { presented == [firstID] }
    #expect(store.alert?.id == firstID)
    store.send(.saveFailed("Offline"))
    let secondID = try #require(store.alert?.id)
    #expect(secondID != firstID)
    // Second alert is queued on the same window until AppKit finishes the first.
    await Task.yield()
    #expect(presented == [firstID])
    callbacks[firstID]?()
    try await waitForCoordinator { presented == [firstID, secondID] }
    #expect(store.alert?.id == secondID)
    callbacks[secondID]?()
    #expect(store.alert == nil)
}

@Test @MainActor func obsoleteQueuedAlertsAreDroppedAndOtherWindowsAreIndependent() async throws {
    let firstWindow = NSWindow(), secondWindow = NSWindow()
    let first = AlertState<ErrorAlertAction>.operationFailure("First")
    let obsolete = AlertState<ErrorAlertAction>.operationFailure("Obsolete")
    let other = AlertState<ErrorAlertAction>.operationFailure("Other document")
    let obsoleteIsCurrent = LockIsolated(true)
    var presented: [UUID] = []
    var callbacks: [UUID: @MainActor () -> Void] = [:]
    let presenter = NativeAlertPresenter { alert, _, completion in
        presented.append(alert.id); callbacks[alert.id] = { completion(nil) }
    }
    presenter.enqueue(first, window: firstWindow, isCurrent: { true }, dismiss: {})
    presenter.enqueue(obsolete, window: firstWindow, isCurrent: { obsoleteIsCurrent.value }, dismiss: { Issue.record("Obsolete alert was dismissed") })
    presenter.enqueue(other, window: secondWindow, isCurrent: { true }, dismiss: {})
    try await waitForCoordinator { presented.count == 2 }
    #expect(presented == [first.id, other.id])
    obsoleteIsCurrent.setValue(false)
    callbacks[first.id]?()
    callbacks[other.id]?()
    await Task.yield()
    #expect(!presented.contains(obsolete.id))
}

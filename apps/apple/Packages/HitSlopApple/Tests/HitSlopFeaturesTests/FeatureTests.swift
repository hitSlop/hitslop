import ComposableArchitecture
import Foundation
import Testing
@testable import HitSlopFeatures

private let documentID = UUID(uuidString: "00000000-0000-0000-0000-000000000001")!
private let documentURL = URL(fileURLWithPath: "/tmp/example.slop")
private struct Failure: LocalizedError { var errorDescription: String? { "Save failed" } }



@Test @MainActor func catalogSelectionFollowsSnapshotRemoval() async {
    let entry = CatalogEntry(id: "a", source: .local(documentURL), title: "Counter")
    let store = TestStore(initialState: CatalogFeature.State()) { CatalogFeature() }
    await store.send(.localReceived(CatalogSnapshot(entries: [entry]))) { $0.local = [entry]; $0.selectedID = "a" }
    await store.send(.localReceived(CatalogSnapshot())) { $0.local = []; $0.selectedID = nil }
}

@Test @MainActor func cancelledCreationIsNotAnError() async {
    let entry = CatalogEntry(id: "a", source: .local(documentURL), title: "Counter")
    let calls = LockIsolated(0)
    let gate = AsyncStream<Void>.makeStream()
    let store = TestStore(initialState: CatalogFeature.State()) { CatalogFeature() } withDependencies: {
        $0.catalogClient.recents = { [] }
        $0.catalogClient.create = { _ in
            calls.withValue { $0 += 1 }
            for await _ in gate.stream { break }
            return nil
        }
    }
    await store.send(.primaryAction(entry)) { $0.creating = entry }
    await store.send(.primaryAction(entry))
    gate.continuation.yield(())
    await store.receive(\.creationFinished) { $0.creating = nil; $0.recentsGeneration = 1 }
    await store.receive(\.recentsReceived)
    #expect(calls.value == 1)
    await store.finish()
}

@Test @MainActor func failedCreationCanBeRetried() async {
    let entry = CatalogEntry(id: "a", source: .local(documentURL), title: "Counter")
    let store = TestStore(initialState: CatalogFeature.State()) { CatalogFeature() } withDependencies: {
        $0.catalogClient.create = { _ in throw Failure() }
    }
    await store.send(.primaryAction(entry)) { $0.creating = entry }
    await store.receive(\.creationFailed) { $0.creating = nil; $0.alert = .operationFailure("Save failed", title: "Could not create slop") }
    await store.send(.alert(.dismiss)) { $0.alert = nil }
    await store.send(.primaryAction(entry)) { $0.creating = entry }
    await store.receive(\.creationFailed) { $0.creating = nil; $0.alert = .operationFailure("Save failed", title: "Could not create slop") }
}

@Test @MainActor func repeatedOpenDuringPreparationUsesOneOperation() async {
    let gate = AsyncStream<String>.makeStream()
    let calls = LockIsolated(0)
    let store = TestStore(initialState: AppFeature.State()) { AppFeature() } withDependencies: {
        $0.catalogClient.recents = { [] }
        $0.uuid = .constant(documentID)
        $0.documentClient.open = { _, _ in
            calls.withValue { $0 += 1 }
            for await title in gate.stream { return title }
            throw Failure()
        }
    }
    await store.send(.openDocument(documentURL)) { $0.documents = [DocumentFeature.State(id: documentID, url: documentURL)] }
    await store.send(.openDocument(documentURL))
    gate.continuation.yield("Counter")
    await store.receive(\.openFinished) { $0.documents[id: documentID]?.isOpening = false; $0.documents[id: documentID]?.title = "Counter" }
    await store.receive(\.catalog.refreshRecents) { $0.catalog.recentsGeneration = 1 }
    await store.receive(\.catalog.recentsReceived)
    #expect(calls.value == 1)
    await store.finish()
}

@Test @MainActor func openingAnExistingDocumentFocusesIt() async {
    var initial = AppFeature.State()
    var document = DocumentFeature.State(id: documentID, url: documentURL); document.isOpening = false
    initial.documents = [document]
    let focused = LockIsolated<UUID?>(nil)
    let store = TestStore(initialState: initial) { AppFeature() } withDependencies: {
        $0.documentClient.focus = { id in focused.setValue(id) }
    }
    await store.send(.openDocument(documentURL))
    await store.finish()
    #expect(focused.value == documentID)
}

@Test @MainActor func closeWaitsForExportAndRunsOnlyOnce() async {
    let gate = AsyncStream<Void>.makeStream()
    let operations = LockIsolated<[DocumentCommand]>([])
    var initial = DocumentFeature.State(id: documentID, url: documentURL); initial.isOpening = false
    let store = TestStore(initialState: initial) { DocumentFeature() } withDependencies: {
        $0.documentClient.perform = { _, command in
            operations.withValue { $0.append(command) }
            if command == .exportPNG { for await _ in gate.stream { break } }
            return nil
        }
    }
    await store.send(.command(.exportPNG)) { $0.operation = .exportPNG }
    await store.send(.command(.close)) { $0.closeRequested = true }
    await store.send(.command(.close))
    gate.continuation.yield(())
    await store.receive(\.operationFinished) { $0.operation = .close; $0.closeRequested = false }
    await store.receive(\.operationFinished) { $0.operation = nil }
    #expect(operations.value == [.exportPNG, .close])
}

@Test @MainActor func saveFailureRetainsDocumentForRetry() async {
    var initial = DocumentFeature.State(id: documentID, url: documentURL); initial.isOpening = false
    let store = TestStore(initialState: initial) { DocumentFeature() } withDependencies: {
        $0.documentClient.perform = { _, _ in throw Failure() }
    }
    await store.send(.command(.close)) { $0.operation = .close }
    await store.receive(\.operationFailed) { $0.operation = nil; $0.alert = .operationFailure("Save failed") }
    #expect(store.state.acceptsCommands)
    await store.send(.alert(.dismiss)) { $0.alert = nil }
    await store.send(.command(.close)) { $0.operation = .close }
    await store.receive(\.operationFailed) { $0.operation = nil; $0.alert = .operationFailure("Save failed") }
}

@Test @MainActor func quitFailureRestoresCommandsAndRepliesFalse() async {
    var initial = AppFeature.State()
    var document = DocumentFeature.State(id: documentID, url: documentURL); document.isOpening = false
    initial.documents = [document]
    let reply = LockIsolated<Bool?>(nil)
    let store = TestStore(initialState: initial) { AppFeature() } withDependencies: {
        $0.documentClient.finishQuit = { _ in }
        $0.documentClient.cancelQuit = { _ in }
        $0.documentClient.prepareToQuit = { _ in throw Failure() }
        $0.documentClient.replyToQuit = { reply.setValue($0) }
    }
    await store.send(.quitRequested) {
        $0.quitPhase = .preparing; $0.catalog.isQuitting = true; $0.documents[id: documentID]?.isQuitting = true
    }
    await store.receive(\.quitFailed) {
        $0.quitPhase = .running; $0.catalog.isQuitting = false; $0.documents[id: documentID]?.isQuitting = false; $0.alert = .operationFailure("Save failed")
    }
    await store.finish()
    #expect(reply.value == false)
    #expect(store.state.documents.count == 1)
}

@Test @MainActor func quitWaitsForCreationAndOpeningBeforePreparingTheNewDocument() async {
    let entry = CatalogEntry(id: "a", source: .local(documentURL), title: "Counter")
    let creation = AsyncStream<Void>.makeStream()
    let opening = AsyncStream<Void>.makeStream()
    let preparation = AsyncStream<Void>.makeStream()
    let prepared = LockIsolated<[UUID]>([])
    let replies = LockIsolated<[Bool]>([])
    let store = TestStore(initialState: AppFeature.State()) { AppFeature() } withDependencies: {
        $0.uuid = .constant(documentID)
        $0.catalogClient.create = { _ in
            for await _ in creation.stream { break }
            return documentURL
        }
        $0.catalogClient.recents = { [] }
        $0.documentClient.open = { _, _ in
            for await _ in opening.stream { break }
            return "Counter"
        }
        $0.documentClient.finishQuit = { _ in }
        $0.documentClient.cancelQuit = { _ in }
        $0.documentClient.prepareToQuit = { id in
            prepared.withValue { $0.append(id) }
            for await _ in preparation.stream { break }
        }
        $0.documentClient.finishAssetRefreshes = {}
        $0.documentClient.replyToQuit = { result in replies.withValue { $0.append(result) } }
    }
    await store.send(.catalog(.primaryAction(entry))) { $0.catalog.creating = entry }
    await store.send(.quitRequested) { $0.quitPhase = .waiting; $0.catalog.isQuitting = true }
    await store.send(.openDocument(URL(fileURLWithPath: "/tmp/rejected.slop")))
    creation.continuation.yield(())
    await store.receive(\.catalog.creationFinished) {
        $0.catalog.creating = nil
        $0.catalog.recentsGeneration = 1
        var document = DocumentFeature.State(id: documentID, url: documentURL)
        document.isQuitting = true
        $0.documents = [document]
    }
    await store.receive(\.catalog.recentsReceived)
    #expect(prepared.value.isEmpty)
    #expect(replies.value.isEmpty)
    opening.continuation.yield(())
    await store.receive(\.openFinished) {
        $0.documents[id: documentID]?.isOpening = false
        $0.documents[id: documentID]?.title = "Counter"
        $0.quitPhase = .preparing
    }
    await store.receive(\.catalog.refreshRecents) { $0.catalog.recentsGeneration = 2 }
    await store.receive(\.catalog.recentsReceived)
    #expect(replies.value.isEmpty)
    preparation.continuation.yield(())
    await store.receive(\.quitFinished) { $0.quitPhase = .finished }
    await store.finish()
    #expect(prepared.value == [documentID])
    #expect(replies.value == [true])
}

@Test @MainActor func closingOneDocumentLeavesTheOtherDocumentAndItsStateAlone() async {
    let otherID = UUID(uuidString: "00000000-0000-0000-0000-000000000002")!
    var initial = AppFeature.State()
    var first = DocumentFeature.State(id: documentID, url: documentURL); first.isOpening = false
    var second = DocumentFeature.State(id: otherID, url: URL(fileURLWithPath: "/tmp/other.slop")); second.isOpening = false; second.isPinned = true
    initial.documents = [first, second]; initial.activeDocumentID = otherID
    let calls = LockIsolated<[UUID]>([])
    let store = TestStore(initialState: initial) { AppFeature() } withDependencies: {
        $0.documentClient.perform = { id, _ in calls.withValue { $0.append(id) }; return nil }
    }
    await store.send(.documents(.element(id: documentID, action: .command(.close)))) { $0.documents[id: documentID]?.operation = .close }
    await store.receive(\.documents) { $0.documents.remove(id: documentID) }
    #expect(store.state.documents[id: otherID] == second)
    #expect(store.state.activeDocumentID == otherID)
    #expect(calls.value == [documentID])
}

@Test @MainActor func quitWaitsForAnExportAndPreparesBeforeReplying() async {
    let gate = AsyncStream<Void>.makeStream()
    let events = LockIsolated<[String]>([])
    var initial = AppFeature.State()
    var document = DocumentFeature.State(id: documentID, url: documentURL); document.isOpening = false
    initial.documents = [document]
    let store = TestStore(initialState: initial) { AppFeature() } withDependencies: {
        $0.documentClient.perform = { _, _ in
            for await _ in gate.stream { break }
            events.withValue { $0.append("exported") }; return nil
        }
        $0.documentClient.finishQuit = { _ in }
        $0.documentClient.cancelQuit = { _ in }
        $0.documentClient.prepareToQuit = { _ in events.withValue { $0.append("prepared") } }
        $0.documentClient.finishAssetRefreshes = { events.withValue { $0.append("assets") } }
        $0.documentClient.replyToQuit = { _ in events.withValue { $0.append("reply") } }
    }
    await store.send(.documents(.element(id: documentID, action: .command(.exportPNG)))) { $0.documents[id: documentID]?.operation = .exportPNG }
    await store.send(.quitRequested) { $0.quitPhase = .waiting; $0.catalog.isQuitting = true; $0.documents[id: documentID]?.isQuitting = true }
    await store.send(.quitRequested)
    gate.continuation.yield(())
    await store.receive(\.documents) { $0.documents[id: documentID]?.operation = nil; $0.quitPhase = .preparing }
    await store.receive(\.quitFinished) { $0.quitPhase = .finished }
    await store.finish()
    #expect(events.value == ["exported", "prepared", "assets", "reply"])
}

@Test @MainActor func aFailedPendingCloseCancelsQuitWithOneError() async {
    var initial = AppFeature.State()
    var document = DocumentFeature.State(id: documentID, url: documentURL)
    document.isOpening = false; document.isQuitting = true; document.operation = .close
    initial.documents = [document]; initial.quitPhase = .waiting; initial.catalog.isQuitting = true
    let reply = LockIsolated<Bool?>(nil)
    let store = TestStore(initialState: initial) { AppFeature() } withDependencies: {
        $0.documentClient.replyToQuit = { reply.setValue($0) }
    }
    await store.send(.documents(.element(id: documentID, action: .operationFailed(.close, "Save failed")))) {
        $0.documents[id: documentID]?.operation = nil
        $0.documents[id: documentID]?.isQuitting = false
        $0.catalog.isQuitting = false; $0.quitPhase = .running; $0.alert = .operationFailure("Save failed")
    }
    await store.finish()
    #expect(reply.value == false)
    #expect(store.state.documents[id: documentID]?.alert == nil)
}



@Test @MainActor func olderRecentsCannotUndoClearOrRefresh() async {
    let gate = AsyncStream<Void>.makeStream()
    var state = CatalogFeature.State(); state.recentsGeneration = 4
    let store = TestStore(initialState: state) { CatalogFeature() } withDependencies: {
        $0.catalogClient.recents = { for await _ in gate.stream { break }; return [] }
    }
    await store.send(.refreshRecents) { $0.recentsGeneration = 5 }
    await store.send(.recentsReceived(4, [CatalogEntry(id: "old", source: .recent(documentURL), title: "Old")]))
    gate.continuation.yield(())
    await store.receive(\.recentsReceived)
    await store.finish()
}

@Test @MainActor func refreshingSourcesRetainsTheLocalSubscription() async {
    let local = AsyncStream<CatalogSnapshot>.makeStream()
    let localCalls = LockIsolated(0)
    let refreshCalls = LockIsolated(0)
    let store = TestStore(initialState: CatalogFeature.State()) { CatalogFeature() } withDependencies: {
        $0.catalogClient.local = { localCalls.withValue { $0 += 1 }; return local.stream }
        $0.catalogClient.refreshLocal = { refreshCalls.withValue { $0 += 1 } }
        $0.catalogClient.recents = { [] }
    }
    await store.send(.start) { $0.isStarted = true; $0.recentsGeneration = 1 }
    await store.receive(\.recentsReceived)
    await store.send(.start)
    await store.send(.refreshSources) { $0.recentsGeneration = 2 }
    await store.receive(\.recentsReceived)
    local.continuation.finish()
    await store.finish()
    #expect(localCalls.value == 1)
    #expect(refreshCalls.value == 1)
}

@Test @MainActor func documentAlertsRemainUntilAcknowledgedAndRuntimeRetryKeepsNewFailures() async {
    let gate = AsyncStream<Void>.makeStream()
    var state = DocumentFeature.State(id: documentID, url: documentURL); state.isOpening = false
    let store = TestStore(initialState: state) { DocumentFeature() } withDependencies: {
        $0.documentClient.perform = { _, command in
            #expect(command == .retry)
            for await _ in gate.stream { break }
            return nil
        }
    }
    await store.send(.saveFailed("Offline")) { $0.alert = .operationFailure("Offline") }
    await store.send(.runtimeFailed("Stopped")) { $0.runtimeError = "Stopped" }
    #expect(store.state.alert != nil)
    await store.send(.alert(.dismiss)) { $0.alert = nil }
    await store.send(.command(.retry)) { $0.runtimeError = nil; $0.operation = .retry }
    await store.send(.runtimeFailed("Failed again")) { $0.runtimeError = "Failed again" }
    gate.continuation.yield(())
    await store.receive(\.operationFinished) { $0.operation = nil }
    #expect(store.state.runtimeError == "Failed again")
    await store.send(.runtimeReady) { $0.runtimeError = nil }
    await store.finish()
}

@Test @MainActor func oneDocumentsAlertDoesNotDismissAnotherDocumentsAlert() async {
    let otherID = UUID(uuidString: "00000000-0000-0000-0000-000000000002")!
    var state = AppFeature.State()
    state.documents = [DocumentFeature.State(id: documentID, url: documentURL), DocumentFeature.State(id: otherID, url: documentURL)]
    let store = TestStore(initialState: state) { AppFeature() }
    await store.send(.documents(.element(id: documentID, action: .saveFailed("First")))) { $0.documents[id: documentID]?.alert = .operationFailure("First") }
    await store.send(.documents(.element(id: otherID, action: .saveFailed("Second")))) { $0.documents[id: otherID]?.alert = .operationFailure("Second") }
    await store.send(.documents(.element(id: documentID, action: .alert(.dismiss)))) { $0.documents[id: documentID]?.alert = nil }
    #expect(store.state.documents[id: otherID]?.alert != nil)
}

@Test @MainActor func quitIncludesADuplicateBeforePreparingDocuments() async {
    let duplicateID = UUID(uuidString: "00000000-0000-0000-0000-000000000002")!
    let duplicateURL = URL(fileURLWithPath: "/tmp/duplicate.slop")
    let duplicate = AsyncStream<Void>.makeStream()
    let opening = AsyncStream<Void>.makeStream()
    let preparation = AsyncStream<Void>.makeStream()
    let prepared = LockIsolated<[UUID]>([])
    let replies = LockIsolated<[Bool]>([])
    var state = AppFeature.State()
    var original = DocumentFeature.State(id: documentID, url: documentURL)
    original.isOpening = false
    state.documents = [original]
    let store = TestStore(initialState: state) { AppFeature() } withDependencies: {
        $0.uuid = .constant(duplicateID)
        $0.catalogClient.recents = { [] }
        $0.documentClient.perform = { id, command in
            #expect(id == documentID && command == .duplicate)
            for await _ in duplicate.stream { break }
            return duplicateURL
        }
        $0.documentClient.open = { id, url in
            #expect(id == duplicateID && url == duplicateURL)
            for await _ in opening.stream { break }
            return "Duplicate"
        }
        $0.documentClient.finishQuit = { _ in }
        $0.documentClient.cancelQuit = { _ in }
        $0.documentClient.prepareToQuit = { id in
            prepared.withValue { $0.append(id) }
            if id == documentID { for await _ in preparation.stream { break } }
        }
        $0.documentClient.finishAssetRefreshes = {}
        $0.documentClient.replyToQuit = { allowed in replies.withValue { $0.append(allowed) } }
    }
    await store.send(.documents(.element(id: documentID, action: .command(.duplicate)))) { $0.documents[id: documentID]?.operation = .duplicate }
    await store.send(.quitRequested) { $0.quitPhase = .waiting; $0.catalog.isQuitting = true; $0.documents[id: documentID]?.isQuitting = true }
    duplicate.continuation.yield(())
    await store.receive(\.documents) {
        $0.documents[id: documentID]?.operation = nil
        var new = DocumentFeature.State(id: duplicateID, url: duplicateURL)
        new.isQuitting = true
        $0.documents.append(new)
    }
    #expect(prepared.value.isEmpty)
    opening.continuation.yield(())
    await store.receive(\.openFinished) {
        $0.documents[id: duplicateID]?.title = "Duplicate"
        $0.documents[id: duplicateID]?.isOpening = false
        $0.quitPhase = .preparing
    }
    await store.receive(\.catalog.refreshRecents) { $0.catalog.recentsGeneration = 1 }
    await store.receive(\.catalog.recentsReceived)
    #expect(replies.value.isEmpty)
    preparation.continuation.yield(())
    await store.receive(\.quitFinished) { $0.quitPhase = .finished }
    await store.finish()
    #expect(prepared.value == [documentID, duplicateID])
    #expect(replies.value == [true])
}

@Test @MainActor func repeatedErrorGetsANewPresentationIdentity() async {
    let store = TestStore(initialState: DocumentFeature.State(id: documentID, url: documentURL)) { DocumentFeature() }
    await store.send(.saveFailed("Offline")) { $0.alert = .operationFailure("Offline") }
    let firstID = store.state.alert?.id
    // AlertState equality compares content, not its presentation identity.
    await store.send(.saveFailed("Offline"))
    #expect(store.state.alert?.id != firstID)
    await store.send(.alert(.dismiss)) { $0.alert = nil }
}


@Test @MainActor func multiDocumentQuitFailureCancelsEveryPreparationWithoutFinishing() async {
    let secondID = UUID(uuidString: "00000000-0000-0000-0000-000000000002")!
    var initial = AppFeature.State()
    for id in [documentID, secondID] {
        var document = DocumentFeature.State(id: id, url: documentURL.appendingPathComponent(id.uuidString))
        document.isOpening = false
        initial.documents.append(document)
    }
    let events = LockIsolated<[String]>([])
    let store = TestStore(initialState: initial) { AppFeature() } withDependencies: {
        $0.documentClient.prepareToQuit = { id in
            events.withValue { $0.append("prepare:\(id)") }
            if id == secondID { throw Failure() }
        }
        $0.documentClient.finishQuit = { _ in events.withValue { $0.append("unexpected finish") } }
        $0.documentClient.cancelQuit = { id in events.withValue { $0.append("cancel:\(id)") } }
        $0.documentClient.replyToQuit = { allowed in events.withValue { $0.append("reply:\(allowed)") } }
    }
    await store.send(.quitRequested) {
        $0.quitPhase = .preparing; $0.catalog.isQuitting = true
        for id in [documentID, secondID] { $0.documents[id: id]?.isQuitting = true }
    }
    await store.receive(\.quitFailed) {
        $0.quitPhase = .running; $0.catalog.isQuitting = false
        for id in [documentID, secondID] { $0.documents[id: id]?.isQuitting = false }
        $0.alert = .operationFailure("Save failed")
    }
    await store.finish()
    #expect(events.value == ["prepare:\(documentID)", "prepare:\(secondID)", "cancel:\(documentID)", "cancel:\(secondID)", "reply:false"])
}

@Test @MainActor func categoriesFollowLocalManifestsAndRemovedCategoryReturnsToTemplates() async {
    var bundled = CatalogEntry(id: "bundled", source: .local(documentURL), title: "Bundled")
    bundled.isBundled = true; bundled.categories = ["personal", "productivity"]
    var installed = CatalogEntry(id: "installed", source: .local(documentURL), title: "Installed")
    installed.categories = ["finance", "personal"]
    let store = TestStore(initialState: CatalogFeature.State()) { CatalogFeature() }
    await store.send(.localReceived(CatalogSnapshot(entries: [bundled, installed]))) {
        $0.local = [bundled, installed]; $0.selectedID = "bundled"
    }
    #expect(store.state.categories == ["productivity", "finance", "personal"])
    await store.send(.filterChanged(.category("finance"))) { $0.filter = .category("finance"); $0.selectedID = "installed" }
    #expect(store.state.visibleEntries == [installed])
    await store.send(.localReceived(CatalogSnapshot(entries: [bundled]))) {
        $0.local = [bundled]; $0.filter = .all; $0.selectedID = "bundled"
    }
    #expect(store.state.categories == ["productivity", "personal"])
}

@Test @MainActor func localSearchImmediatelyFiltersAndKeepsCategorySelectionConsistent() async {
    var checklist = CatalogEntry(id: "checklist", source: .local(documentURL), title: "Checklist")
    checklist.categories = ["personal", "productivity"]
    var expenses = CatalogEntry(id: "expenses", source: .local(documentURL), title: "Small Expenses")
    expenses.categories = ["productivity"]
    var initial = CatalogFeature.State()
    initial.local = [checklist, expenses]; initial.selectedID = checklist.id
    let store = TestStore(initialState: initial) { CatalogFeature() }
    await store.send(.queryChanged("  EXPENSES  ")) { $0.query = "  EXPENSES  "; $0.selectedID = expenses.id }
    #expect(store.state.visibleEntries == [expenses])
    await store.send(.filterChanged(.category("personal"))) { $0.filter = .category("personal"); $0.selectedID = nil }
    #expect(store.state.visibleEntries.isEmpty)
    await store.send(.queryChanged("")) { $0.query = ""; $0.selectedID = checklist.id }
    #expect(store.state.visibleEntries == [checklist])
    await store.send(.filterChanged(.all)) { $0.filter = .all }
    #expect(store.state.visibleEntries == [checklist, expenses])
}

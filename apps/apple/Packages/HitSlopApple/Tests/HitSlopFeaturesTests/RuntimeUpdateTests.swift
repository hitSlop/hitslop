import ComposableArchitecture
import Foundation
import HitSlopCore
import Testing
@testable import HitSlopFeatures

@Test @MainActor func incompatibleDocumentOffersTheInstalledAppUpdater() async {
    let id = UUID(), url = URL(fileURLWithPath: "/tmp/future.slop")
    let failure = SlopRuntimeCompatibilityError(required: "1.2.0", available: ["1.0.0"])
    let calls = LockIsolated(0)
    let store = TestStore(initialState: AppFeature.State()) { AppFeature() } withDependencies: {
        $0.uuid = .constant(id)
        $0.documentClient.open = { _, _ in throw failure }
        $0.updateClient.checkForUpdates = { calls.withValue { $0 += 1 } }
    }
    await store.send(.openDocument(url)) { $0.documents.append(DocumentFeature.State(id: id, url: url)) }
    await store.receive(\.openIncompatible) { $0.documents = []; $0.alert = .unsupportedRuntime(failure) }
    await store.send(.alert(.presented(.checkForUpdates))) { $0.alert = nil }
    await store.finish()
    #expect(calls.value == 1)
}

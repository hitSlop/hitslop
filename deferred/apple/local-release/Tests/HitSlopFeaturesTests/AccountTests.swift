import ComposableArchitecture
import Foundation
import Testing
@testable import HitSlopFeatures

private let signedInUser = AccountUser(id: "firebase-user", name: "Jordan", email: "jordan@example.com", photoURL: URL(string: "https://example.com/avatar.jpg"))

@Test @MainActor func accountRestoresAndTracksFirebaseSession() async {
    let stream = AsyncStream<AccountUser?>.makeStream()
    let store = TestStore(initialState: AccountFeature.State()) { AccountFeature() } withDependencies: {
        $0.accountClient.sessions = { stream.stream }
    }
    await store.send(.start) { $0.isStarted = true }
    await store.send(.start)
    stream.continuation.yield(signedInUser)
    await store.receive(\.sessionChanged) { $0.user = signedInUser; $0.isRestoring = false }
    let otherUser = AccountUser(id: "another-user", name: "Other", email: nil)
    stream.continuation.yield(otherUser)
    await store.receive(\.sessionChanged) { $0.user = otherUser }
    stream.continuation.yield(nil)
    await store.receive(\.sessionChanged) { $0.user = nil }
    stream.continuation.finish()
    await store.finish()
}

@Test @MainActor func accountIgnoresRepeatedSignInAndCancellationIsQuiet() async {
    let gate = AsyncStream<Void>.makeStream()
    let calls = LockIsolated(0)
    var initial = AccountFeature.State(); initial.isRestoring = false
    let store = TestStore(initialState: initial) { AccountFeature() } withDependencies: {
        $0.accountClient.signIn = {
            calls.withValue { $0 += 1 }
            for await _ in gate.stream { break }
            throw CancellationError()
        }
    }
    await store.send(.signIn) { $0.isWorking = true }
    await store.send(.signIn)
    gate.continuation.finish()
    await store.receive(\.finished) { $0.isWorking = false }
    #expect(calls.value == 1)
    #expect(store.state.error == nil)
    #expect(store.state.user == nil)
    await store.finish()
}

private struct SignInFailure: LocalizedError { var errorDescription: String? { "Connection failed" } }
@Test @MainActor func accountFailureCanRetryAndOnlyListenerSetsIdentity() async {
    var initial = AccountFeature.State(); initial.isRestoring = false
    let store = TestStore(initialState: initial) { AccountFeature() } withDependencies: {
        $0.accountClient.signIn = { throw SignInFailure() }
    }
    await store.send(.signIn) { $0.isWorking = true }
    await store.receive(\.failed) { $0.isWorking = false; $0.error = "Connection failed" }
    store.dependencies.accountClient.signIn = {}
    await store.send(.signIn) { $0.isWorking = true; $0.error = nil }
    await store.receive(\.finished) { $0.isWorking = false }
    #expect(store.state.user == nil)
    await store.send(.sessionChanged(signedInUser)) { $0.user = signedInUser }
    await store.send(.signIn)
    await store.finish()
}

@Test @MainActor func accountSignOutFailureKeepsSessionAndRetryClearsItThroughListener() async {
    var initial = AccountFeature.State(); initial.isRestoring = false; initial.user = signedInUser
    let store = TestStore(initialState: initial) { AccountFeature() } withDependencies: {
        $0.accountClient.signOut = { throw SignInFailure() }
    }
    await store.send(.signOut) { $0.isWorking = true }
    await store.receive(\.failed) { $0.isWorking = false; $0.error = "Connection failed" }
    #expect(store.state.user == signedInUser)
    store.dependencies.accountClient.signOut = {}
    await store.send(.signOut) { $0.isWorking = true; $0.error = nil }
    await store.receive(\.finished) { $0.isWorking = false }
    await store.send(.sessionChanged(nil)) { $0.user = nil }
    await store.finish()
}

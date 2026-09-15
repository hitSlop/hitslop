import AppKit
import FirebaseAuth
import FirebaseCore
import GoogleSignIn
import HitSlopFeatures
import HitSlopFirebase

/// Credentials stay in the SDK keychain; only display identity enters app state.
@MainActor final class AccountServices {
    private lazy var auth = Auth.auth()

    var client: AccountClient {
        AccountClient(
            sessions: { await self.sessions() },
            signIn: { try await self.signIn() },
            signOut: { try await self.signOut() }
        )
    }

    private func sessions() -> AsyncStream<AccountUser?> {
        if HitSlopFirebase.usesEmulators {
            return AsyncStream { $0.yield(nil); $0.finish() }
        }
        let auth = self.auth
        return AsyncStream { continuation in
            let listener = AccountListener(auth: auth) { user in
                continuation.yield(user.map { AccountUser(id: $0.uid, name: $0.displayName, email: $0.email, photoURL: $0.photoURL) })
            }
            continuation.onTermination = { _ in Task { @MainActor in listener.cancel() } }
        }
    }

    private func signIn() async throws {
        guard !HitSlopFirebase.usesEmulators else {
            throw AccountError("Google sign-in requires a live Firebase connection. Turn off HITSLOP_USE_FIREBASE_EMULATORS to test it.")
        }
        guard let clientID = FirebaseApp.app()?.options.clientID, !clientID.isEmpty else {
            throw AccountError("The app's Firebase configuration is missing its Google client ID.")
        }
        guard let window = NSApp.keyWindow ?? NSApp.mainWindow else {
            throw AccountError("Open Account settings to sign in.")
        }
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
        do {
            let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: window)
            guard let token = result.user.idToken?.tokenString else {
                throw AccountError("Google did not return a sign-in token. Please try again.")
            }
            let credential = GoogleAuthProvider.credential(withIDToken: token, accessToken: result.user.accessToken.tokenString)
            _ = try await auth.signIn(with: credential)
        } catch {
            // Firebase owns the session. Do not retain a separate Google-only login after failure.
            GIDSignIn.sharedInstance.signOut()
            let failure = error as NSError
            if failure.domain == kGIDSignInErrorDomain && failure.code == GIDSignInError.canceled.rawValue {
                throw CancellationError()
            }
            throw error
        }
    }

    private func signOut() throws {
        try auth.signOut()
        GIDSignIn.sharedInstance.signOut()
    }

    func handle(_ url: URL) -> Bool {
        guard !url.isFileURL else { return false }
        return GIDSignIn.sharedInstance.handle(url)
    }
}

private struct AccountError: LocalizedError {
    let message: String
    init(_ message: String) { self.message = message }
    var errorDescription: String? { message }
}

// The SDK listener token is Objective-C and non-Sendable. Keep its lifetime on
// MainActor even when AsyncStream terminates from another executor.
@MainActor private final class AccountListener {
    let auth: Auth
    var handle: AuthStateDidChangeListenerHandle?
    init(auth: Auth, receive: @escaping @Sendable (FirebaseAuth.User?) -> Void) {
        self.auth = auth
        handle = auth.addStateDidChangeListener { _, user in receive(user) }
    }
    func cancel() {
        if let handle { auth.removeStateDidChangeListener(handle) }
        handle = nil
    }
}

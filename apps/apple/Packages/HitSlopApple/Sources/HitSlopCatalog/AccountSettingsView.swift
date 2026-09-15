import ComposableArchitecture
import GoogleSignInSwift
import HitSlopFeatures
import SwiftUI

public struct AccountSettingsView: View {
    let store: StoreOf<AccountFeature>
    public init(store: StoreOf<AccountFeature>) { self.store = store }
    public var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Account").font(.headline)

            if store.isRestoring {
                ProgressView("Restoring account…").controlSize(.small)
            } else if let user = store.user {
                HStack(alignment: .top, spacing: 10) {
                    AccountAvatar(user: user, size: 36)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(user.name ?? "Google account").font(.body.weight(.medium))
                        if let email = user.email {
                            Text(email).font(.caption).foregroundStyle(.secondary)
                                .textSelection(.enabled)
                        }
                    }
                    .fixedSize(horizontal: false, vertical: true)
                }
                Divider()
                Button("Sign out") { store.send(.signOut) }
                    .disabled(store.isWorking)
            } else {
                GoogleSignInButton(style: .wide, state: store.isWorking ? .disabled : .normal) {
                    store.send(.signIn)
                }
            }

            if store.isWorking { ProgressView("Please wait…").controlSize(.small) }
            if let error = store.error {
                Text(error).font(.caption).foregroundStyle(.red)
                    .fixedSize(horizontal: false, vertical: true)
                    .textSelection(.enabled)
            }
        }
        .frame(width: 260, alignment: .leading)
        .padding(20)
    }
}

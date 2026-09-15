import AppKit
import ComposableArchitecture
import HitSlopCore
import HitSlopFeatures
import HitSlopHost
import HitSlopRuntime
import Observation
import SwiftUI

struct SharingInvitation: Equatable {
    let roomId: String
    let token: String
    init?(url: URL) {
        guard url.scheme == "hitslop", url.host == "join", url.query == nil,
              url.user == nil, url.password == nil, url.port == nil,
              let token = url.fragment, token.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil else { return nil }
        let room = String(url.path.dropFirst())
        guard room.range(of: "^[a-zA-Z0-9-]{1,80}$", options: .regularExpression) != nil else { return nil }
        self.roomId = room; self.token = token
    }
}

@MainActor @Observable final class JoinSharingModel {
    let account: StoreOf<AccountFeature>
    let invitation: SharingInvitation
    let templates: URL
    let opened: (URL) -> Void
    var busy = false
    var error: String?
    var finished: (() -> Void)?
    init(account: StoreOf<AccountFeature>, invitation: SharingInvitation, templates: URL, opened: @escaping (URL) -> Void) {
        self.account = account; self.invitation = invitation; self.templates = templates; self.opened = opened
    }
    func join() {
        guard !busy, let uid = account.user?.id else { return }; busy = true; error = nil
        Task {
            defer { busy = false }
            do {
                let room = try await SharingAPI.room(["action": "join", "roomId": invitation.roomId, "invite": invitation.token])
                guard account.user?.id == uid else { throw SlopPackageError.invalid("Your account changed. Join again with the intended account.") }
                // Resolve only trusted, already installed immutable templates. Invites never carry code.
                let candidates = FileManager.default.enumerator(at: templates, includingPropertiesForKeys: [.isDirectoryKey])
                var source: URL?
                while let url = candidates?.nextObject() as? URL {
                    if url.pathExtension == "slop" {
                        candidates?.skipDescendants()
                        if let package = try? SlopPackage(rootURL: url), package.manifest.slug == room.slug,
                           (try? package.validateAsTemplate()) != nil,
                           (try? SlopTemplateFingerprint.value(url)) == room.template { source = url; break }
                    }
                }
                guard let source else { throw SlopPackageError.invalid("Install the matching \(room.slug) template, then open this invitation again. This invitation cannot install executable app code.") }
                let save = NSSavePanel(); save.allowedContentTypes = [.slop]
                save.nameFieldStringValue = room.title.replacingOccurrences(of: "/", with: "-") + ".slop"
                guard await save.begin() == .OK, let destination = save.url else { return }
                guard account.user?.id == uid else { throw SlopPackageError.invalid("Your account changed. Join again.") }
                let temporary = FileManager.default.temporaryDirectory.appendingPathComponent("hitslop-join-\(UUID().uuidString).slop")
                try SlopDuplicator.duplicate(from: source, to: temporary)
                defer { try? FileManager.default.removeItem(at: temporary) }
                let runtime = try SlopRuntimeSession(packageURL: temporary)
                runtime.load(); defer { runtime.close() }
                try await runtime.waitUntilReady()
                let copy = try await runtime.sharedCopy(to: destination, snapshot: room.seed)
                SlopPreviewWriter.installExistingPreview(for: copy)
                opened(copy); finished?()
            } catch { self.error = error.localizedDescription }
        }
    }
}

struct JoinSharingView: View {
    @Bindable var model: JoinSharingModel
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Label("Join a shared document", systemImage: "person.2").font(.title3.bold())
            Text("Save a local copy and edit together. Other members can see your name, email, and document edits.")
            if model.account.user == nil { AccountSettingsView(store: model.account) }
            else { Button("Join and save document…", action: model.join).buttonStyle(.borderedProminent) }
            if model.busy { ProgressView().controlSize(.small) }
            if let error = model.error { Text(error).font(.caption).foregroundStyle(.red).textSelection(.enabled) }
        }.padding(20).frame(width: 340).disabled(model.busy)
    }
}

import AppKit
import ComposableArchitecture
import HitSlopCore
import HitSlopFeatures
import HitSlopHost
import HitSlopRuntime
import SwiftUI
import UniformTypeIdentifiers

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
    let api: SlopCloudAPI
    let opened: (URL) -> Void
    var busy = false
    var error: String?
    var finished: (() -> Void)?
    init(account: StoreOf<AccountFeature>, invitation: SharingInvitation, api: SlopCloudAPI, opened: @escaping (URL) -> Void) {
        self.account = account; self.invitation = invitation; self.api = api; self.opened = opened
    }
    func join() {
        guard !busy, account.user != nil else { return }
        busy = true; error = nil
        Task {
            defer { busy = false }
            do {
                let shared = try await api.joinDocument(id: invitation.roomId, invite: invitation.token)
                let bytes = try await api.documentPackage(shared.documentId)
                let save = NSSavePanel(); save.allowedContentTypes = [.slop]
                save.nameFieldStringValue = shared.title.replacingOccurrences(of: "/", with: "-") + ".slop"
                save.directoryURL = FileManager.default.urls(for: .desktopDirectory, in: .userDomainMask)[0]
                let response: NSApplication.ModalResponse = await withCheckedContinuation { continuation in
                    save.begin { continuation.resume(returning: $0) }
                }
                guard response == .OK, let destination = save.url else { return }
                let archive = FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).slop.zip")
                try bytes.write(to: archive, options: .atomic)
                defer { try? FileManager.default.removeItem(at: archive) }
                guard !FileManager.default.fileExists(atPath: destination.path) else { throw SlopDocumentError("Choose a new destination; an existing document will not be replaced") }
                let staging = destination.deletingLastPathComponent().appendingPathComponent(".join-\(UUID().uuidString).slop")
                defer { try? SlopDuplicator.makeWritable(staging); try? FileManager.default.removeItem(at: staging) }
                try SlopArchive.extractDocument(archive, to: staging, expectedSHA256: shared.packageSha256)
                let token = try await api.session(documentId: shared.documentId)
                let seed = try await api.seed(documentId: shared.documentId, token: token.token)
                let transfer = try seed.validatedTransfer(documentId: shared.documentId, schema: shared.schema)
                let package = try SlopPackage(rootURL: staging)
                guard package.manifest.slug == shared.slug else { throw SlopDocumentError("Shared app identity mismatch") }
                guard let document = try SlopCommandDocument.open(package: package, seed: transfer) else {
                    throw SlopDocumentError("This package does not support collaboration")
                }
                try await document.close()
                try FileManager.default.moveItem(at: staging, to: destination)
                SlopPreviewWriter.installExistingPreview(for: destination)
                opened(destination); finished?()
            } catch { self.error = error.localizedDescription }
        }
    }
}

struct JoinSharingView: View {
    @Bindable var model: JoinSharingModel
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Label("Join a shared document", systemImage: "person.2").font(.title3.bold())
            Text("This link includes an app supplied by the sender. Save a local copy to join its live document. Only open links from people you trust.")
            if model.account.user == nil { AccountSettingsView(store: model.account) }
            else { Button("Join and save document…", action: model.join).buttonStyle(.borderedProminent) }
            if model.busy { ProgressView().controlSize(.small) }
            if let error = model.error { Text(error).font(.caption).foregroundStyle(.red).textSelection(.enabled) }
        }.padding(20).frame(width: 340).disabled(model.busy)
    }
}

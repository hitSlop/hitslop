import AppKit
import ComposableArchitecture
import FirebaseAppCheck
import FirebaseAuth
import FirebaseFirestore
import FirebaseFunctions
import HitSlopCore
import HitSlopFeatures
import HitSlopHost
import HitSlopRuntime
import Observation
import SwiftUI

struct SharedRoom: Decodable, Sendable {
    struct Member: Decodable, Identifiable, Sendable { let id: String; let name: String; let email: String }
    let roomId: String
    let owner: String
    let title: String
    let slug: String
    let template: String
    let members: [Member]
    let invite: String?
    let invitationsEnabled: Bool
    let seed: SlopReplicaTransfer
    var inviteURL: URL? { invite.flatMap { URL(string: "hitslop://join/\(roomId)#\($0)") } }
}

@MainActor enum SharingAPI {
    static func call(_ parameters: [String: Any]) async throws -> Any {
        let bytes = try JSONSerialization.data(withJSONObject: parameters)
        return try JSONSerialization.jsonObject(with: await invoke(bytes))
    }
    private nonisolated static func invoke(_ bytes: Data) async throws -> Data {
        do {
            let cached = try await AppCheck.appCheck().token(forcingRefresh: false)
            NSLog("[hitSlop AppCheck] cached token segments=%ld, emulator=%d", cached.token.split(separator: ".").count, cached.token == "local-emulator" ? 1 : 0)
            let fresh = try await AppCheck.appCheck().token(forcingRefresh: true)
            NSLog("[hitSlop AppCheck] refreshed token segments=%ld", fresh.token.split(separator: ".").count)
        }
        catch {
            throw NSError(domain: "HitSlopSharing", code: 1, userInfo: [NSLocalizedDescriptionKey:
                "This app could not verify itself with Firebase App Check. \(error.localizedDescription)"])
        }
        let payload = try JSONSerialization.jsonObject(with: bytes)
        let result = try await Functions.functions(region: "us-central1").httpsCallable("shareDocument").call(payload)
        return try JSONSerialization.data(withJSONObject: result.data)
    }
    static func room(_ parameters: [String: Any]) async throws -> SharedRoom {
        let data = try await call(parameters)
        return try JSONDecoder().decode(SharedRoom.self, from: JSONSerialization.data(withJSONObject: data))
    }
}

/// One connection per open document. Local durability is independent of network acknowledgements.
@MainActor @Observable final class DocumentSharing {
    let account: StoreOf<AccountFeature>
    private weak var controller: SlopDocumentWindowController?
    var room: SharedRoom?
    var busy = false
    var error: String?
    var status = "Only on this Mac"
    private var panel: NSPanel?
    private var picker: NSSharingServicePicker?
    private var loop: Task<Void, Never>?
    private var inbound: Task<Void, Never>?
    private var listener: ListenerRegistration?
    private var epoch = UUID()
    private var uid: String?
    private var lastSent: String?
    private var seen = Set<String>()
    private var retryAfter = Date.distantPast
    private var applying = 0
    private var documentId: String?
    private var failedImport = false
    private var receivedServer = false
    private var infoRefreshed = Date.distantPast
    var supportsCollaboration: Bool {
        controller.map { FileManager.default.fileExists(atPath: $0.session.package.rootURL.appendingPathComponent("data.schema.json").path) } ?? false
    }

    init(controller: SlopDocumentWindowController, account: StoreOf<AccountFeature>) {
        self.controller = controller; self.account = account
        loop = Task { [weak self] in
            while !Task.isCancelled {
                await self?.tick()
                try? await Task.sleep(for: .seconds(1))
            }
        }
    }
    func stop() {
        loop?.cancel(); loop = nil; resetConnection()
        if let panel { controller?.window?.removeChildWindow(panel); panel.close() }; panel = nil
    }
    private func resetConnection() {
        epoch = UUID(); listener?.remove(); listener = nil; inbound?.cancel(); inbound = nil
        room = nil; seen.removeAll(); lastSent = nil; applying = 0; failedImport = false
        receivedServer = false; infoRefreshed = .distantPast
        status = "Changes saved locally"
    }
    func show() {
        guard let controller else { return }
        if panel == nil {
            let panel = NSPanel(contentRect: NSRect(x: 0, y: 0, width: 360, height: 420), styleMask: [.titled, .closable], backing: .buffered, defer: false)
            panel.isReleasedWhenClosed = false; panel.title = "Share"
            panel.contentViewController = NSHostingController(rootView: DocumentShareView(model: self))
            self.panel = panel
        }
        guard let panel else { return }
        if let window = controller.window {
            window.addChildWindow(panel, ordered: .above)
            panel.setFrameOrigin(NSPoint(x: window.frame.midX - 180, y: window.frame.midY - 210))
        }
        panel.makeKeyAndOrderFront(nil)
    }
    private func tick() async {
        guard let controller, controller.session.isReady, supportsCollaboration else { return }
        let nextUID = account.user?.id
        if nextUID != uid { resetConnection(); uid = nextUID; retryAfter = .distantPast; error = nil }
        guard let uid, !busy, !failedImport, Date() >= retryAfter else { return }
        let generation = epoch
        do {
            if documentId == nil { documentId = try await controller.session.sharingSnapshot().documentId }
            guard let id = documentId else { return }
            if room == nil || (panel?.isVisible == true && Date().timeIntervalSince(infoRefreshed) > 10) {
                let value = try await SharingAPI.room(["action": "info", "roomId": id])
                guard epoch == generation, account.user?.id == uid else { return }
                room = value; infoRefreshed = Date()
                if listener == nil { startListening(value, generation: generation, uid: uid) }
            }
            guard applying == 0, listener != nil, receivedServer else { status = "Syncing…"; return }
            let snapshot = try await controller.session.sharingSnapshot()
            guard epoch == generation, account.user?.id == uid else { return }
            if snapshot.version != lastSent {
                status = "Syncing…"
                _ = try await SharingAPI.call(["action": "append", "roomId": id, "snapshot": snapshot.arguments])
                guard epoch == generation, account.user?.id == uid else { return }
                lastSent = snapshot.version
            }
            status = "Synced"; error = nil
        } catch {
            guard epoch == generation else { return }
            let failure = error as NSError
            if failure.code == FunctionsErrorCode.notFound.rawValue { status = "Only on this Mac"; retryAfter = Date().addingTimeInterval(30) }
            else {
                self.error = error.localizedDescription; status = "Changes saved locally; sharing paused"
                retryAfter = Date().addingTimeInterval(5)
                // Re-authorize on every reconnect. Never replay cache after revoked access.
                listener?.remove(); listener = nil; room = nil
            }
        }
    }
    private func startListening(_ room: SharedRoom, generation: UUID, uid: String) {
        listener?.remove()
        receivedServer = false
        listener = Firestore.firestore().collection("syncRooms").document(room.roomId).collection("updates").addSnapshotListener(includeMetadataChanges: true) { [weak self] snapshot, error in
            let message = error?.localizedDescription
            let updates: [(String, SlopReplicaTransfer)] = snapshot?.documents.compactMap { document in
                guard let bytes = try? JSONSerialization.data(withJSONObject: document.data()), let transfer = try? JSONDecoder().decode(SlopReplicaTransfer.self, from: bytes) else { return nil }
                return (document.documentID, transfer)
            } ?? []
            let cached = snapshot?.metadata.isFromCache ?? true
            Task { @MainActor [weak self] in
                guard let self, self.epoch == generation, self.account.user?.id == uid else { return }
                if let message {
                    self.error = message; self.status = "Changes saved locally; sharing paused"
                    self.listener?.remove(); self.listener = nil; self.room = nil
                    self.retryAfter = Date().addingTimeInterval(5); return
                }
                guard !cached else { return }
                let previous = self.inbound
                self.applying += 1
                self.inbound = Task { [weak self] in
                    await previous?.value
                    guard let self, self.epoch == generation else { return }
                    defer { if self.epoch == generation { self.applying -= 1 } }
                    guard let controller = self.controller else { return }
                    do {
                        for (id, transfer) in updates where !self.seen.contains(id) {
                            guard self.epoch == generation, self.account.user?.id == uid, !Task.isCancelled else { return }
                            try await controller.session.receiveShared(transfer)
                            guard self.epoch == generation, self.account.user?.id == uid else { return }
                            // Only an upload acknowledgement advances lastSent. Typing may
                            // happen while an import awaits local persistence.
                            self.seen.insert(id)
                        }
                        self.receivedServer = true
                    } catch {
                        guard self.epoch == generation else { return }
                        self.failedImport = true; self.error = error.localizedDescription
                        self.status = "An incoming edit needs attention; local changes are saved"
                        self.listener?.remove(); self.listener = nil
                    }
                }
            }
        }
    }
    func create() { run {
        guard let controller = self.controller, let uid = self.account.user?.id else { return }
        let snapshot = try await controller.session.sharingSnapshot()
        let value = try await SharingAPI.room(["action": "create", "roomId": snapshot.documentId, "snapshot": snapshot.arguments,
            "title": controller.packageURL.deletingPathExtension().lastPathComponent, "slug": controller.session.package.manifest.slug,
            "template": try SlopTemplateFingerprint.value(controller.session.package.rootURL)])
        guard self.account.user?.id == uid else { return }
        _ = try await SharingAPI.call(["action": "append", "roomId": snapshot.documentId, "snapshot": snapshot.arguments])
        guard self.account.user?.id == uid else { return }
        self.resetConnection(); self.uid = uid; self.documentId = snapshot.documentId; self.room = value
        self.lastSent = snapshot.version; self.retryAfter = .distantPast
        self.startListening(value, generation: self.epoch, uid: uid)
        self.status = "Syncing…"
    } }
    func copyInvite() {
        guard let url = room?.inviteURL else { return }
        NSPasteboard.general.clearContents(); NSPasteboard.general.setString(url.absoluteString, forType: .string)
    }
    func toggleInvites() { manage(["action": "invite", "enabled": !(room?.invitationsEnabled ?? false)]) }
    func remove(_ id: String) { manage(["action": "remove", "uid": id]) }
    private func manage(_ action: [String: Any]) { run {
        guard let room = self.room, let uid = self.account.user?.id else { return }
        var input = action; input["roomId"] = room.roomId
        let value = try await SharingAPI.room(input)
        if self.account.user?.id == uid { self.room = value }
    } }
    func retry() { resetConnection(); retryAfter = .distantPast; error = nil }
    func sendCopy() { run {
        guard let controller = self.controller else { return }
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("hitslop-share-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let copy = try await controller.session.independentCopy(to: directory.appendingPathComponent(controller.packageURL.lastPathComponent))
        SlopPreviewWriter.installExistingPreview(for: copy)
        // Keep the detached export alive for asynchronous Apple sharing services.
        guard let anchor = self.panel?.contentView ?? controller.window?.contentView else { return }
        let picker = NSSharingServicePicker(items: [copy]); self.picker = picker
        picker.show(relativeTo: anchor.bounds, of: anchor, preferredEdge: .minY)
    } }
    private func run(_ action: @escaping @MainActor () async throws -> Void) {
        guard !busy else { return }; busy = true; error = nil
        Task { defer { busy = false }; do { try await action() } catch { self.error = error.localizedDescription } }
    }
}

private struct DocumentShareView: View {
    @Bindable var model: DocumentSharing
    var body: some View {
        ScrollView {
        VStack(alignment: .leading, spacing: 16) {
            Label("Share this document", systemImage: "person.2").font(.title3.bold())
            Text(model.status).font(.caption).foregroundStyle(.secondary)
            if model.account.user == nil {
                Text("Sign in to invite people and edit together.")
                AccountSettingsView(store: model.account)
            } else if let room = model.room {
                if room.owner == model.account.user?.id {
                    Button("Copy invite link", systemImage: "link", action: model.copyInvite).disabled(room.inviteURL == nil)
                    Button(room.invitationsEnabled ? "Disable invite link" : "Enable invite link", action: model.toggleInvites)
                }
                Text("People with access").font(.headline)
                ForEach(room.members) { member in
                    HStack {
                        VStack(alignment: .leading) {
                            Text(member.name).font(.callout)
                            if !member.email.isEmpty { Text(member.email).font(.caption).foregroundStyle(.secondary) }
                        }
                        Spacer()
                        if member.id == room.owner { Text("Owner").font(.caption).foregroundStyle(.secondary) }
                        else if room.owner == model.account.user?.id { Button("Remove") { model.remove(member.id) } }
                    }
                }
            } else {
                Button("Start collaborating", systemImage: "person.badge.plus", action: model.create).buttonStyle(.borderedProminent).disabled(!model.supportsCollaboration)
                Text("Invited people can edit. They need hitSlop and the same template installed. Document data and its history are uploaded; media and theme changes stay local.")
                    .font(.caption).foregroundStyle(.secondary)
            }
            Divider()
            Button("Send a copy…", systemImage: "square.and.arrow.up", action: model.sendCopy)
            Text("A separate document. Future edits won’t be shared.").font(.caption).foregroundStyle(.secondary)
            if model.busy { ProgressView().controlSize(.small) }
            if let error = model.error {
                Text(error).font(.caption).foregroundStyle(.red).textSelection(.enabled)
                Button("Retry connection", action: model.retry)
            }
        }
        .padding(20).frame(maxWidth: .infinity, alignment: .leading).disabled(model.busy)
        }.frame(width: 360, height: 420)
    }
}

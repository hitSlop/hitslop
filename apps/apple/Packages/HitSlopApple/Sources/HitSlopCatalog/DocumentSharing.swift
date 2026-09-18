import AppKit
import ComposableArchitecture
import HitSlopCore
import HitSlopFeatures
import HitSlopHost
import HitSlopRuntime
import SwiftUI

@MainActor @Observable final class DocumentSharing {
    let account: StoreOf<AccountFeature>
    private weak var controller: SlopDocumentWindowController?
    private let api: SlopCloudAPI
    var room: SlopSharedDocument?
    var peers: [SlopRoomSession.Peer] = []
    var busy = false
    var error: String?
    var status = "Only on this Mac"
    private var panel: NSPanel?
    private var session: SlopRoomSession?
    private var connecting: Task<Void, Never>?
    private var media: Task<Void, Never>?
    private var accountObservation: ObserveToken?
    private var userID: String?
    private var generation = UUID()

    func start() {
        accountObservation = observe { [weak self] in
            guard let self else { return }
            let user = self.account.user?.id
            guard self.userID != user else { return }
            self.userID = user
            self.disconnect()
            self.room = nil
            if user != nil { self.reconnect() }
        }
    }

    private func disconnect() {
        generation = UUID()
        connecting?.cancel(); connecting = nil
        media?.cancel(); media = nil
        session?.stop(); session = nil
        peers = []
        let attempt = generation
        Task { [weak self] in
            guard let self, let document = controller?.session.document else { return }
            let mode = await document.mode
            guard attempt == generation else { return }
            status = mode == .local ? "Only on this Mac" : "Disconnected — read only"
        }
    }

    func reconnect() {
        guard account.user != nil, supportsCollaboration else { return }
        disconnect()
        let attempt = generation
        connecting = Task { [weak self] in
            while !Task.isCancelled {
                guard let self else { return }
                if await self.connectIfShared(attempt: attempt) { return }
                do { try await Task.sleep(for: .seconds(5)) } catch { return }
            }
        }
    }

    var supportsCollaboration: Bool {
        controller?.session.document != nil
    }

    init(controller: SlopDocumentWindowController, account: StoreOf<AccountFeature>, api: SlopCloudAPI) {
        self.controller = controller; self.account = account; self.api = api
    }

    func pauseAndDrain() async {
        let connectionTask = connecting, mediaTask = media, roomSession = session
        generation = UUID()
        connectionTask?.cancel(); mediaTask?.cancel()
        await roomSession?.stopAndWait()
        await connectionTask?.value
        await mediaTask?.value
        disconnect()
    }

    func stop() {
        accountObservation = nil
        disconnect()
        if let panel { controller?.window?.removeChildWindow(panel); panel.close() }; panel = nil
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
        if session == nil, connecting == nil { reconnect() }
    }

    func startSharing() async {
        guard !busy, let controller, let document = controller.session.document else { return }
        guard account.user != nil else { error = "Sign in to share this document."; return }
        disconnect()
        let attempt = generation
        busy = true; error = nil
        defer { busy = false }
        do {
            try await controller.session.flush()
            let seed = try await document.prepareSharing()
            let mediaSchema = try SlopDocumentJSON(data: SlopFile.read(controller.session.package.dataSchemaURL, within: controller.session.package.rootURL))
            let needed = SlopMediaSync.hashes(in: try await document.frame().data, schema: mediaSchema)
            try await SlopMediaSync.uploadMissing(package: controller.session.package, api: api, needed: needed)
            let packed = try await document.sharingBundle(SlopArchive.packSharedApp(controller.session.package.rootURL))
            let shared = try await api.createDocument(
                id: seed["documentId"].string!, title: controller.session.package.manifest.title,
                slug: controller.session.package.manifest.slug, schema: seed["schemaHash"].string!, package: packed, seed: seed
            )
            guard attempt == generation, !Task.isCancelled else { return }
            room = shared
            attach(shared: shared, document: document)
        } catch { self.error = error.localizedDescription }
    }

    func updateInvitation(enabled: Bool) async {
        guard let room, !busy else { return }
        busy = true; defer { busy = false }
        do { self.room = try await api.updateInvitation(documentId: room.documentId, enabled: enabled) }
        catch { self.error = error.localizedDescription }
    }
    func removeMember(_ id: String) async {
        guard let room, !busy else { return }
        busy = true; defer { busy = false }
        do { self.room = try await api.removeMember(documentId: room.documentId, memberId: id) }
        catch { self.error = error.localizedDescription }
    }

    func copyInvite() {
        guard let url = room?.inviteURL else { return }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(url.absoluteString, forType: .string)
        status = "Invite link copied"
    }

    private func attach(shared: SlopSharedDocument, document: SlopCommandDocument) {
        session?.stop(); media?.cancel()
        guard let package = controller?.session.package else { return }
        let api = api
        let transfer = SlopMediaTransfer(package: package, api: api)
        let next = SlopRoomSession(origin: api.origin, documentId: shared.documentId, schema: shared.schema, document: document,
                                   credentials: { try await api.session(documentId: shared.documentId) }, media: transfer.transport)
        next.onPeers = { [weak self] peers in self?.peers = peers }
        next.onError = { [weak self] message in self?.error = message }
        next.onStatus = { [weak self] status in
            switch status {
            case .live: self?.status = "Live on Cloudflare"; self?.error = nil
            case .connecting, .catchingUp: self?.status = "Connecting…"
            case .offline: self?.status = "Offline — reconnect to edit"
            case .paused: self?.status = "Sharing paused — read only"
            case .stopped: break
            }
        }
        session = next; next.start()
        media = Task { [weak self] in
            guard let self, let package = self.controller?.session.package else { return }
            do {
                let schema = try SlopDocumentJSON(data: SlopFile.read(package.dataSchemaURL, within: package.rootURL))
                var previous: Set<String>?
                for await frame in try await document.events() {
                    try Task.checkCancellation()
                    let needed = SlopMediaSync.hashes(in: frame.data, schema: schema)
                    guard needed != previous else { continue }
                    do {
                        for hash in needed { try await transfer.load(hash) }
                        previous = needed
                    } catch {
                        if Task.isCancelled { return }
                        // Keep the subscription alive; a later document event or
                        // explicit reconnect retries the same required content.
                        self.error = error.localizedDescription
                    }
                }
            } catch { if !Task.isCancelled { self.error = error.localizedDescription } }
        }
    }

    /// Persisted mode determines authority even while discovery is unavailable.
    private func connectIfShared(attempt: UUID) async -> Bool {
        guard let document = controller?.session.document else { return true }
        guard await document.mode != .local else { status = "Only on this Mac"; return true }
        let identity = await document.identity()
        do {
            let shared: SlopSharedDocument
            if await document.mode == .promoting, let controller, let seed = await document.sharingSeed() {
                let packed = try await document.sharingBundle(SlopArchive.packSharedApp(controller.session.package.rootURL))
                shared = try await api.createDocument(id: identity.documentId, title: controller.session.package.manifest.title,
                    slug: controller.session.package.manifest.slug, schema: identity.schema, package: packed, seed: seed)
            } else { shared = try await api.document(identity.documentId) }
            guard attempt == generation, !Task.isCancelled else { return true }
            room = shared
            attach(shared: shared, document: document)
            return true
        } catch {
            guard attempt == generation, !Task.isCancelled else { return true }
            if let error = error as? SlopCloudError, [401, 403, 404, 429].contains(error.status) {
                self.error = error.localizedDescription
                status = "Sharing unavailable — read only"
                return true
            }
            self.error = error.localizedDescription
            status = "Waiting to connect — read only"
            return false
        }
    }
}

private struct DocumentShareView: View {
    @Bindable var model: DocumentSharing
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Share").font(.headline)
            if !model.supportsCollaboration {
                Text("This slop does not use a collaborative document yet.").foregroundStyle(.secondary)
            } else if model.account.user == nil {
                Text("Sign in from Account to live-share this document and its media.").foregroundStyle(.secondary)
            } else if let room = model.room {
                Text(room.title).font(.body.weight(.medium))
                Text("\(room.members.count) member\(room.members.count == 1 ? "" : "s") · \(model.peers.count) here now")
                    .font(.caption).foregroundStyle(.secondary)
                ForEach(room.members, id: \.id) { member in
                    HStack {
                        Text(member.name.isEmpty ? member.email : member.name).font(.callout)
                        if room.owner == model.account.user?.id, member.id != room.owner {
                            Button("Remove", role: .destructive) { Task { await model.removeMember(member.id) } }.disabled(model.busy)
                        }
                    }
                }
                HStack {
                    Button("Copy invite link", action: model.copyInvite).disabled(room.invite == nil)
                    Button("Reconnect") { model.reconnect() }
                }
                if room.owner == model.account.user?.id {
                    Button(room.invitationsEnabled ? "Replace invite link" : "Enable invitations") { Task { await model.updateInvitation(enabled: true) } }.disabled(model.busy)
                    if room.invitationsEnabled { Button("Disable invitations") { Task { await model.updateInvitation(enabled: false) } }.disabled(model.busy) }
                }
            } else {
                Text("Upload this app and document to create a live share link. Friends can open it in hitSlop, including apps that aren’t in the catalog.").font(.callout).foregroundStyle(.secondary)
                Button("Share live document") { Task { await model.startSharing() } }
                    .disabled(model.busy)
            }
            if model.busy { ProgressView("Uploading…").controlSize(.small) }
            Text(model.status).font(.caption).foregroundStyle(.secondary)
            if let error = model.error { Text(error).font(.caption).foregroundStyle(.red).textSelection(.enabled) }
        }
        .padding(20)
        .frame(width: 320, alignment: .leading)
    }
}

import HitSlopCore
import HitSlopRegistry
import HitSlopRuntime
import SwiftUI
import WebKit

@main struct hitSlopApp: App {
    var body: some Scene {
        WindowGroup {
            LibraryView()
        }
    }
}

private struct AppEnvironment {
    static var catalogURL: URL { URL(string: Bundle.main.object(forInfoDictionaryKey: "CatalogURL") as? String ?? "https://hitslop.app")! }
    static var deploymentURL: String { Bundle.main.object(forInfoDictionaryKey: "ConvexDeploymentURL") as? String ?? "https://fastidious-malamute-777.convex.cloud" }
}

extension RegistryTemplate {
    func remoteTemplate() throws -> SlopRemoteTemplate {
        guard let artifactKey = currentArtifactKey, let sha = currentArtifactSha256 else {
            throw SlopPackageError.invalid("template has no current artifact")
        }
        return SlopRemoteTemplate(publisherKeyID: publisherKeyId, slug: slug, release: currentReleaseNumber, artifactKey: artifactKey, artifactSha256: sha)
    }
}

struct LibraryView: View {
    @StateObject private var library = SlopCloudLibrary()
    @State private var catalogPresented = false
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        NavigationStack {
            Group {
                if library.documents.isEmpty {
                    ContentUnavailableView(
                        "No slops yet",
                        systemImage: "icloud",
                        description: Text(library.iCloudAvailable
                            ? "Browse the catalog. New slops are created in iCloud Drive so they show up on Mac."
                            : (library.status ?? "Sign in to iCloud to sync with Mac."))
                    )
                } else {
                    List(library.documents, id: \.path) { url in
                        NavigationLink(url.deletingPathExtension().lastPathComponent) {
                            DocumentScreen(url: url)
                        }
                    }
                }
            }
            .navigationTitle("hitSlop")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button("Catalog", systemImage: "plus") { catalogPresented = true }
                }
            }
            .sheet(isPresented: $catalogPresented, onDismiss: { library.refresh() }) {
                NavigationStack { CatalogScreen(onCreated: { catalogPresented = false; library.refresh() }) }
            }
            .onAppear { library.refresh() }
            .onChange(of: scenePhase) { _, phase in if phase == .active { library.refresh() } }
            .refreshable { library.refresh() }
            .safeAreaInset(edge: .bottom) {
                if let status = library.status {
                    Text(status).font(.footnote).foregroundStyle(.secondary).padding()
                } else if library.iCloudAvailable {
                    Text("iCloud Drive / hitSlop").font(.footnote).foregroundStyle(.secondary).padding(.bottom, 8)
                }
            }
        }
    }
}

struct CatalogScreen: View {
    let onCreated: () -> Void
    @StateObject private var model = RegistryModel(deploymentURL: AppEnvironment.deploymentURL, catalogURL: AppEnvironment.catalogURL)
    @State private var creating: String?
    @State private var failure: String?

    var body: some View {
        List(model.templates) { template in
            Button {
                create(template)
            } label: {
                VStack(alignment: .leading, spacing: 4) {
                    Text(template.title).font(.headline).foregroundStyle(.primary)
                    Text(template.description).font(.subheadline).foregroundStyle(.secondary).lineLimit(3)
                }
            }
            .disabled(creating != nil)
        }
        .navigationTitle("Catalog")
        .overlay {
            if let creating {
                ProgressView("Creating \(creating)…")
                    .padding()
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14))
            } else if model.templates.isEmpty, model.errorMessage == nil {
                ProgressView()
            }
        }
        .alert("Could not create slop", isPresented: Binding(get: { failure != nil }, set: { if !$0 { failure = nil } })) {
            Button("OK", role: .cancel) { failure = nil }
        } message: { Text(failure ?? "") }
        .safeAreaInset(edge: .bottom) {
            if let error = model.errorMessage {
                Text(error).font(.footnote).foregroundStyle(.red).padding()
            }
        }
    }

    private func create(_ template: RegistryTemplate) {
        guard creating == nil else { return }
        creating = template.title
        Task { @MainActor in
            do {
                let url = SlopCloud.uniqueDocumentURL(slug: template.slug)
                let downloaded = try await DocumentFactory(catalogURL: model.catalogURL).create(from: template.remoteTemplate(), at: url)
                if downloaded { await model.recordDownload(template: template) }
                await model.recordInstall(template: template)
                creating = nil
                onCreated()
            } catch {
                creating = nil
                failure = error.localizedDescription
            }
        }
    }
}

struct DocumentScreen: View {
    let url: URL
    @Environment(\.scenePhase) private var scenePhase
    @State private var document: SlopOpenedDocument?
    @State private var error: String?

    var body: some View {
        Group {
            if let document {
                SlopWebView(webView: document.session.webView)
                    .ignoresSafeArea(edges: .bottom)
            } else if let error {
                ContentUnavailableView("Could not open slop", systemImage: "exclamationmark.triangle", description: Text(error))
            } else {
                ProgressView("Opening…")
            }
        }
        .navigationTitle(document?.session.package.manifest.title ?? url.deletingPathExtension().lastPathComponent)
        .navigationBarTitleDisplayMode(.inline)
        .task { await open() }
        .onDisappear {
            document?.close()
            document = nil
        }
        .onChange(of: scenePhase) { _, phase in
            if phase != .active { try? document?.flush() }
        }
    }

    private func open() async {
        do {
            document = try await SlopOpenedDocument.open(presentedURL: url)
            document?.session.load()
        } catch {
            self.error = error.localizedDescription
        }
    }
}

private struct SlopWebView: UIViewRepresentable {
    let webView: WKWebView
    func makeUIView(context: Context) -> WKWebView { webView }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

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
    static var catalogURL: URL { URL(string: Bundle.main.object(forInfoDictionaryKey: "CatalogURL") as? String ?? "https://api.hitslop.com")! }
    static var deploymentURL: String { Bundle.main.object(forInfoDictionaryKey: "ConvexDeploymentURL") as? String ?? "https://fastidious-malamute-777.convex.cloud" }
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
        guard SlopCloud.isAvailable else { failure = "Sign in to iCloud Drive before creating a slop."; return }
        creating = template.title
        Task { @MainActor in
            do {
                guard let remote = template.remoteTemplate() else { throw SlopPackageError.invalid("template has no current artifact") }
                let url = SlopCloud.uniqueDocumentURL(slug: template.slug)
                _ = try await DocumentFactory(catalogURL: model.catalogURL).create(from: remote, at: url)
                await model.recordCreation(template: template)
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
    @State private var openError: String?
    @State private var saveError: String?

    var body: some View {
        Group {
            if let document {
                SlopWebView(webView: document.session.webView)
                    .ignoresSafeArea(edges: .bottom)
            } else if let openError {
                ContentUnavailableView("Could not open slop", systemImage: "exclamationmark.triangle", description: Text(openError))
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
            if phase != .active { do { try document?.flush() } catch { saveError = error.localizedDescription } }
        }
        .alert("Could not save to iCloud", isPresented: Binding(get: { saveError != nil }, set: { if !$0 { saveError = nil } })) {
            Button("OK", role: .cancel) { saveError = nil }
        } message: { Text(saveError ?? "") }
    }

    private func open() async {
        do {
            let opened = try await SlopOpenedDocument.open(presentedURL: url)
            opened.onFlushError = { error in saveError = error.localizedDescription }
            document = opened; opened.session.load()
        } catch {
            openError = error.localizedDescription
        }
    }
}

private struct SlopWebView: UIViewRepresentable {
    let webView: WKWebView
    func makeUIView(context: Context) -> WKWebView { webView }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

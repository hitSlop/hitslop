import AppKit
import HitSlopCore
import HitSlopHost
import HitSlopRegistry
import HitSlopRuntime
import SwiftUI

private enum CatalogFilter: Hashable {
    case all, myTemplates, recents, category(String)
}

private struct TemplateCreationFailure: Identifiable {
    let id = UUID()
    let title: String
    let message: String
}

public struct CatalogView: View {
    @StateObject private var model: RegistryModel
    @StateObject private var localStore: LocalTemplateStore
    @State private var query = ""
    @State private var filter: CatalogFilter = .all
    @State private var searchTask: Task<Void, Never>?
    @State private var creatingTemplateTitle: String?
    @State private var creationFailure: TemplateCreationFailure?
    @State private var recentRevision = 0
    @FocusState private var searchFocused: Bool
    @Environment(\.scenePhase) private var scenePhase
    private let openDocumentAction: (URL) -> Void

    public init(deploymentURL: String, catalogURL: URL, templatesURL: URL = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".hitslop/templates", isDirectory: true), openDocument: @escaping (URL) -> Void) {
        _model = StateObject(wrappedValue: RegistryModel(deploymentURL: deploymentURL, catalogURL: catalogURL))
        _localStore = StateObject(wrappedValue: LocalTemplateStore(templatesURL: templatesURL))
        openDocumentAction = openDocument
    }

    private var hostedItems: [CatalogItem] { model.templates.map { CatalogItem(source: .hosted($0)) } }
    private var localItems: [CatalogItem] { localStore.templates.map { CatalogItem(source: .local($0)) } }
    private var recentDocuments: [URL] { Array(NSDocumentController.shared.recentDocumentURLs.filter { $0.pathExtension == "slop" && FileManager.default.fileExists(atPath: $0.path) }.prefix(8)) }
    private let categories = ["productivity", "utilities", "finance", "media", "games", "developer-tools", "education", "business", "personal", "other"]
    private var searchTerm: String { query.trimmingCharacters(in: .whitespacesAndNewlines).localizedLowercase }

    public var body: some View {
        NavigationSplitView {
            CatalogSidebar(filter: filter, categories: categories, localCount: localItems.count, recentCount: recentDocuments.count, select: select)
                .navigationSplitViewColumnWidth(min: 172, ideal: 192, max: 220)
        } detail: {
            ZStack {
                Color(nsColor: .textBackgroundColor).ignoresSafeArea()
                VStack(spacing: 0) {
                    CatalogSearchBar(query: $query, focused: $searchFocused)
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 0) {
                            catalogContent
                        }
                        .padding(.top, 20)
                        .padding(.bottom, 32)
                    }
                }
            }
            .ignoresSafeArea(.container, edges: .top)
            .overlay(alignment: .bottomTrailing) {
                if let creatingTemplateTitle {
                    HStack(spacing: 9) {
                        ProgressView().controlSize(.small)
                        Text("Creating \(creatingTemplateTitle)…").lineLimit(1)
                    }
                    .font(.caption.weight(.medium))
                    .padding(.horizontal, 13)
                    .frame(height: 34)
                    .background(Color(nsColor: .windowBackgroundColor), in: Capsule())
                    .overlay(Capsule().stroke(Color.primary.opacity(0.10)))
                    .shadow(color: .black.opacity(0.10), radius: 10, y: 4)
                    .padding(18)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
        }
        .navigationSplitViewStyle(.balanced)
        .background {
            Button("Focus template search") { searchFocused = true }
                .keyboardShortcut("k", modifiers: .command)
                .frame(width: 1, height: 1).opacity(0)
        }
        .onChange(of: query) { _, value in scheduleSearch(value) }
        .onChange(of: scenePhase) { _, phase in if phase == .active { localStore.refresh(); recentRevision &+= 1 } }
        .onReceive(NotificationCenter.default.publisher(for: .hitSlopPreviewDidChange)) { _ in recentRevision &+= 1 }
        .onOpenURL { url in if url.pathExtension == "slop" { openDocumentAction(url) } }
        .alert(item: $creationFailure) { failure in
            Alert(title: Text("Could not create \(failure.title)"), message: Text(failure.message), dismissButton: .default(Text("OK")))
        }
        .preferredColorScheme(.light)
    }

    @ViewBuilder private var catalogContent: some View {
        VStack(alignment: .leading, spacing: 32) {
            if let error = model.errorMessage {
                StatusStrip(icon: "wifi.exclamationmark", message: "The online catalog is unavailable. Your installed templates still work.")
                    .help(error)
            }
            if !localStore.issues.isEmpty {
                StatusStrip(icon: "exclamationmark.triangle", message: "\(localStore.issues.count) local template \(localStore.issues.count == 1 ? "entry needs" : "entries need") attention.")
                    .help(localStore.issues.joined(separator: "\n"))
            }

            if !searchTerm.isEmpty {
                TemplateSection(title: "Search results", subtitle: "Local and online", items: searchedItems, catalogURL: model.catalogURL, select: chooseTemplate)
            } else {
                switch filter {
                case .all:
                    if !recentDocuments.isEmpty { RecentSection(urls: Array(recentDocuments.prefix(4)), revision: recentRevision, open: openDocument) }
                    if !localItems.isEmpty { TemplateSection(title: "Installed locally", subtitle: "Ready without a download", items: localItems, catalogURL: model.catalogURL, select: chooseTemplate) }
                    TemplateSection(title: "Popular right now", subtitle: "From the hitSlop catalog", items: hostedItems, catalogURL: model.catalogURL, select: chooseTemplate)
                case .myTemplates:
                    TemplateSection(title: "My Templates", subtitle: "Templates installed on this Mac", items: localItems, catalogURL: model.catalogURL, select: chooseTemplate)
                case .recents:
                    if recentDocuments.isEmpty { CatalogEmptyState(icon: "clock", title: "Nothing opened yet", message: "Documents you create or open will appear here.") }
                    else { RecentSection(urls: recentDocuments, revision: recentRevision, open: openDocument) }
                case .category(let category):
                    TemplateSection(title: categoryLabel(category), subtitle: "Local and online templates", items: (localItems + hostedItems).filter { $0.categories.contains(category) }, catalogURL: model.catalogURL, select: chooseTemplate)
                }
            }
        }
        .padding(.horizontal, 28)
    }

    private var searchedItems: [CatalogItem] { (localItems + hostedItems).filter { $0.searchableText.contains(searchTerm) } }
    private func openDocument(_ url: URL) { openDocumentAction(url) }

    private func chooseTemplate(_ item: CatalogItem) {
        guard creatingTemplateTitle == nil else { return }
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.init(filenameExtension: "slop")!]
        panel.canCreateDirectories = true
        panel.directoryURL = SlopCloud.defaultCreationDirectory()
        let slug: String = switch item.source { case .hosted(let template): template.slug; case .local(let template): template.manifest.slug }
        panel.nameFieldStringValue = "\(slug).slop"
        guard panel.runModal() == .OK, let url = panel.url else { return }

        withAnimation(.easeOut(duration: 0.16)) { creatingTemplateTitle = item.title }
        Task { @MainActor in
            do {
                switch item.source {
                case .hosted(let template):
                    guard let remote = template.remoteTemplate() else { throw SlopPackageError.invalid("template has no current artifact") }
                    _ = try await DocumentFactory(catalogURL: model.catalogURL).create(from: remote, at: url)
                    SlopPreviewWriter.installExistingPreview(for: url)
                    await model.recordCreation(template: template)
                case .local(let template):
                    try DocumentFactory(catalogURL: model.catalogURL).create(fromLocalPackage: template.packageURL, at: url)
                    SlopPreviewWriter.installExistingPreview(for: url)
                }
                NSDocumentController.shared.noteNewRecentDocumentURL(url)
                openDocumentAction(url)
            } catch {
                creationFailure = TemplateCreationFailure(title: item.title, message: error.localizedDescription)
            }
            withAnimation(.easeOut(duration: 0.16)) { creatingTemplateTitle = nil }
        }
    }

    private func select(_ next: CatalogFilter) {
        filter = next
        guard searchTerm.isEmpty else { return }
        if case .category(let category) = next { model.list(category: category) }
        else if next == .all { model.list() }
    }

    private func scheduleSearch(_ value: String) {
        searchTask?.cancel()
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        searchTask = Task {
            try? await Task.sleep(for: .milliseconds(180))
            guard !Task.isCancelled else { return }
            if trimmed.isEmpty {
                if case .category(let category) = filter { model.list(category: category) } else { model.list() }
            } else { model.search(trimmed) }
        }
    }

    private func categoryLabel(_ id: String) -> String { id == "developer-tools" ? "Developer Tools" : id.capitalized }
}

private struct CatalogSidebar: View {
    let filter: CatalogFilter
    let categories: [String]
    let localCount: Int
    let recentCount: Int
    let select: (CatalogFilter) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 9) {
                Image(nsImage: NSApplication.shared.applicationIconImage)
                    .resizable()
                    .interpolation(.high)
                    .scaledToFit()
                    .frame(width: 32, height: 32)
                Text("hitSlop").font(.headline.weight(.bold))
            }.padding(.horizontal, 14).padding(.top, 18).padding(.bottom, 14)

            ScrollView {
                VStack(alignment: .leading, spacing: 3) {
                    SidebarButton(title: "All Slops", icon: "square.grid.2x2", count: nil, selected: filter == .all) { select(.all) }
                    SidebarButton(title: "Recents", icon: "clock", count: recentCount, selected: filter == .recents) { select(.recents) }
                    SidebarButton(title: "My Templates", icon: "folder", count: localCount, selected: filter == .myTemplates) { select(.myTemplates) }

                    if !categories.isEmpty {
                        Text("CATEGORIES").font(.caption2.weight(.semibold)).tracking(1.2).foregroundStyle(.secondary)
                            .padding(.horizontal, 12).padding(.top, 22).padding(.bottom, 6)
                        ForEach(categories, id: \.self) { category in
                            SidebarButton(title: category == "developer-tools" ? "Developer Tools" : category.capitalized, icon: categoryIcon(category), count: nil, selected: filter == .category(category)) { select(.category(category)) }
                        }
                    }
                }.padding(.horizontal, 8).padding(.bottom, 18)
            }

            Divider()
            Text("Mini app · local data").font(.caption2).foregroundStyle(.tertiary).padding(14)
        }
        .background(Color(nsColor: .controlBackgroundColor))
    }

    private func categoryIcon(_ category: String) -> String {
        let value = category.localizedLowercase
        return switch value {
        case "productivity": "checkmark.circle"
        case "utilities": "wrench.and.screwdriver"
        case "finance": "wallet.bifold"
        case "media": "play.rectangle"
        case "games": "gamecontroller"
        case "developer-tools": "chevron.left.forwardslash.chevron.right"
        case "education": "graduationcap"
        case "business": "briefcase"
        case "personal": "person"
        default: "ellipsis.circle"
        }
    }
}

private struct SidebarButton: View {
    let title: String
    let icon: String
    let count: Int?
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 9) {
                Image(systemName: icon).frame(width: 18)
                Text(title).lineLimit(1)
                Spacer(minLength: 4)
                if let count, count > 0 { Text("\(count)").font(.caption.monospacedDigit()).foregroundStyle(.secondary) }
            }
            .font(.callout.weight(selected ? .semibold : .regular))
            .padding(.horizontal, 10).frame(height: 34)
            .background(selected ? Color.accentColor.opacity(0.13) : .clear, in: RoundedRectangle(cornerRadius: 8))
            .contentShape(Rectangle())
        }.buttonStyle(.plain)
    }
}

private struct CatalogSearchBar: View {
    @Binding var query: String
    var focused: FocusState<Bool>.Binding

    var body: some View {
        HStack(spacing: 11) {
            Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
            TextField("A timer, an invoice, a strange little tool…", text: $query)
                .textFieldStyle(.plain)
                .font(.body)
                .focused(focused)
            if !query.isEmpty {
                Button { query = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.tertiary) }
                    .buttonStyle(.plain)
                    .help("Clear search")
            } else {
                Text("⌘K").font(.caption2.weight(.medium)).foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 14)
        .frame(height: 42)
        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(focused.wrappedValue ? Color.accentColor.opacity(0.70) : Color.primary.opacity(0.09), lineWidth: focused.wrappedValue ? 2 : 1))
        .padding(.horizontal, 28)
        .padding(.vertical, 11)
        .background(Color(nsColor: .textBackgroundColor))
        .overlay(alignment: .bottom) { Divider() }
    }
}

private struct TemplateSection: View {
    let title: String
    let subtitle: String
    let items: [CatalogItem]
    let catalogURL: URL
    let select: (CatalogItem) -> Void
    private let columns = [GridItem(.adaptive(minimum: 196, maximum: 280), spacing: 18, alignment: .top)]

    var body: some View {
        VStack(alignment: .leading, spacing: 15) {
            HStack(alignment: .firstTextBaseline) {
                Text(title).font(.title2.weight(.bold))
                Text(subtitle).font(.caption).foregroundStyle(.secondary)
                Spacer()
                if !items.isEmpty { Text("\(items.count)").font(.caption.monospacedDigit()).foregroundStyle(.tertiary) }
            }
            if items.isEmpty {
                CatalogEmptyState(icon: "sparkles.rectangle.stack", title: "Nothing here yet", message: emptyMessage)
            } else {
                LazyVGrid(columns: columns, alignment: .leading, spacing: 22) {
                    ForEach(items) { item in
                        TemplateCard(item: item, catalogURL: catalogURL, select: { select(item) })
                    }
                }
            }
        }
    }

    private var emptyMessage: String { title == "My Templates" ? "Run `slop install` from a template project to add it to this Mac." : "Try another search or category." }
}

private struct TemplateCard: View {
    let item: CatalogItem
    let catalogURL: URL
    let select: () -> Void
    @State private var hovering = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ZStack(alignment: .top) {
                Button(action: select) {
                    TemplatePreview(item: item, catalogURL: catalogURL)
                }
                .buttonStyle(.plain)

                HStack(alignment: .top) {
                    Text(item.isLocal ? "LOCAL" : "CATALOG")
                        .font(.caption2.weight(.bold))
                        .tracking(0.8)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 5)
                        .background(.ultraThickMaterial, in: Capsule())
                    Spacer()
                }
                .padding(8)
            }
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) { Text(item.title).font(.headline).lineLimit(1); Spacer(minLength: 4); Image(systemName: "arrow.up.right").font(.caption2.weight(.bold)).foregroundStyle(.tertiary) }
                Text(item.description).font(.caption).foregroundStyle(.secondary).lineLimit(2).frame(minHeight: 30, alignment: .top)
                HStack(spacing: 5) {
                    Text(item.categories.prefix(2).joined(separator: " · ")).lineLimit(1)
                    Spacer()
                    if let creations = item.creations { Label("\(creations)", systemImage: "doc.on.doc").labelStyle(.titleAndIcon) }
                }.font(.caption2).foregroundStyle(.tertiary)
            }
        }
        .scaleEffect(hovering ? 1.012 : 1)
        .animation(.easeOut(duration: 0.16), value: hovering)
        .onHover { hovering = $0 }
    }
}

private struct TemplatePreview: View {
    let item: CatalogItem
    let catalogURL: URL

    var body: some View {
        ZStack {
            Color(nsColor: .controlBackgroundColor)
            switch item.source {
            case .local(let template):
                if let image = NSImage(contentsOf: template.previewURL) { Image(nsImage: image).resizable().scaledToFit() } else { placeholder }
            case .hosted(let template):
                if let url = screenshotURL(template) {
                    AsyncImage(url: url) { phase in
                        if let image = phase.image { image.resizable().scaledToFit() }
                        else if phase.error != nil { placeholder }
                        else { ProgressView().controlSize(.small) }
                    }
                } else { placeholder }
            }
        }
        .aspectRatio(4 / 3, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.primary.opacity(0.09)))
        .shadow(color: Color.black.opacity(0.08), radius: 12, y: 6)
    }

    private var placeholder: some View {
        VStack(spacing: 8) { Image(systemName: "sparkles").font(.title2); Text(item.title).font(.headline).lineLimit(1) }.foregroundStyle(.secondary)
    }

    private func screenshotURL(_ template: RegistryTemplate) -> URL? {
        guard let key = template.currentPreviewKey else { return nil }
        var components = URLComponents(url: catalogURL.appendingPathComponent("api/artifact"), resolvingAgainstBaseURL: false)
        components?.queryItems = [URLQueryItem(name: "key", value: key)]
        return components?.url
    }
}

private struct RecentSection: View {
    let urls: [URL]
    let revision: Int
    let open: (URL) -> Void
    private let columns = [GridItem(.adaptive(minimum: 150, maximum: 210), spacing: 16, alignment: .top)]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) { Text("Recently opened").font(.title2.weight(.bold)); Text("Continue where you left off").font(.caption).foregroundStyle(.secondary) }
            LazyVGrid(columns: columns, alignment: .leading, spacing: 14) {
                ForEach(urls, id: \.self) { url in
                    Button { open(url) } label: {
                        VStack(alignment: .leading, spacing: 8) {
                            RecentDocumentPreview(url: url, revision: revision)
                            VStack(alignment: .leading, spacing: 2) {
                                Text((try? SlopPackage(rootURL: url).manifest.title) ?? url.deletingPathExtension().lastPathComponent)
                                    .font(.callout.weight(.semibold)).lineLimit(1)
                                Text(url.deletingLastPathComponent().lastPathComponent)
                                    .font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                            }
                        }
                    }.buttonStyle(.plain)
                }
            }
        }
    }
}

private struct RecentDocumentPreview: View {
    let url: URL
    let revision: Int

    var body: some View {
        ZStack {
            Color(nsColor: .controlBackgroundColor)
            if let image = previewImage {
                Image(nsImage: image).resizable().interpolation(.high).scaledToFit()
            } else {
                VStack(spacing: 7) {
                    Image(nsImage: NSApplication.shared.applicationIconImage).resizable().scaledToFit().frame(width: 34, height: 34)
                    Text(url.deletingPathExtension().lastPathComponent).font(.caption.weight(.semibold)).lineLimit(1)
                }.foregroundStyle(.secondary).padding(12)
            }
        }
        .aspectRatio(4 / 3, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.primary.opacity(0.09)))
        .id(revision)
    }

    private var previewImage: NSImage? {
        let quickLook = url.appendingPathComponent("QuickLook", isDirectory: true)
        return NSImage(contentsOf: quickLook.appendingPathComponent("Preview.png"))
    }
}

private struct CatalogEmptyState: View {
    let icon: String
    let title: String
    let message: String
    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: icon).font(.title2).foregroundStyle(Color.accentColor)
            VStack(alignment: .leading, spacing: 3) { Text(title).font(.headline); Text(message).font(.callout).foregroundStyle(.secondary) }
        }.padding(.vertical, 18)
    }
}

private struct StatusStrip: View {
    let icon: String
    let message: String
    var body: some View {
        Label(message, systemImage: icon).font(.caption).foregroundStyle(.secondary)
            .padding(.horizontal, 12).padding(.vertical, 9).background(Color.orange.opacity(0.10), in: RoundedRectangle(cornerRadius: 9))
    }
}

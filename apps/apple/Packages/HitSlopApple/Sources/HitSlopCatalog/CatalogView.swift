import AppKit
import HitSlopCore
import HitSlopHost
import HitSlopRegistry
import HitSlopRuntime
import SwiftUI

private enum CatalogFilter: Hashable {
    case all, myTemplates, recents, category(String)

    var title: String {
        switch self {
        case .all: "All Slops"
        case .myTemplates: "Mine"
        case .recents: "Recents"
        case .category(let category): categoryLabel(category)
        }
    }
}

private struct TemplateCreationFailure: Identifiable {
    let id = UUID()
    let title: String
    let message: String
}

private struct RecentCatalogItem: Identifiable {
    let url: URL
    let package: SlopPackage?
    let packageBytes: Int64
    let createdAt: Date?
    let updatedAt: Date?

    var id: String { "recent:\(url.standardizedFileURL.path)" }
    var title: String { package?.manifest.title ?? url.deletingPathExtension().lastPathComponent }
    var description: String { package?.manifest.description ?? "A local hitSlop document." }
    var categories: [String] { package?.manifest.categories.map(\.rawValue) ?? [] }
    var searchableText: String { ([title, description] + categories).joined(separator: " ").localizedLowercase }
    var previewURL: URL? { package?.previewURL }
    var iconURL: URL? { package?.iconURL }

    init(url: URL) {
        self.url = url
        package = try? SlopPackage(rootURL: url)
        packageBytes = slopPackageByteCount(url)
        let values = try? url.resourceValues(forKeys: [.creationDateKey, .contentModificationDateKey])
        createdAt = values?.creationDate
        updatedAt = values?.contentModificationDate
    }
}

private enum CatalogEntry: Identifiable {
    case template(CatalogItem)
    case recent(RecentCatalogItem)

    var id: String { switch self { case .template(let item): item.id; case .recent(let item): item.id } }
    var title: String { switch self { case .template(let item): item.title; case .recent(let item): item.title } }
    var description: String { switch self { case .template(let item): item.description; case .recent(let item): item.description } }
    var categories: [String] { switch self { case .template(let item): item.categories; case .recent(let item): item.categories } }
    var searchableText: String { switch self { case .template(let item): item.searchableText; case .recent(let item): item.searchableText } }
}

public struct CatalogView: View {
    @StateObject private var model: RegistryModel
    @StateObject private var localStore: LocalTemplateStore
    @State private var query = ""
    @State private var filter: CatalogFilter = .all
    @State private var catalogSort: RegistrySort = .popular
    @State private var selectedID: String?
    @State private var searchTask: Task<Void, Never>?
    @State private var creatingTemplateTitle: String?
    @State private var creationFailure: TemplateCreationFailure?
    @State private var recentRevision = 0
    @FocusState private var searchFocused: Bool
    @Environment(\.scenePhase) private var scenePhase
    private let openDocumentAction: (URL) -> Void

    public init(catalogURL: URL, templatesURL: URL = DocumentFactory.defaultTemplatesRoot, openDocument: @escaping (URL) -> Void) {
        _model = StateObject(wrappedValue: RegistryModel(catalogURL: catalogURL))
        _localStore = StateObject(wrappedValue: LocalTemplateStore(templatesURL: templatesURL))
        openDocumentAction = openDocument
    }

    private let categories = ["productivity", "utilities", "finance", "media", "games", "developer-tools", "education", "business", "personal", "other"]
    private var searchTerm: String { query.trimmingCharacters(in: .whitespacesAndNewlines).localizedLowercase }
    private var hostedItems: [CatalogItem] { model.templates.map { CatalogItem(source: .hosted($0)) } }
    private var localItems: [CatalogItem] { localStore.templates.map { CatalogItem(source: .local($0)) } }
    private var recentItems: [RecentCatalogItem] {
        _ = recentRevision
        return NSDocumentController.shared.recentDocumentURLs.filter {
            $0.pathExtension.lowercased() == "slop"
                && FileManager.default.fileExists(atPath: $0.path)
                && !DocumentFactory.isManagedTemplatePackage($0, templatesRoot: localStore.templatesURL)
        }.map(RecentCatalogItem.init)
    }
    private var visibleEntries: [CatalogEntry] {
        let entries: [CatalogEntry] = switch filter {
        case .all, .category: hostedItems.map(CatalogEntry.template)
        case .myTemplates: localItems.map(CatalogEntry.template)
        case .recents: recentItems.map(CatalogEntry.recent)
        }
        guard !searchTerm.isEmpty, filter == .myTemplates || filter == .recents else { return entries }
        return entries.filter { $0.searchableText.contains(searchTerm) }
    }
    private var selectedEntry: CatalogEntry? { visibleEntries.first { $0.id == selectedID } }
    private var visibleIDs: [String] { visibleEntries.map(\.id) }
    private var showsCatalogSort: Bool {
        switch filter { case .all, .category: true; case .myTemplates, .recents: false }
    }

    public var body: some View {
        NavigationSplitView {
            CatalogSidebar(
                filter: filter,
                categories: categories,
                localCount: localItems.count,
                recentCount: recentItems.count,
                select: select
            )
            .navigationSplitViewColumnWidth(min: 168, ideal: 184, max: 204)
        } content: {
            CatalogRail(
                title: filter.title,
                entries: visibleEntries,
                selectedID: $selectedID,
                query: $query,
                searchFocused: $searchFocused,
                catalogURL: model.catalogURL,
                errorMessage: showsCatalogSort ? model.errorMessage : nil,
                localIssues: filter == .myTemplates ? localStore.issues : [],
                sort: $catalogSort,
                showsSort: showsCatalogSort
            )
            .navigationSplitViewColumnWidth(min: 236, ideal: 264, max: 304)
            .ignoresSafeArea(.container, edges: .top)
        } detail: {
            CatalogDetail(
                entry: selectedEntry,
                catalogURL: model.catalogURL,
                isCreating: creatingTemplateTitle != nil,
                primaryAction: performPrimaryAction
            )
            .frame(minWidth: 460)
            .ignoresSafeArea(.container, edges: .top)
        }
        .navigationSplitViewStyle(.balanced)
        .background {
            Button("Focus template search") { searchFocused = true }
                .keyboardShortcut("k", modifiers: .command)
                .frame(width: 1, height: 1)
                .opacity(0)
        }
        .onAppear { synchronizeSelection() }
        .onChange(of: visibleIDs) { _, _ in synchronizeSelection() }
        .onChange(of: query) { _, value in scheduleSearch(value) }
        .onChange(of: catalogSort) { _, value in
            switch filter {
            case .all: model.list(sort: value)
            case .category(let category): model.list(category: category, sort: value)
            case .myTemplates, .recents: break
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                localStore.refresh()
                recentRevision &+= 1
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .hitSlopPreviewDidChange)) { _ in recentRevision &+= 1 }
        .onOpenURL { url in if url.pathExtension == "slop" { openDocumentAction(url) } }
        .alert(item: $creationFailure) { failure in
            Alert(title: Text("Could not create \(failure.title)"), message: Text(failure.message), dismissButton: .default(Text("OK")))
        }
        .preferredColorScheme(.light)
    }

    private func synchronizeSelection() {
        if let selectedID, visibleIDs.contains(selectedID) { return }
        selectedID = visibleIDs.first
    }

    private func select(_ next: CatalogFilter) {
        filter = next
        selectedID = nil
        guard searchTerm.isEmpty else {
            scheduleSearch(query)
            return
        }
        switch next {
        case .all: model.list(sort: catalogSort)
        case .category(let category): model.list(category: category, sort: catalogSort)
        case .myTemplates, .recents: break
        }
    }

    private func scheduleSearch(_ value: String) {
        searchTask?.cancel()
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        searchTask = Task {
            try? await Task.sleep(for: .milliseconds(180))
            guard !Task.isCancelled else { return }
            switch filter {
            case .all:
                trimmed.isEmpty ? model.list(sort: catalogSort) : model.search(trimmed)
            case .category(let category):
                trimmed.isEmpty ? model.list(category: category, sort: catalogSort) : model.search(trimmed, category: category)
            case .myTemplates, .recents:
                synchronizeSelection()
            }
        }
    }

    private func performPrimaryAction(_ entry: CatalogEntry) {
        switch entry {
        case .recent(let item): openDocumentAction(item.url)
        case .template(let item): createDocument(from: item)
        }
    }

    private func createDocument(from item: CatalogItem) {
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
                    _ = try await DocumentFactory(catalogURL: model.catalogURL).create(from: template.remoteTemplate(), at: url)
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
                    .resizable().interpolation(.high).scaledToFit().frame(width: 32, height: 32)
                Text("hitSlop").font(.headline.weight(.bold))
            }
            .padding(.horizontal, 14).padding(.top, 18).padding(.bottom, 14)

            ScrollView {
                VStack(alignment: .leading, spacing: 3) {
                    SidebarButton(title: "All Slops", icon: "square.grid.2x2", selected: filter == .all) { select(.all) }
                    SidebarButton(title: "Recents", icon: "clock", count: recentCount, selected: filter == .recents) { select(.recents) }
                    SidebarButton(title: "Mine", icon: "folder", count: localCount, selected: filter == .myTemplates) { select(.myTemplates) }

                    Text("CATEGORIES")
                        .font(.caption2.weight(.semibold)).tracking(1.2).foregroundStyle(.secondary)
                        .padding(.horizontal, 12).padding(.top, 22).padding(.bottom, 6)
                    ForEach(categories, id: \.self) { category in
                        SidebarButton(title: categoryLabel(category), icon: categoryIcon(category), selected: filter == .category(category)) {
                            select(.category(category))
                        }
                    }
                }
                .padding(.horizontal, 8).padding(.bottom, 18)
            }

            VStack(alignment: .leading, spacing: 10) {
                if let docs = CatalogLinks.authoringDocs {
                    Link(destination: docs) {
                        Label("Make your own slop", systemImage: "sparkles")
                            .font(.callout.weight(.semibold))
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 12).frame(height: 38)
                            .foregroundStyle(.white)
                            .background(Color.accentColor, in: RoundedRectangle(cornerRadius: 9))
                    }.buttonStyle(.plain)
                }
                HStack(spacing: 9) {
                    BrandLink(name: "github", label: "GitHub", destination: CatalogLinks.github)
                    if let discord = CatalogLinks.discord {
                        BrandLink(name: "discord", label: "Discord", destination: discord)
                    }
                }
                Text("Mini apps · local data · fun").font(.caption2).foregroundStyle(.tertiary)
            }
            .padding(14)
            .overlay(alignment: .top) { Divider() }
        }
        .background(Color(nsColor: .controlBackgroundColor))
    }
}

private struct BrandLink: View {
    let name: String
    let label: String
    let destination: URL

    var body: some View {
        Link(destination: destination) {
            Group {
                if let image = brandImage(named: name) {
                    Image(nsImage: image).resizable().scaledToFit()
                } else {
                    Image(systemName: "link")
                }
            }
            .frame(width: 15, height: 15)
            .frame(width: 30, height: 30)
            .foregroundStyle(.secondary)
            .background(Color.primary.opacity(0.055), in: Circle())
            .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .help(label)
        .accessibilityLabel(label)
    }
}

private struct SidebarButton: View {
    let title: String
    let icon: String
    var count: Int?
    let selected: Bool
    let action: () -> Void

    init(title: String, icon: String, count: Int? = nil, selected: Bool, action: @escaping () -> Void) {
        self.title = title; self.icon = icon; self.count = count; self.selected = selected; self.action = action
    }

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

private struct CatalogRail: View {
    let title: String
    let entries: [CatalogEntry]
    @Binding var selectedID: String?
    @Binding var query: String
    var searchFocused: FocusState<Bool>.Binding
    let catalogURL: URL
    let errorMessage: String?
    let localIssues: [String]
    @Binding var sort: RegistrySort
    let showsSort: Bool

    var body: some View {
        VStack(spacing: 0) {
            CatalogSearchBar(query: $query, focused: searchFocused)
            VStack(alignment: .leading, spacing: showsSort ? 9 : 0) {
                HStack(alignment: .firstTextBaseline) {
                    Text(title).font(.headline.weight(.semibold))
                    Spacer()
                    Text("\(entries.count)").font(.caption.monospacedDigit()).foregroundStyle(.tertiary)
                }
                if showsSort {
                    Picker("Catalog order", selection: $sort) {
                        ForEach(RegistrySort.allCases) { option in Text(option.title).tag(option) }
                    }
                    .pickerStyle(.segmented)
                    .labelsHidden()
                    .accessibilityLabel("Catalog order")
                }
            }
            .padding(.horizontal, 14).padding(.vertical, 10)

            if errorMessage != nil {
                Label("Online catalog unavailable", systemImage: "wifi.exclamationmark")
                    .font(.caption).foregroundStyle(.secondary).padding(.horizontal, 14).padding(.bottom, 8)
                    .help(errorMessage ?? "")
            }
            if !localIssues.isEmpty {
                Label("\(localIssues.count) local template \(localIssues.count == 1 ? "needs" : "need") attention", systemImage: "exclamationmark.triangle")
                    .font(.caption).foregroundStyle(.secondary).padding(.horizontal, 14).padding(.bottom, 8)
                    .help(localIssues.joined(separator: "\n"))
            }

            if entries.isEmpty {
                ContentUnavailableView("Nothing here", systemImage: "sparkles.rectangle.stack", description: Text("Try another search or category."))
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(entries, selection: $selectedID) { entry in
                    CatalogRow(entry: entry, catalogURL: catalogURL)
                        .tag(entry.id)
                }
                .listStyle(.sidebar)
            }
        }
        .background(Color(nsColor: .textBackgroundColor))
    }
}

private struct CatalogSearchBar: View {
    @Binding var query: String
    var focused: FocusState<Bool>.Binding

    var body: some View {
        HStack(spacing: 9) {
            Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
            TextField("Search slops…", text: $query)
                .textFieldStyle(.plain).focused(focused)
            if query.isEmpty {
                Text("⌘K").font(.caption2.weight(.medium)).foregroundStyle(.tertiary)
            } else {
                Button { query = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.tertiary) }
                    .buttonStyle(.plain).help("Clear search")
            }
        }
        .padding(.horizontal, 11).frame(height: 36)
        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 9))
        .overlay(RoundedRectangle(cornerRadius: 9).stroke(focused.wrappedValue ? Color.accentColor.opacity(0.7) : Color.primary.opacity(0.08), lineWidth: focused.wrappedValue ? 2 : 1))
        .padding(12)
        .overlay(alignment: .bottom) { Divider() }
    }
}

private struct CatalogRow: View {
    let entry: CatalogEntry
    let catalogURL: URL

    var body: some View {
        HStack(spacing: 11) {
            CatalogImageView(urls: iconURLs, fallback: .applicationIcon)
                .frame(width: 52, height: 52)
                .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 10))
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.primary.opacity(0.08)))
            VStack(alignment: .leading, spacing: 4) {
                Text(entry.title).font(.callout.weight(.semibold)).lineLimit(1)
                Text(entry.categories.prefix(2).map(categoryLabel).joined(separator: " · "))
                    .font(.caption).foregroundStyle(.secondary).lineLimit(1)
                Text(sourceLabel).font(.caption2.weight(.medium)).foregroundStyle(.tertiary).lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 5)
        .contentShape(Rectangle())
    }

    private var sourceLabel: String {
        switch entry {
        case .recent: "LOCAL DOCUMENT"
        case .template(let item): item.isLocal ? "READY LOCALLY" : "CATALOG"
        }
    }

    private var iconURLs: [URL] {
        switch entry {
        case .recent(let item): [item.iconURL, item.previewURL].compactMap { $0 }
        case .template(let item):
            switch item.source {
            case .local(let template): [template.iconURL, template.previewURL]
            case .hosted(let template): [artifactURL(catalogURL: catalogURL, key: template.currentRelease.icon.key), artifactURL(catalogURL: catalogURL, key: template.currentRelease.preview.key)].compactMap { $0 }
            }
        }
    }
}

private struct CatalogDetail: View {
    let entry: CatalogEntry?
    let catalogURL: URL
    let isCreating: Bool
    let primaryAction: (CatalogEntry) -> Void

    var body: some View {
        ZStack {
            Color(nsColor: .textBackgroundColor).ignoresSafeArea()
            if let entry {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(entry.title)
                                .font(.system(size: 34, weight: .semibold, design: .rounded))
                                .tracking(-1)
                            Text(entry.description)
                                .font(.body)
                                .foregroundStyle(.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }

                        if !entry.categories.isEmpty {
                            HStack(spacing: 7) {
                                ForEach(entry.categories, id: \.self) { category in
                                    Text(categoryLabel(category)).font(.caption.weight(.medium))
                                        .padding(.horizontal, 10).padding(.vertical, 5)
                                        .background(Color.accentColor.opacity(0.09), in: Capsule())
                                }
                            }
                        }

                        CatalogImageView(urls: previewURLs(for: entry), fallback: .preview)
                            .frame(maxWidth: .infinity)
                            .frame(minHeight: 250, maxHeight: 520)
                            .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 16))
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.primary.opacity(0.09)))

                        VStack(alignment: .leading, spacing: 0) {
                            Text("At a glance").font(.headline).padding(.bottom, 9)
                            ForEach(facts(for: entry)) { fact in
                                HStack(spacing: 12) {
                                    Label(fact.title, systemImage: fact.icon).foregroundStyle(.secondary)
                                    Spacer()
                                    Text(fact.value).multilineTextAlignment(.trailing)
                                }
                                .font(.callout).padding(.vertical, 8)
                                Divider()
                            }
                        }
                    }
                    .padding(.horizontal, 24)
                    .padding(.top, 12)
                    .padding(.bottom, 88)
                    .frame(maxWidth: 860, alignment: .leading)
                }
                .overlay(alignment: .bottomTrailing) {
                    FloatingPrimaryButton(
                        title: primaryTitle(for: entry),
                        icon: primaryIcon(for: entry),
                        isWorking: isCreating
                    ) { primaryAction(entry) }
                    .padding(22)
                }
            } else {
                ContentUnavailableView("Select a slop", systemImage: "square.stack.3d.up", description: Text("Choose an item from the list to see its preview and details."))
            }
        }
    }

    private func primaryTitle(for entry: CatalogEntry) -> String {
        switch entry { case .recent: "Open"; case .template: "Create" }
    }

    private func primaryIcon(for entry: CatalogEntry) -> String {
        switch entry { case .recent: "arrow.up.forward.app"; case .template: "sparkles" }
    }

    private func previewURLs(for entry: CatalogEntry) -> [URL] {
        switch entry {
        case .recent(let item): [item.previewURL, item.iconURL].compactMap { $0 }
        case .template(let item):
            switch item.source {
            case .local(let template): [template.previewURL, template.iconURL]
            case .hosted(let template): [artifactURL(catalogURL: catalogURL, key: template.currentRelease.preview.key), artifactURL(catalogURL: catalogURL, key: template.currentRelease.icon.key)].compactMap { $0 }
            }
        }
    }

    private func facts(for entry: CatalogEntry) -> [CatalogFact] {
        switch entry {
        case .recent(let item):
            return commonFacts(
                source: "Local document",
                manifest: item.package?.manifest,
                packageBytes: item.packageBytes,
                updatedAt: item.updatedAt,
                extra: item.createdAt.map { [CatalogFact(icon: "calendar", title: "Created", value: $0.formatted(date: .abbreviated, time: .omitted))] } ?? []
            )
        case .template(let item):
            var extra: [CatalogFact] = []
            if let publisher = item.publisher { extra.append(CatalogFact(icon: "person.crop.circle", title: "Publisher", value: publisher)) }
            if let release = item.releaseNumber { extra.append(CatalogFact(icon: "shippingbox", title: "Release", value: "Release \(release)")) }
            if let creationCount = item.creationCount { extra.append(CatalogFact(icon: "doc.on.doc", title: "Creations", value: "\(creationCount)")) }
            return commonFacts(
                source: item.isLocal ? "Installed locally" : "Online catalog",
                manifest: item.manifest,
                packageBytes: item.packageBytes ?? 0,
                updatedAt: item.updatedAt,
                extra: extra
            )
        }
    }

    private func commonFacts(source: String, manifest: SlopManifest?, packageBytes: Int64, updatedAt: Date?, extra: [CatalogFact]) -> [CatalogFact] {
        var result = [CatalogFact(icon: "externaldrive", title: "Source", value: source)]
        result.append(contentsOf: extra)
        if let presentation = manifest?.presentation {
            result.append(CatalogFact(icon: "rectangle", title: "Initial size", value: "\(presentation.width) × \(presentation.height)"))
        }
        if packageBytes > 0 {
            result.append(CatalogFact(icon: "doc", title: "Package size", value: ByteCountFormatter.string(fromByteCount: packageBytes, countStyle: .file)))
        }
        if let updatedAt {
            result.append(CatalogFact(icon: "clock", title: "Updated", value: updatedAt.formatted(date: .abbreviated, time: .shortened)))
        }
        return result
    }
}

private struct FloatingPrimaryButton: View {
    let title: String
    let icon: String
    let isWorking: Bool
    let action: () -> Void
    @State private var isHovering = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isWorking {
                    ProgressView().controlSize(.small).tint(.white)
                } else {
                    Image(systemName: icon)
                }
                Text(isWorking ? "Creating…" : title)
            }
            .font(.callout.weight(.bold))
            .foregroundStyle(.white)
            .padding(.horizontal, 18)
            .frame(height: 44)
            .background(
                Color(red: isHovering ? 0.53 : 0.45, green: 0.16, blue: 0.96),
                in: Capsule()
            )
            .overlay(Capsule().stroke(.white.opacity(0.18)))
            .shadow(color: Color(red: 0.35, green: 0.08, blue: 0.78).opacity(0.28), radius: 14, y: 7)
            .scaleEffect(isHovering ? 1.02 : 1)
        }
        .buttonStyle(.plain)
        .disabled(isWorking)
        .onHover { isHovering = $0 }
        .animation(.easeOut(duration: 0.12), value: isHovering)
    }
}

private struct CatalogFact: Identifiable {
    let id = UUID()
    let icon: String
    let title: String
    let value: String
}

private enum CatalogImageFallback { case applicationIcon, preview }

private struct CatalogImageView: View {
    let urls: [URL]
    let fallback: CatalogImageFallback
    @State private var image: NSImage?

    var body: some View {
        Group {
            if let image {
                Image(nsImage: image).resizable().interpolation(.high).scaledToFit()
            } else if fallback == .applicationIcon {
                Image(nsImage: NSApplication.shared.applicationIconImage).resizable().interpolation(.high).scaledToFit().padding(8)
            } else {
                VStack(spacing: 8) {
                    Image(systemName: "photo").font(.title2)
                    Text("Preview unavailable").font(.caption.weight(.medium))
                }.foregroundStyle(.secondary)
            }
        }
        .task(id: urls.map(\.absoluteString).joined(separator: "|")) {
            image = nil
            for url in urls {
                if let loaded = await loadCatalogImage(url) {
                    image = loaded
                    return
                }
            }
        }
    }
}

private func artifactURL(catalogURL: URL, key: String) -> URL? {
    var components = URLComponents(url: catalogURL.appendingPathComponent("api/artifact"), resolvingAgainstBaseURL: false)
    components?.queryItems = [URLQueryItem(name: "key", value: key)]
    return components?.url
}

@MainActor private func loadCatalogImage(_ url: URL) async -> NSImage? {
    if url.isFileURL { return NSImage(contentsOf: url) }
    guard let (data, _) = try? await URLSession.shared.data(from: url) else { return nil }
    return NSImage(data: data)
}

private func brandImage(named name: String) -> NSImage? {
    guard let url = Bundle.module.url(forResource: name, withExtension: "svg"), let image = NSImage(contentsOf: url) else { return nil }
    image.isTemplate = true
    return image
}

private func categoryLabel(_ id: String) -> String { id == "developer-tools" ? "Developer Tools" : id.capitalized }

private func categoryIcon(_ category: String) -> String {
    switch category.localizedLowercase {
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

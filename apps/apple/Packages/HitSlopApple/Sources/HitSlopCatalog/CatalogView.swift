import AppKit
import HitSlopCore
import HitSlopHost
import ComposableArchitecture
@_exported import HitSlopFeatures
import HitSlopRuntime
import SwiftUI

public struct CatalogView: View {
    @Bindable var store: StoreOf<CatalogFeature>
    @FocusState private var searchFocused: Bool
    @Environment(\.scenePhase) private var scenePhase

    public init(store: StoreOf<CatalogFeature>) {
        self.store = store
    }

    public var body: some View {
        NavigationSplitView {
            CatalogSidebarFeatureView(store: store)
            .navigationSplitViewColumnWidth(min: 168, ideal: 184, max: 204)
        } content: {
            CatalogResultsFeatureView(store: store, searchFocused: $searchFocused)
            .navigationSplitViewColumnWidth(min: 236, ideal: 264, max: 304)
            .ignoresSafeArea(.container, edges: .top)
        } detail: {
            CatalogDetailFeatureView(store: store)
            .frame(minWidth: 460)
            .ignoresSafeArea(.container, edges: .top)
        }
        .navigationSplitViewStyle(.balanced)
        .background {
            Button("Focus template search") { searchFocused = true }
                .keyboardShortcut("k", modifiers: .command)
                .frame(width: 1, height: 1).opacity(0)
        }
        .onAppear { store.send(.start) }
        .onChange(of: scenePhase) { _, phase in if phase == .active { store.send(.refreshSources) } }
        .onReceive(NotificationCenter.default.publisher(for: .hitSlopPreviewDidChange)) { _ in store.send(.refreshRecents) }
        .alert($store.scope(state: \.$alert, action: \.alert))
        .preferredColorScheme(.light)
    }
}

private struct CatalogSidebarFeatureView: View {
    let store: StoreOf<CatalogFeature>
    var body: some View {
        CatalogSidebar(filter: store.filter, categories: store.categories, recentCount: store.recents.count) {
            store.send(.filterChanged($0))
        }
    }
}

private struct CatalogResultsFeatureView: View {
    @Bindable var store: StoreOf<CatalogFeature>
    var searchFocused: FocusState<Bool>.Binding
    var body: some View {
        CatalogRail(
            title: store.filter.title, entries: store.visibleEntries,
            selectedID: $store.selectedID.sending(\.selected),
            query: $store.query.sending(\.queryChanged), searchFocused: searchFocused,
            localIssues: store.filter != .recents ? store.localIssues : [],
            onRefresh: { store.send(.refreshSources) }
        )
    }
}

private struct CatalogDetailFeatureView: View {
    let store: StoreOf<CatalogFeature>
    var body: some View {
        CatalogDetail(entry: store.selectedEntry, isCreating: store.creating != nil, isQuitting: store.isQuitting) {
            store.send(.primaryAction($0))
        }
    }
}

private struct CatalogSidebar: View {
    let filter: CatalogFilter
    let categories: [String]
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
                    SidebarButton(title: "Templates", emoji: catalogFilterEmoji(.all), selected: filter == .all) { select(.all) }
                    SidebarButton(title: "Recents", emoji: catalogFilterEmoji(.recents), count: recentCount, selected: filter == .recents) { select(.recents) }
                    ForEach(categories, id: \.self) { category in
                        SidebarButton(title: categoryLabel(category), emoji: categoryEmoji(category), selected: filter == .category(category)) { select(.category(category)) }
                    }

                }
                .padding(.horizontal, 8).padding(.bottom, 18)
            }

            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 9) {
                    BrandLink(name: "github", label: "GitHub", destination: CatalogLinks.github)
                    BrandLink(name: "discord", label: "Discord", destination: CatalogLinks.discord)
                }
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
    let destination: URL?

    var body: some View {
        Group {
            if let destination {
                Link(destination: destination) { icon }
            } else {
                Button {} label: { icon }
                    .disabled(true)
            }
        }
        .buttonStyle(.plain)
        .help(destination == nil ? "\(label) — coming soon" : label)
        .accessibilityLabel(destination == nil ? "\(label) — coming soon" : label)
    }

    private var icon: some View {
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
}

private struct SidebarButton: View {
    let title: String
    let emoji: String
    var count: Int?
    let selected: Bool
    let action: () -> Void

    init(title: String, emoji: String, count: Int? = nil, selected: Bool, action: @escaping () -> Void) {
        self.title = title; self.emoji = emoji; self.count = count; self.selected = selected; self.action = action
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 9) {
                Text(emoji).font(.system(size: 14)).frame(width: 20).accessibilityHidden(true)
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
    let localIssues: [String]
    let onRefresh: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            CatalogSearchBar(query: $query, focused: searchFocused)
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .firstTextBaseline) {
                    Text(title).font(.headline.weight(.semibold))
                    Spacer()
                    Text("\(entries.count)").font(.caption.monospacedDigit()).foregroundStyle(.tertiary)
                    Button(action: onRefresh) {
                        Image(systemName: "arrow.clockwise")
                    }
                    .buttonStyle(.plain)
                    .help("Refresh")
                    .accessibilityLabel("Refresh catalog")
                }
            }
            .padding(.horizontal, 14).padding(.vertical, 10)

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
                    CatalogRow(entry: entry)
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

    var body: some View {
        HStack(spacing: 11) {
            CatalogImageView(urls: entry.iconURLs, fallback: .applicationIcon)
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
        entry.isRecent ? "LOCAL DOCUMENT" : entry.isBundled ? "BUILT-IN" : "INSTALLED"
    }
}

private struct CatalogDetail: View {
    let entry: CatalogEntry?
    let isCreating: Bool
    let isQuitting: Bool
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
                            if let authorName = entry.authorName {
                                HStack(alignment: .firstTextBaseline, spacing: 8) {
                                    Text("By \(authorName)")
                                        .font(.callout.weight(.medium))
                                        .foregroundStyle(.secondary)
                                    if let authorURL = entry.authorURL {
                                        Link(authorURL.absoluteString, destination: authorURL)
                                            .font(.callout)
                                            .lineLimit(1)
                                            .truncationMode(.middle)
                                    }
                                }
                            }
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

                        CatalogImageView(urls: entry.previewURLs, fallback: .preview)
                            .frame(maxWidth: .infinity, alignment: .leading)

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
                    .disabled(isQuitting)
                    .padding(22)
                }
            } else {
                ContentUnavailableView("Select a slop", systemImage: "square.stack.3d.up", description: Text("Choose an item from the list to see its preview and details."))
            }
        }
    }

    private func primaryTitle(for entry: CatalogEntry) -> String { entry.isRecent ? "Open" : "Create" }
    private func primaryIcon(for entry: CatalogEntry) -> String { entry.isRecent ? "arrow.up.forward.app" : "sparkles" }
    private func facts(for entry: CatalogEntry) -> [CatalogFact] {
        var result = [CatalogFact(icon: "externaldrive", title: "Source", value: entry.isRecent ? "Local document" : entry.isBundled ? "Included with hitSlop" : "Installed locally")]
        if entry.isRecent, let date = entry.createdAt { result.append(CatalogFact(icon: "calendar", title: "Created", value: date.formatted(date: .abbreviated, time: .omitted))) }
        if let size = entry.initialSize { result.append(CatalogFact(icon: "rectangle", title: "Initial size", value: size)) }
        if entry.packageBytes > 0 { result.append(CatalogFact(icon: "doc", title: "Package size", value: ByteCountFormatter.string(fromByteCount: entry.packageBytes, countStyle: .file))) }
        if let date = entry.updatedAt { result.append(CatalogFact(icon: "clock", title: "Updated", value: date.formatted(date: .abbreviated, time: .shortened))) }
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
    private let maxPreviewWidth: CGFloat = 560
    private let maxPreviewHeight: CGFloat = 420

    var body: some View {
        Group {
            if let image {
                let preview = Image(nsImage: image).resizable().interpolation(.high).scaledToFit()
                if fallback == .preview {
                    preview.frame(maxWidth: min(maxPreviewWidth, image.size.width), maxHeight: min(maxPreviewHeight, image.size.height))
                } else {
                    preview
                }
            } else if fallback == .applicationIcon {
                Image(nsImage: NSApplication.shared.applicationIconImage).resizable().interpolation(.high).scaledToFit().padding(8)
            } else {
                VStack(spacing: 8) {
                    Image(systemName: "photo").font(.title2)
                    Text("Preview unavailable").font(.caption.weight(.medium))
                }
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, minHeight: 180)
            }
        }
        .padding(fallback == .preview ? 10 : 0)
        .background {
            if fallback == .preview {
                RoundedRectangle(cornerRadius: 16).fill(Color(nsColor: .controlBackgroundColor))
            }
        }
        .overlay {
            if fallback == .preview {
                RoundedRectangle(cornerRadius: 16).stroke(Color.primary.opacity(0.09))
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

@MainActor private func loadCatalogImage(_ url: URL) async -> NSImage? {
    guard url.isFileURL else { return nil }
    return NSImage(contentsOf: url)
}

private func brandImage(named name: String) -> NSImage? {
    guard let url = Bundle.module.url(forResource: name, withExtension: "svg"), let image = NSImage(contentsOf: url) else { return nil }
    image.isTemplate = true
    return image
}

private func categoryLabel(_ id: String) -> String { id == "developer-tools" ? "Developer Tools" : id.capitalized }

func catalogFilterEmoji(_ filter: CatalogFilter) -> String {
    switch filter {
    case .all: "🧃"
    case .recents: "🔥"
    case .category(let category): categoryEmoji(category)
    }
}

func categoryEmoji(_ category: String) -> String {
    switch category.localizedLowercase {
    case "productivity": "⚡️"
    case "utilities": "🪄"
    case "finance": "🤑"
    case "media": "🎬"
    case "games": "🎮"
    case "developer-tools": "👾"
    case "education": "🎓"
    case "business": "📊"
    case "personal": "💖"
    default: "🎲"
    }
}

import AppKit
import SlopCore
import SlopMacSupport
import SwiftUI

struct SlopTemplateDescriptor: Identifiable {
    let id: String
    let url: URL
    let title: String
    let summary: String
    let categories: [String]
    let tags: [String]
    let preview: NSImage?

    var suggestedFilename: String { title.replacingOccurrences(of: "/", with: "-") + ".slop" }

    func matches(_ query: String, category: String?) -> Bool {
        let categoryMatches = category == nil || categories.contains(category!)
        guard categoryMatches else { return false }
        let cleaned = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !cleaned.isEmpty else { return true }
        return ([title, summary] + categories + tags)
            .joined(separator: " ")
            .lowercased()
            .contains(cleaned)
    }

    static func bundled() -> [SlopTemplateDescriptor] {
        guard let root = Bundle.module.resourceURL?.appendingPathComponent("Templates"),
              let urls = try? FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)
        else { return [] }
        return urls.filter { $0.pathExtension.lowercased() == "slop" }.compactMap { url in
            guard let package = try? SlopPackage(rootURL: url) else { return nil }
            return SlopTemplateDescriptor(
                id: package.manifest.id,
                url: url,
                title: package.manifest.title,
                summary: package.manifest.catalog.summary,
                categories: package.manifest.catalog.categories,
                tags: package.manifest.catalog.tags,
                preview: SlopPreviewAssets.previewURL(in: url).flatMap(NSImage.init(contentsOf:))
            )
        }.sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
    }
}

struct RecentSlopDescriptor: Identifiable {
    let id: String
    let url: URL
    let title: String
    let path: String
    let preview: NSImage?

    static func load(from urls: [URL], limit: Int = 8) -> [RecentSlopDescriptor] {
        urls.filter { FileManager.default.fileExists(atPath: $0.path) }.prefix(limit).compactMap { url in
            guard let package = try? SlopPackage(rootURL: url) else { return nil }
            return RecentSlopDescriptor(
                id: url.standardizedFileURL.path,
                url: url,
                title: package.manifest.title,
                path: url.deletingLastPathComponent().path,
                preview: SlopPreviewAssets.thumbnailURL(in: url).flatMap(NSImage.init(contentsOf:))
            )
        }
    }
}

@MainActor
final class TemplatePickerWindowController: NSWindowController {
    init(
        recents: [URL],
        create: @escaping (SlopTemplateDescriptor) -> Void,
        openRecent: @escaping (URL) -> Void,
        openExisting: @escaping () -> Void,
        clearRecents: @escaping () -> Void
    ) {
        let content = TemplatePickerView(
            templates: SlopTemplateDescriptor.bundled(),
            recents: RecentSlopDescriptor.load(from: recents),
            create: create,
            openRecent: openRecent,
            openExisting: openExisting,
            clearRecents: clearRecents
        )
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 920, height: 560),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "hitSlop"
        window.titlebarAppearsTransparent = false
        window.isRestorable = false
        window.tabbingMode = .disallowed
        window.minSize = NSSize(width: 780, height: 480)
        window.contentView = NSHostingView(rootView: content)
        window.center()
        super.init(window: window)
    }

    required init?(coder: NSCoder) { nil }
}

private enum PickerSection: Hashable {
    case all
    case recents
    case category(String)
}

private struct PickerPalette {
    let background = Color(red: 0.090, green: 0.090, blue: 0.095)
    let sidebar = Color(red: 0.068, green: 0.068, blue: 0.074)
    let browser = Color(red: 0.105, green: 0.105, blue: 0.112)
    let detail = Color(red: 0.080, green: 0.080, blue: 0.086)
    let stage = Color(red: 0.135, green: 0.135, blue: 0.142)
    let surface = Color.white.opacity(0.045)
    let selected = Color.white.opacity(0.085)
    let border = Color.white.opacity(0.10)
    let ink = Color.white.opacity(0.94)
    let muted = Color.white.opacity(0.58)
    let faint = Color.white.opacity(0.34)
    let accent = Color(red: 0.42, green: 0.57, blue: 0.95)
}

private struct TemplatePickerView: View {
    let templates: [SlopTemplateDescriptor]
    let recents: [RecentSlopDescriptor]
    let create: (SlopTemplateDescriptor) -> Void
    let openRecent: (URL) -> Void
    let openExisting: () -> Void
    let clearRecents: () -> Void

    @State private var query = ""
    @State private var section: PickerSection = .all
    @State private var selectedTemplateID: String?
    @State private var selectedRecentID: String?

    private let palette = PickerPalette()

    private var categories: [String] { Array(Set(templates.flatMap(\.categories))).sorted() }
    private var visibleTemplates: [SlopTemplateDescriptor] {
        let category: String?
        switch section {
        case .category(let value): category = value
        default: category = nil
        }
        return templates.filter { $0.matches(query, category: category) }
    }
    private var visibleRecents: [RecentSlopDescriptor] {
        let cleaned = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !cleaned.isEmpty else { return recents }
        return recents.filter { ($0.title + " " + $0.path).lowercased().contains(cleaned) }
    }
    private var selectedTemplate: SlopTemplateDescriptor? {
        visibleTemplates.first { $0.id == selectedTemplateID } ?? visibleTemplates.first
    }
    private var selectedRecent: RecentSlopDescriptor? {
        visibleRecents.first { $0.id == selectedRecentID } ?? visibleRecents.first
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                librarySidebar
                Divider().overlay(palette.border)
                browserPanel
                Divider().overlay(palette.border)
                detailPanel
            }
            Divider().overlay(palette.border)
            bottomBar
        }
        .foregroundStyle(palette.ink)
        .background(palette.background)
        .onAppear { reconcileSelection() }
        .onChange(of: query) { reconcileSelection() }
        .onChange(of: section) { reconcileSelection() }
        .onMoveCommand(perform: moveSelection)
    }

    private var librarySidebar: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 10) {
                Image(nsImage: NSApp.applicationIconImage)
                    .resizable()
                    .frame(width: 30, height: 30)
                Text("hitSlop")
                    .font(.system(size: 18, weight: .bold, design: .rounded))
            }
            .padding(.horizontal, 14)
            .padding(.top, 14)
            .padding(.bottom, 16)

            CategoryButton(
                title: "All templates",
                count: templates.count,
                icon: "square.grid.2x2",
                selected: section == .all,
                palette: palette,
                action: { section = .all }
            )
            CategoryButton(
                title: "Recents",
                count: recents.count,
                icon: "clock.arrow.circlepath",
                selected: section == .recents,
                palette: palette,
                action: { section = .recents }
            )

            Text("COLLECTIONS")
                .font(.system(size: 10, weight: .semibold))
                .tracking(1.2)
                .foregroundStyle(palette.faint)
                .padding(.horizontal, 14)
                .padding(.top, 18)
                .padding(.bottom, 7)
            ForEach(categories, id: \.self) { value in
                CategoryButton(
                    title: value,
                    count: templates.filter { $0.categories.contains(value) }.count,
                    icon: categoryIcon(value),
                    selected: section == .category(value),
                    palette: palette,
                    action: { section = .category(value) }
                )
            }
            Spacer()
            Text("More templates soon")
                .font(.system(size: 11))
                .foregroundStyle(palette.faint)
                .padding(14)
        }
        .frame(width: 178)
        .background(palette.sidebar)
    }

    private var browserPanel: some View {
        VStack(alignment: .leading, spacing: 0) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .firstTextBaseline) {
                    Text(sectionTitle)
                        .font(.system(size: 20, weight: .bold, design: .rounded))
                    Spacer()
                    if section == .recents && !recents.isEmpty {
                        Button("Clear", action: clearRecents)
                            .buttonStyle(.plain)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(palette.muted)
                    }
                }
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(palette.faint)
                    TextField(section == .recents ? "Search recents" : "Search templates", text: $query)
                        .textFieldStyle(.plain)
                        .font(.system(size: 12))
                }
                .padding(.horizontal, 10)
                .frame(height: 30)
                .background(palette.surface)
                .overlay(RoundedRectangle(cornerRadius: 7).stroke(palette.border))
            }
            .padding(16)
            Divider().overlay(palette.border)

            if section == .recents {
                recentList
            } else if visibleTemplates.isEmpty {
                emptyList("No templates found", detail: "Try another search or collection.")
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(visibleTemplates) { template in
                            TemplateIndexRow(
                                template: template,
                                selected: selectedTemplate?.id == template.id,
                                palette: palette,
                                action: { selectedTemplateID = template.id },
                                open: { create(template) }
                            )
                            Divider().overlay(palette.border).padding(.leading, 16)
                        }
                    }
                }
            }
        }
        .frame(width: 290)
        .background(palette.browser)
    }

    @ViewBuilder
    private var recentList: some View {
        if visibleRecents.isEmpty {
            emptyList("No recent documents", detail: "Documents you open will appear here.")
        } else {
            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(visibleRecents) { recent in
                        RecentIndexRow(
                            recent: recent,
                            selected: selectedRecent?.id == recent.id,
                            palette: palette,
                            action: { selectedRecentID = recent.id },
                            open: { openRecent(recent.url) }
                        )
                        Divider().overlay(palette.border).padding(.leading, 16)
                    }
                }
            }
        }
    }

    private func emptyList(_ title: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.system(size: 14, weight: .semibold))
            Text(detail).font(.system(size: 12)).foregroundStyle(palette.muted)
        }
        .padding(18)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    @ViewBuilder
    private var detailPanel: some View {
        if section == .recents {
            recentDetail
        } else {
            templateDetail
        }
    }

    @ViewBuilder
    private var templateDetail: some View {
        if let template = selectedTemplate {
            VStack(alignment: .leading, spacing: 0) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(template.categories.joined(separator: " / ").uppercased())
                        .font(.system(size: 9, weight: .bold))
                        .tracking(1.1)
                        .foregroundStyle(palette.accent)
                    Text(template.title)
                        .font(.system(size: 24, weight: .bold, design: .rounded))
                    Text(template.summary)
                        .font(.system(size: 12))
                        .foregroundStyle(palette.muted)
                        .lineLimit(2)
                }
                .padding(.horizontal, 20)
                .padding(.top, 18)
                .padding(.bottom, 14)

                TemplatePreview(image: template.preview, palette: palette)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding(.horizontal, 20)
                    .padding(.bottom, 18)
            }
            .background(palette.detail)
        } else {
            emptyDetail("Choose a template", detail: "Its preview will appear here.")
        }
    }

    @ViewBuilder
    private var recentDetail: some View {
        if let recent = selectedRecent {
            VStack(alignment: .leading, spacing: 0) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("RECENT DOCUMENT")
                        .font(.system(size: 9, weight: .bold))
                        .tracking(1.1)
                        .foregroundStyle(palette.accent)
                    Text(recent.title)
                        .font(.system(size: 24, weight: .bold, design: .rounded))
                    Text(recent.path)
                        .font(.system(size: 11))
                        .foregroundStyle(palette.muted)
                        .lineLimit(2)
                        .truncationMode(.middle)
                }
                .padding(.horizontal, 20)
                .padding(.top, 18)
                .padding(.bottom, 14)

                TemplatePreview(image: recent.preview, palette: palette)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .padding(.horizontal, 20)
                    .padding(.bottom, 18)
            }
            .background(palette.detail)
        } else {
            emptyDetail("No recent documents", detail: "Open a .slop document to add it here.")
        }
    }

    private func emptyDetail(_ title: String, detail: String) -> some View {
        VStack(spacing: 8) {
            Image(systemName: "rectangle.stack")
                .font(.system(size: 26, weight: .light))
                .foregroundStyle(palette.faint)
            Text(title).font(.system(size: 15, weight: .semibold))
            Text(detail).font(.system(size: 12)).foregroundStyle(palette.muted)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(palette.detail)
    }

    private var bottomBar: some View {
        HStack(spacing: 10) {
            Button("Open Existing…", action: openExisting)
                .buttonStyle(.bordered)
            Spacer()
            if section == .recents {
                Button("Open") {
                    if let recent = selectedRecent { openRecent(recent.url) }
                }
                .buttonStyle(.borderedProminent)
                .keyboardShortcut(.defaultAction)
                .disabled(selectedRecent == nil)
            } else {
                Button("Choose") {
                    if let template = selectedTemplate { create(template) }
                }
                .buttonStyle(.borderedProminent)
                .keyboardShortcut(.defaultAction)
                .disabled(selectedTemplate == nil)
            }
        }
        .padding(.horizontal, 14)
        .frame(height: 48)
        .background(palette.background)
    }

    private var sectionTitle: String {
        switch section {
        case .all: "Templates"
        case .recents: "Recently Opened"
        case .category(let value): value
        }
    }

    private func categoryIcon(_ category: String) -> String {
        switch category.lowercased() {
        case "database": "cylinder"
        case "notes": "note.text"
        case "productivity": "checkmark.circle"
        default: "square.stack.3d.up"
        }
    }

    private func reconcileSelection() {
        if section == .recents {
            if let first = visibleRecents.first,
               !visibleRecents.contains(where: { $0.id == selectedRecentID }) {
                selectedRecentID = first.id
            } else if visibleRecents.isEmpty {
                selectedRecentID = nil
            }
        } else if let first = visibleTemplates.first,
                  !visibleTemplates.contains(where: { $0.id == selectedTemplateID }) {
            selectedTemplateID = first.id
        } else if visibleTemplates.isEmpty {
            selectedTemplateID = nil
        }
    }

    private func moveSelection(_ direction: MoveCommandDirection) {
        if section == .recents {
            guard !visibleRecents.isEmpty else { return }
            let current = visibleRecents.firstIndex { $0.id == selectedRecent?.id } ?? 0
            switch direction {
            case .up: selectedRecentID = visibleRecents[max(0, current - 1)].id
            case .down: selectedRecentID = visibleRecents[min(visibleRecents.count - 1, current + 1)].id
            default: break
            }
        } else {
            guard !visibleTemplates.isEmpty else { return }
            let current = visibleTemplates.firstIndex { $0.id == selectedTemplate?.id } ?? 0
            switch direction {
            case .up: selectedTemplateID = visibleTemplates[max(0, current - 1)].id
            case .down: selectedTemplateID = visibleTemplates[min(visibleTemplates.count - 1, current + 1)].id
            default: break
            }
        }
    }
}

private struct CategoryButton: View {
    let title: String
    let count: Int
    let icon: String
    let selected: Bool
    let palette: PickerPalette
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 9) {
                Image(systemName: icon)
                    .font(.system(size: 12, weight: .medium))
                    .frame(width: 16)
                Text(title)
                    .font(.system(size: 12, weight: selected ? .semibold : .regular))
                Spacer()
                Text("\(count)")
                    .font(.system(size: 10, weight: .medium, design: .monospaced))
                    .foregroundStyle(selected ? palette.ink : palette.faint)
            }
            .foregroundStyle(selected ? palette.ink : palette.muted)
            .padding(.horizontal, 12)
            .frame(height: 34)
            .contentShape(Rectangle())
            .background(selected ? palette.selected : .clear)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

private struct TemplateIndexRow: View {
    let template: SlopTemplateDescriptor
    let selected: Bool
    let palette: PickerPalette
    let action: () -> Void
    let open: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: 10) {
                Rectangle()
                    .fill(selected ? palette.accent : .clear)
                    .frame(width: 2)
                VStack(alignment: .leading, spacing: 5) {
                    Text(template.title)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(palette.ink)
                    Text(template.summary)
                        .font(.system(size: 11))
                        .foregroundStyle(palette.muted)
                        .lineLimit(2)
                        .lineSpacing(2)
                }
                Spacer(minLength: 0)
            }
            .padding(.trailing, 14)
            .padding(.vertical, 11)
            .frame(maxWidth: .infinity, minHeight: 60, alignment: .leading)
            .contentShape(Rectangle())
            .background(selected ? palette.selected : .clear)
        }
        .buttonStyle(.plain)
        .simultaneousGesture(TapGesture(count: 2).onEnded(open))
        .accessibilityAddTraits(selected ? .isSelected : [])
        .accessibilityHint("Double-click to create a document")
    }
}

private struct RecentIndexRow: View {
    let recent: RecentSlopDescriptor
    let selected: Bool
    let palette: PickerPalette
    let action: () -> Void
    let open: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(alignment: .top, spacing: 10) {
                Rectangle()
                    .fill(selected ? palette.accent : .clear)
                    .frame(width: 2)
                VStack(alignment: .leading, spacing: 4) {
                    Text(recent.title)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(palette.ink)
                        .lineLimit(1)
                    Text(recent.path)
                        .font(.system(size: 10))
                        .foregroundStyle(palette.muted)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
                Spacer(minLength: 0)
            }
            .padding(.trailing, 14)
            .padding(.vertical, 11)
            .frame(maxWidth: .infinity, minHeight: 54, alignment: .leading)
            .background(selected ? palette.selected : .clear)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .simultaneousGesture(TapGesture(count: 2).onEnded(open))
        .accessibilityAddTraits(selected ? .isSelected : [])
        .accessibilityHint("Double-click to open")
    }
}

private struct TemplatePreview: View {
    let image: NSImage?
    let palette: PickerPalette

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 10).fill(palette.stage)
            if let image {
                Image(nsImage: image)
                    .resizable()
                    .scaledToFit()
                    .padding(10)
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "swift")
                        .font(.system(size: 46, weight: .light))
                    Text("Preview coming soon")
                        .font(.system(size: 13, weight: .medium, design: .serif))
                }
                .foregroundStyle(palette.faint)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(palette.border))
        .shadow(color: .black.opacity(0.18), radius: 12, y: 5)
    }
}

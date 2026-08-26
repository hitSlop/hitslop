import AppKit
import SwiftUI

struct SlopTemplateDescriptor: Identifiable {
    let id: String
    let url: URL
    let title: String
    let summary: String
    let preview: NSImage?

    var suggestedFilename: String {
        title.replacingOccurrences(of: "/", with: "-") + ".slop"
    }

    static func bundled() -> [SlopTemplateDescriptor] {
        guard let root = Bundle.main.resourceURL?.appendingPathComponent("Templates"),
              let urls = try? FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)
        else { return [] }
        return urls
            .filter { $0.pathExtension.lowercased() == "slop" }
            .compactMap { url -> SlopTemplateDescriptor? in
                guard let database = try? SlopDatabase(packageURL: url, readOnly: true),
                      let metadata = try? database.metadata() else { return nil }
                let previewAsset = try? database.asset(path: "/preview.png")
                let preview = previewAsset.flatMap { NSImage(data: $0.data) }
                return SlopTemplateDescriptor(
                    id: metadata["template_id"] ?? url.lastPathComponent,
                    url: url,
                    title: metadata.title,
                    summary: metadata.summary,
                    preview: preview
                )
            }
            .sorted { $0.title < $1.title }
    }
}

@MainActor
final class TemplatePickerWindowController: NSWindowController, NSWindowDelegate {
    private let onCreate: (SlopTemplateDescriptor) -> Void
    private let onOpenExisting: () -> Void

    init(create: @escaping (SlopTemplateDescriptor) -> Void, openExisting: @escaping () -> Void) {
        self.onCreate = create
        self.onOpenExisting = openExisting
        let content = TemplatePickerView(
            templates: SlopTemplateDescriptor.bundled(),
            create: create,
            openExisting: openExisting
        )
        let hosting = NSHostingView(rootView: content)
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 820, height: 620),
            styleMask: [.titled, .closable, .miniaturizable],
            backing: .buffered,
            defer: false
        )
        window.title = "New hitSlop"
        window.titlebarAppearsTransparent = true
        window.isMovableByWindowBackground = true
        window.isRestorable = false
        window.tabbingMode = .disallowed
        window.contentView = hosting
        window.center()
        super.init(window: window)
        window.delegate = self
    }

    required init?(coder: NSCoder) { nil }
}

private struct TemplatePickerView: View {
    let templates: [SlopTemplateDescriptor]
    let create: (SlopTemplateDescriptor) -> Void
    let openExisting: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Make a small piece of software")
                        .font(.system(size: 28, weight: .semibold, design: .rounded))
                    Text("Choose a starting point. The copy you create is yours—and it saves itself.")
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Button("Open Existing…", action: openExisting)
                    .buttonStyle(.bordered)
            }
            .padding(.horizontal, 32)
            .padding(.top, 34)
            .padding(.bottom, 24)

            if templates.isEmpty {
                ContentUnavailableView(
                    "No templates found",
                    systemImage: "square.stack.3d.up.slash",
                    description: Text("Build the bundled .slop templates and relaunch hitSlop.")
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                HStack(spacing: 22) {
                    ForEach(templates) { template in
                        TemplateCard(template: template) { create(template) }
                    }
                }
                .padding(.horizontal, 32)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
        }
        .background(Color(nsColor: .windowBackgroundColor))
    }
}

private struct TemplateCard: View {
    let template: SlopTemplateDescriptor
    let action: () -> Void
    @State private var hovered = false

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 14) {
                Group {
                    if let preview = template.preview {
                        Image(nsImage: preview)
                            .resizable()
                            .scaledToFill()
                    } else {
                        ZStack {
                            LinearGradient(colors: [.indigo.opacity(0.45), .pink.opacity(0.3)], startPoint: .topLeading, endPoint: .bottomTrailing)
                            Image(systemName: "doc.richtext")
                                .font(.system(size: 46, weight: .light))
                        }
                    }
                }
                .frame(width: 344, height: 350)
                .clipped()
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

                Text(template.title)
                    .font(.system(size: 18, weight: .semibold, design: .rounded))
                    .foregroundStyle(.primary)
                Text(template.summary)
                    .font(.system(size: 13))
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                    .frame(height: 36, alignment: .topLeading)
            }
            .padding(12)
            .background(.primary.opacity(hovered ? 0.08 : 0.035), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(.primary.opacity(hovered ? 0.16 : 0.06)))
            .scaleEffect(hovered ? 1.012 : 1)
            .animation(.easeOut(duration: 0.14), value: hovered)
        }
        .buttonStyle(.plain)
        .onHover { hovered = $0 }
    }
}

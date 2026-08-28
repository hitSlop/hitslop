import AppKit
import SlopCore
import SlopMacSupport
import SwiftUI

struct SlopTemplateDescriptor: Identifiable {
    let id: String
    let url: URL
    let title: String
    let summary: String
    let preview: NSImage?

    var suggestedFilename: String { title.replacingOccurrences(of: "/", with: "-") + ".slop" }

    static func bundled() -> [SlopTemplateDescriptor] {
        guard let root = Bundle.module.resourceURL?.appendingPathComponent("Templates"),
              let urls = try? FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)
        else { return [] }
        return urls.filter { $0.pathExtension.lowercased() == "slop" }.compactMap { url in
            guard let package = try? SlopPackage(rootURL: url) else { return nil }
            let preview = SlopPreviewAssets.previewURL(in: url).flatMap(NSImage.init(contentsOf:))
            let store = package.manifest.stores.first?.kind.rawValue.uppercased() ?? "LOCAL"
            return SlopTemplateDescriptor(
                id: package.manifest.id,
                url: url,
                title: package.manifest.title,
                summary: "ElementaryUI · \(store) persistence · editable Swift source",
                preview: preview
            )
        }.sorted { $0.title < $1.title }
    }
}

@MainActor
final class TemplatePickerWindowController: NSWindowController {
    init(create: @escaping (SlopTemplateDescriptor) -> Void, openExisting: @escaping () -> Void) {
        let content = TemplatePickerView(templates: SlopTemplateDescriptor.bundled(), create: create, openExisting: openExisting)
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
        window.contentView = NSHostingView(rootView: content)
        window.center()
        super.init(window: window)
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
                    Text("Make a small piece of software").font(.system(size: 28, weight: .semibold, design: .rounded))
                    Text("Choose a starting point. Its Swift source and data live beside it.").foregroundStyle(.secondary)
                }
                Spacer()
                Button("Open Existing…", action: openExisting).buttonStyle(.bordered)
            }
            .padding(.horizontal, 32).padding(.top, 34).padding(.bottom, 24)
            HStack(spacing: 22) {
                ForEach(templates) { template in TemplateCard(template: template) { create(template) } }
            }
            .padding(.horizontal, 32)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
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
                    if let preview = template.preview { Image(nsImage: preview).resizable().scaledToFill() }
                    else { ZStack { Color.secondary.opacity(0.12); Image(systemName: "swift").font(.system(size: 48)) } }
                }
                .frame(width: 344, height: 350).clipped().clipShape(RoundedRectangle(cornerRadius: 18))
                Text(template.title).font(.system(size: 18, weight: .semibold, design: .rounded))
                Text(template.summary).font(.system(size: 13)).foregroundStyle(.secondary).lineLimit(2)
            }
            .padding(12)
            .background(.primary.opacity(hovered ? 0.08 : 0.035), in: RoundedRectangle(cornerRadius: 24))
            .overlay(RoundedRectangle(cornerRadius: 24).stroke(.primary.opacity(hovered ? 0.16 : 0.06)))
            .scaleEffect(hovered ? 1.012 : 1)
            .animation(.easeOut(duration: 0.14), value: hovered)
        }
        .buttonStyle(.plain)
        .onHover { hovered = $0 }
    }
}

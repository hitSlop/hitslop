import AppKit
import SlopCore
import SwiftUI

@MainActor
final class AppearancePanelController: NSWindowController {
    private let packageURL: URL
    private let applyTheme: (SlopThemeDescriptor) -> Void
    private let applyShape: (SlopManifest.WindowShape) -> Void
    private let saveTheme: () -> Void

    init(
        packageURL: URL,
        applyTheme: @escaping (SlopThemeDescriptor) -> Void,
        applyShape: @escaping (SlopManifest.WindowShape) -> Void,
        saveTheme: @escaping () -> Void
    ) {
        self.packageURL = packageURL
        self.applyTheme = applyTheme
        self.applyShape = applyShape
        self.saveTheme = saveTheme
        let panel = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 330, height: 520),
            styleMask: [.titled, .closable, .utilityWindow],
            backing: .buffered,
            defer: false
        )
        panel.title = "Appearance"
        panel.isFloatingPanel = true
        panel.hidesOnDeactivate = false
        panel.isReleasedWhenClosed = false
        panel.isRestorable = false
        super.init(window: panel)
        refresh()
    }

    required init?(coder: NSCoder) { nil }

    func refresh() {
        guard let window else { return }
        window.contentView = NSHostingView(rootView: AppearanceView(
            packageURL: packageURL,
            themes: SlopThemeCatalog.all(),
            applyTheme: applyTheme,
            applyShape: applyShape,
            saveTheme: saveTheme
        ))
    }

    func show(relativeTo parent: NSWindow?) {
        if let parent, let window {
            let parentFrame = parent.frame
            let visible = parent.screen?.visibleFrame ?? NSScreen.main?.visibleFrame ?? parentFrame
            var origin = NSPoint(x: parentFrame.maxX + 10, y: parentFrame.maxY - window.frame.height)
            if origin.x + window.frame.width > visible.maxX {
                origin.x = parentFrame.minX - window.frame.width - 10
            }
            origin.y = max(visible.minY, min(origin.y, visible.maxY - window.frame.height))
            window.setFrameOrigin(origin)
        }
        showWindow(nil)
        window?.makeKeyAndOrderFront(nil)
    }
}

private struct AppearanceView: View {
    let packageURL: URL
    let themes: [SlopThemeDescriptor]
    let applyTheme: (SlopThemeDescriptor) -> Void
    let applyShape: (SlopManifest.WindowShape) -> Void
    let saveTheme: () -> Void

    private var manifest: SlopManifest? { try? SlopManifestIO.read(from: packageURL) }
    private let columns = [GridItem(.adaptive(minimum: 120), spacing: 10)]

    var body: some View {
        TabView {
            themeView.tabItem { Label("Theme", systemImage: "paintpalette") }
            shapeView.tabItem { Label("Window", systemImage: "square.on.circle") }
        }
        .padding(14)
        .frame(minWidth: 330, minHeight: 480)
    }

    private var themeView: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Themes").font(.title2.weight(.semibold))
            Text("Themes are copied into theme.css, where coding agents can customize them live.")
                .font(.caption).foregroundStyle(.secondary)
            ScrollView {
                LazyVGrid(columns: columns, spacing: 10) {
                    ForEach(themes) { theme in
                        Button { applyTheme(theme) } label: {
                            VStack(alignment: .leading, spacing: 7) {
                                HStack(spacing: 0) {
                                    ForEach(Array(theme.colors.prefix(4).enumerated()), id: \.offset) { _, value in
                                        Rectangle().fill(Color(themeHex: value))
                                    }
                                }
                                .frame(height: 42)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                Text(theme.displayName).font(.system(size: 12, weight: .semibold)).lineLimit(1)
                                Text(theme.manifest.summary).font(.caption2).foregroundStyle(.secondary).lineLimit(2)
                            }
                            .padding(8)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(
                                manifest?.appearance.themeID == theme.id ? Color.accentColor.opacity(0.14) : Color.primary.opacity(0.035),
                                in: RoundedRectangle(cornerRadius: 12)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            Button("Save Current to Library…", action: saveTheme)
        }
    }

    private var shapeView: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Window Shape").font(.title2.weight(.semibold))
            Text("The native mask and hit area update immediately.")
                .font(.caption).foregroundStyle(.secondary)
            shapeButton("Rounded", icon: "square", shape: .init(kind: .roundedRect, radius: 22))
            shapeButton("Soft Rounded", icon: "square.fill", shape: .init(kind: .roundedRect, radius: 48))
            shapeButton("Capsule", icon: "capsule", shape: .init(kind: .capsule, radius: nil))
            shapeButton("Circle", icon: "circle", shape: .init(kind: .circle, radius: nil))
            Spacer()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func shapeButton(_ title: String, icon: String, shape: SlopManifest.WindowShape) -> some View {
        let selected = manifest?.window.shape == shape
        return Button { applyShape(shape) } label: {
            HStack(spacing: 12) {
                Image(systemName: icon).font(.system(size: 24)).frame(width: 36)
                Text(title).font(.headline)
                Spacer()
                if selected { Image(systemName: "checkmark.circle.fill").foregroundStyle(.tint) }
            }
            .padding(12)
            .background(selected ? Color.accentColor.opacity(0.14) : Color.primary.opacity(0.04), in: RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
    }
}

private extension Color {
    init(themeHex value: String) {
        let hex = value.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
        guard let number = UInt64(hex, radix: 16), hex.count == 6 else {
            self = .gray
            return
        }
        self = Color(
            red: Double((number >> 16) & 0xff) / 255,
            green: Double((number >> 8) & 0xff) / 255,
            blue: Double(number & 0xff) / 255
        )
    }
}

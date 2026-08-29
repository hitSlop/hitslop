import AppKit
import HitSlopRegistry
import SwiftUI

public struct CatalogView: View {
    @StateObject private var model: RegistryModel
    @State private var query = ""; @State private var category = "All"; @State private var selected: RegistryTemplate?

    public init(deploymentURL: String, catalogURL: URL) { _model = StateObject(wrappedValue: RegistryModel(deploymentURL: deploymentURL, catalogURL: catalogURL)) }
    private var categories: [String] { ["All"] + Set(model.templates.flatMap(\.categories)).sorted() }
    private var visible: [RegistryTemplate] { model.templates.filter { category == "All" || $0.categories.contains(category) } }
    private var recentDocuments: [URL] { Array(NSDocumentController.shared.recentDocumentURLs.filter { $0.pathExtension == "slop" }.prefix(4)) }

    public var body: some View {
        ZStack {
            LinearGradient(colors: [Color(nsColor: .windowBackgroundColor), Color.orange.opacity(0.12), Color.pink.opacity(0.10)], startPoint: .top, endPoint: .bottomTrailing).ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 42) {
                    VStack(alignment: .leading, spacing: 18) {
                        Text("TINY APPS · LOCAL DATA").font(.caption.weight(.semibold)).tracking(2).foregroundStyle(.secondary)
                        Text("What are you\nworking on?").font(.system(size: 72, weight: .semibold, design: .serif)).tracking(-4).lineSpacing(-10)
                        HStack(spacing: 14) { Image(systemName: "magnifyingglass"); TextField("A timer, an invoice, a strange little tool…", text: $query).textFieldStyle(.plain).font(.title3); Text("⌘K").font(.caption).foregroundStyle(.secondary) }
                            .padding(.horizontal, 20).frame(height: 66).background(.background).overlay(Rectangle().stroke(.separator)).shadow(color: .black.opacity(0.08), radius: 0, x: 9, y: 10)
                        HStack { ForEach(categories, id: \.self) { item in Button(item) { category = item }.buttonStyle(.plain).padding(.vertical, 5).overlay(alignment: .bottom) { if item == category { Rectangle().fill(.orange).frame(height: 1) } } } }.foregroundStyle(.secondary)
                    }.frame(maxWidth: 760, alignment: .leading)
                    if !recentDocuments.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("RECENTLY OPENED").font(.caption.weight(.semibold)).tracking(2)
                            HStack(spacing: 12) {
                                ForEach(recentDocuments, id: \.self) { url in
                                    Button { NSWorkspace.shared.open(url) } label: {
                                        VStack(alignment: .leading, spacing: 5) {
                                            Image(systemName: "doc.text").font(.title2)
                                            Text(url.deletingPathExtension().lastPathComponent).font(.headline).lineLimit(1)
                                            Text(url.deletingLastPathComponent().lastPathComponent).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                                        }.frame(maxWidth: .infinity, alignment: .leading).padding(16).background(.background).overlay(Rectangle().stroke(.separator))
                                    }.buttonStyle(.plain)
                                }
                            }
                        }
                    }
                    VStack(alignment: .leading, spacing: 0) {
                        Text("POPULAR RIGHT NOW").font(.caption.weight(.semibold)).tracking(2).padding(.bottom, 14)
                        Divider().overlay(.primary)
                        ForEach(Array(visible.enumerated()), id: \.element.id) { index, template in
                            HStack(spacing: 24) {
                                Text(String(format: "%02d", index + 1)).font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                                RoundedRectangle(cornerRadius: 2).fill([Color.orange, .blue, .brown, .pink][index % 4].gradient).frame(width: 88, height: 66).overlay(Text(template.title.prefix(1)).font(.largeTitle.bold()).foregroundStyle(.white))
                                VStack(alignment: .leading, spacing: 3) { Text(template.categories.joined(separator: " · ")).font(.caption2).tracking(1).foregroundStyle(.secondary); Text(template.title).font(.title2.weight(.semibold)); Text(template.description).foregroundStyle(.secondary).lineLimit(1) }
                                Spacer()
                                Button { Task { await model.toggleFavorite(template: template) } } label: { Label("\(template.favorites)", systemImage: model.isFavorite(template) ? "star.fill" : "star").labelStyle(.titleAndIcon) }.buttonStyle(.plain).foregroundStyle(model.isFavorite(template) ? .orange : .secondary).help("Favorite")
                                Button("Create ↘") { selected = template }.buttonStyle(.plain).font(.callout.weight(.semibold))
                            }.contentShape(Rectangle()).padding(.vertical, 15)
                            Divider()
                        }
                    }
                }.padding(.horizontal, 64).padding(.vertical, 52).frame(maxWidth: 1120)
            }
        }
        .onChange(of: query) { _, value in model.search(value) }
        .sheet(item: $selected) { template in CreateTemplateView(template: template, model: model) }
    }
}

private struct CreateTemplateView: View {
    let template: RegistryTemplate; let model: RegistryModel; @Environment(\.dismiss) private var dismiss; @State private var isCreating = false; @State private var error: String?
    var body: some View { VStack(alignment: .leading, spacing: 18) { Text(template.title).font(.largeTitle.weight(.semibold)); Text(template.description).foregroundStyle(.secondary); if let error { Text(error).foregroundStyle(.red) }; HStack { Button("Cancel") { dismiss() }; Spacer(); Button(isCreating ? "Creating…" : "Choose Location") { choose() }.buttonStyle(.borderedProminent).disabled(isCreating) } }.padding(28).frame(width: 480) }
    private func choose() { let panel = NSSavePanel(); panel.allowedContentTypes = [.init(filenameExtension: "slop")!]; panel.nameFieldStringValue = "\(template.slug).slop"; guard panel.runModal() == .OK, let url = panel.url else { return }; isCreating = true; Task { do { let downloaded = try await DocumentFactory(catalogURL: model.catalogURL).create(from: template, at: url); if downloaded { await model.recordDownload(template: template) }; await model.recordInstall(template: template); NSDocumentController.shared.noteNewRecentDocumentURL(url); NSWorkspace.shared.open(url); dismiss() } catch { self.error = error.localizedDescription; isCreating = false } } }
}

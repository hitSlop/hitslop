import Foundation
import HitSlopCore
import HitSlopRegistry

private let validCategories = Set(SlopCategory.allCases.map(\.rawValue))
private func normalized(_ values: [String]) -> [String] {
    let mapped = values.map { validCategories.contains($0) ? $0 : SlopCategory.other.rawValue }
    return Array(NSOrderedSet(array: mapped)) as? [String] ?? mapped
}

enum CatalogItemSource { case hosted(RegistryTemplate), local(LocalTemplate) }

struct CatalogItem: Identifiable {
    let source: CatalogItemSource
    var id: String { switch source { case .hosted(let item): "hosted:\(item.id)"; case .local(let item): item.id } }
    var title: String { switch source { case .hosted(let item): item.title; case .local(let item): item.manifest.title } }
    var description: String { switch source { case .hosted(let item): item.description; case .local(let item): item.manifest.description } }
    var categories: [String] { switch source { case .hosted(let item): normalized(item.categories); case .local(let item): item.manifest.categories.map(\.rawValue) } }
    var isLocal: Bool { if case .local = source { true } else { false } }
    var creationCount: Int? { if case .hosted(let item) = source { item.creationCount } else { nil } }
    var publisher: String? { if case .hosted(let item) = source { item.publisherDisplayName } else { nil } }
    var releaseNumber: Int? { if case .hosted(let item) = source { item.currentRelease.number } else { nil } }
    var manifest: SlopManifest? { switch source { case .hosted(let item): item.currentManifest; case .local(let item): item.manifest } }
    var packageBytes: Int64? {
        switch source {
        case .hosted(let item): Int64(item.currentRelease.artifact.bytes)
        case .local(let item): item.packageBytes
        }
    }
    var updatedAt: Date? {
        switch source {
        case .hosted(let item): item.currentRelease.publishedAt
        case .local(let item): item.updatedAt
        }
    }
    var searchableText: String { ([title, description] + categories).joined(separator: " ").localizedLowercase }
}

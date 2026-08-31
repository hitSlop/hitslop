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
    var creations: Int? { if case .hosted(let item) = source { item.creations } else { nil } }
    var searchableText: String { ([title, description] + categories).joined(separator: " ").localizedLowercase }
}

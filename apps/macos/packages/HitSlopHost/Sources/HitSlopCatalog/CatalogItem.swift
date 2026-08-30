import Foundation
import HitSlopCore
import HitSlopRegistry
import HitSlopRuntime

extension RegistryTemplate {
    func remoteTemplate() throws -> SlopRemoteTemplate {
        guard let artifactKey = currentArtifactKey, let sha = currentArtifactSha256 else {
            throw SlopPackageError.invalid("template has no current artifact")
        }
        return SlopRemoteTemplate(publisherKeyID: publisherKeyId, slug: slug, release: currentReleaseNumber, artifactKey: artifactKey, artifactSha256: sha)
    }
}

enum CatalogItemSource {
    case hosted(RegistryTemplate)
    case local(LocalTemplate)
}

struct CatalogItem: Identifiable {
    let source: CatalogItemSource

    var id: String {
        switch source { case .hosted(let item): "hosted:\(item.id)"; case .local(let item): item.id }
    }
    var title: String { switch source { case .hosted(let item): item.title; case .local(let item): item.manifest.title } }
    var description: String { switch source { case .hosted(let item): item.description; case .local(let item): item.manifest.description } }
    var categories: [String] { switch source { case .hosted(let item): item.categories; case .local(let item): item.manifest.categories } }
    var tags: [String] { switch source { case .hosted(let item): item.tags; case .local(let item): item.manifest.tags ?? [] } }
    var author: String? { switch source { case .hosted: nil; case .local(let item): item.manifest.author.name } }
    var isLocal: Bool { if case .local = source { true } else { false } }
    var favorites: Int? { if case .hosted(let item) = source { item.favorites } else { nil } }
    var searchableText: String { ([title, description] + categories + tags + (author.map { [$0] } ?? [])).joined(separator: " ").localizedLowercase }
}

import Combine
@preconcurrency import ConvexMobile
import Foundation
import HitSlopCore

public struct RegistryTemplate: Decodable, Identifiable {
    public let _id: String; public let publisherKeyId: String; public let slug: String; public let title: String; public let description: String; public let categories: [String]
    public let publisherDisplayName: String
    public let currentReleaseId: String?; @ConvexInt public var currentReleaseNumber: Int
    public let currentArtifactKey: String?; public let currentArtifactSha256: String?; public let currentArtifactBytes: Double?
    public let currentPreviewKey: String; public let currentIconKey: String
    public let currentManifestJson: String?; public let currentReleaseCreatedAt: Double?; public let updatedAt: Double
    @ConvexInt public var creations: Int
    public var id: String { _id }
    public var currentManifest: SlopManifest? {
        guard let currentManifestJson, let data = currentManifestJson.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(SlopManifest.self, from: data)
    }

    public func remoteTemplate() -> SlopRemoteTemplate? {
        guard let artifactKey = currentArtifactKey, let sha = currentArtifactSha256 else { return nil }
        return SlopRemoteTemplate(publisherKeyID: publisherKeyId, slug: slug, release: currentReleaseNumber, artifactKey: artifactKey, artifactSha256: sha)
    }
}
extension RegistryTemplate: @unchecked Sendable {}

@MainActor public final class RegistryModel: ObservableObject {
    @Published public private(set) var templates: [RegistryTemplate] = []
    @Published public private(set) var errorMessage: String?
    private let client: ConvexClient; private var subscription: AnyCancellable?
    public let catalogURL: URL

    public init(deploymentURL: String, catalogURL: URL) { client = ConvexClient(deploymentUrl: deploymentURL); self.catalogURL = catalogURL; list() }
    public func search(_ term: String, category: String? = nil) { subscribe(to: "catalog:search", arguments: ["term": term, "category": category, "limit": 36.0]) }
    public func list(category: String? = nil, sort: String = "popular") { subscribe(to: "catalog:list", arguments: ["category": category, "sort": sort, "limit": 36.0]) }
    public func recordCreation(template: RegistryTemplate) async { try? await client.mutation("catalog:recordCreation", with: ["templateId": template._id]) }

    private func subscribe(to query: String, arguments: [String: ConvexEncodable?]) {
        subscription = client.subscribe(to: query, with: arguments, yielding: [RegistryTemplate].self)
            .receive(on: DispatchQueue.main)
            .sink(receiveCompletion: { [weak self] completion in if case .failure(let error) = completion { self?.errorMessage = error.localizedDescription } }, receiveValue: { [weak self] in self?.errorMessage = nil; self?.templates = $0 })
    }
}

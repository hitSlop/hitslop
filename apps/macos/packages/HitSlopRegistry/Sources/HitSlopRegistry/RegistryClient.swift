import Combine
@preconcurrency import ConvexMobile
import Foundation

public struct RegistryTemplate: Decodable, Identifiable {
    public let _id: String; public let publisherKeyId: String; public let slug: String; public let title: String; public let description: String; public let categories: [String]
    public let tags: [String]; public let currentReleaseId: String?
    @ConvexInt public var currentReleaseNumber: Int
    public let currentArtifactKey: String?; public let currentArtifactSha256: String?
    @ConvexInt public var downloads: Int
    @ConvexInt public var installs: Int
    @ConvexInt public var favorites: Int
    public var id: String { _id }
}
extension RegistryTemplate: @unchecked Sendable {}

@MainActor public final class RegistryModel: ObservableObject {
    @Published public private(set) var templates: [RegistryTemplate] = []
    @Published public private(set) var errorMessage: String?
    @Published public private(set) var favoriteTemplateIDs: Set<String>
    private let client: ConvexClient; private var subscription: AnyCancellable?
    public let catalogURL: URL

    public init(deploymentURL: String, catalogURL: URL) {
        client = ConvexClient(deploymentUrl: deploymentURL); self.catalogURL = catalogURL
        favoriteTemplateIDs = Set(UserDefaults.standard.stringArray(forKey: "favoriteTemplateIDs") ?? [])
        subscription = client.subscribe(to: "catalog:popular", with: ["limit": 24], yielding: [RegistryTemplate].self)
            .receive(on: DispatchQueue.main).sink(receiveCompletion: { [weak self] completion in if case .failure(let error) = completion { self?.errorMessage = error.localizedDescription } }, receiveValue: { [weak self] in self?.templates = $0 })
    }

    public func search(_ term: String) {
        subscribe(to: "catalog:search", arguments: ["term": term, "limit": 36])
    }

    public func list(category: String? = nil, sort: String = "popular") {
        subscribe(to: "catalog:list", arguments: ["category": category, "sort": sort, "limit": 36])
    }

    public func recordInstall(template: RegistryTemplate) async {
        guard let releaseID = template.currentReleaseId else { return }
        let installationID = UserDefaults.standard.string(forKey: "installationID") ?? UUID().uuidString
        UserDefaults.standard.set(installationID, forKey: "installationID")
        try? await client.mutation("catalog:recordInstall", with: ["installationId": installationID, "templateId": template._id, "releaseId": releaseID])
    }

    public func recordDownload(template: RegistryTemplate) async {
        guard let releaseID = template.currentReleaseId else { return }
        try? await client.mutation("catalog:recordDownload", with: ["installationId": localInstallationID(), "templateId": template._id, "releaseId": releaseID])
    }

    public func toggleFavorite(template: RegistryTemplate) async -> Bool? {
        let installationID = localInstallationID()
        guard let isFavorite: Bool = try? await client.mutation("catalog:toggleFavorite", with: ["installationId": installationID, "templateId": template._id]) else { return nil }
        if isFavorite { favoriteTemplateIDs.insert(template.id) } else { favoriteTemplateIDs.remove(template.id) }
        UserDefaults.standard.set(Array(favoriteTemplateIDs), forKey: "favoriteTemplateIDs")
        return isFavorite
    }

    public func isFavorite(_ template: RegistryTemplate) -> Bool { favoriteTemplateIDs.contains(template.id) }

    private func subscribe(to query: String, arguments: [String: ConvexEncodable?]) {
        subscription = client.subscribe(to: query, with: arguments, yielding: [RegistryTemplate].self)
            .receive(on: DispatchQueue.main)
            .sink(receiveCompletion: { [weak self] completion in if case .failure(let error) = completion { self?.errorMessage = error.localizedDescription } }, receiveValue: { [weak self] in self?.templates = $0 })
    }

    private func localInstallationID() -> String {
        if let existing = UserDefaults.standard.string(forKey: "installationID") { return existing }
        let value = UUID().uuidString; UserDefaults.standard.set(value, forKey: "installationID"); return value
    }
}

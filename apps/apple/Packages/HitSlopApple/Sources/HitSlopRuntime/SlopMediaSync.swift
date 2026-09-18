import Foundation
import HitSlopCore
import HitSlopDocumentEngine

public enum SlopMediaSync {
  public static func hashes(in json: String, using engine: StateEngine) async throws -> Set<String>
  {
    Set(try await engine.callAsync("media", [json], as: [String].self))
  }

  public static func localHashes(in package: SlopPackage) -> Set<String> {
    let directory = package.mediaStoresURL
    guard
      let urls = try? FileManager.default.contentsOfDirectory(
        at: directory, includingPropertiesForKeys: nil)
    else { return [] }
    return Set(urls.map(\.lastPathComponent).filter { SlopMediaStore.isValidHash($0) })
  }

  @discardableResult public static func uploadMissing(
    package: SlopPackage, api: SlopCloudAPI, needed: Set<String>, excluding: Set<String> = []
  ) async throws -> Set<String> {
    var uploaded = Set<String>()
    let store = SlopMediaStore(directoryURL: package.mediaStoresURL, rootURL: package.rootURL)
    for name in needed.subtracting(excluding) {
      let data: Data
      if FileManager.default.fileExists(atPath: try store.url(for: name).path) {
        data = try store.read(name)
        let hash = try await api.putMedia(data, mime: SlopMediaStore.mediaMIMEType(data))
        guard hash == name else { throw SlopDocumentError("Uploaded media hash mismatch") }
      } else {
        data = try await api.media(name)
        guard SlopCommandDocument.digest(data) == name else {
          throw SlopDocumentError("Downloaded media hash mismatch")
        }
        try store.add(data)
      }
      uploaded.insert(name)
    }
    return uploaded
  }

  public static func downloadMissing(package: SlopPackage, needed: Set<String>, api: SlopCloudAPI)
    async throws
  {
    let store = SlopMediaStore(directoryURL: package.mediaStoresURL, rootURL: package.rootURL)
    for hash in needed {
      let url = try store.url(for: hash)
      if FileManager.default.fileExists(atPath: url.path) {
        _ = try store.read(hash)
        continue
      }
      let data = try await api.media(hash)
      try Task.checkCancellation()
      guard SlopCommandDocument.digest(data) == hash else {
        throw SlopDocumentError("Downloaded media hash mismatch")
      }
      try store.add(data)
    }
  }

}

/// One sharing connection remembers blobs already acknowledged by R2.
public struct SlopDocumentMediaTransport: Sendable {
  public let prepare: @Sendable (Set<String>) async throws -> Void
  public let load: @Sendable (String) async throws -> Void
  public init(
    prepare: @escaping @Sendable (Set<String>) async throws -> Void,
    load: @escaping @Sendable (String) async throws -> Void
  ) {
    self.prepare = prepare
    self.load = load
  }
}
public actor SlopMediaTransfer {
  private let package: SlopPackage
  private let api: SlopCloudAPI
  private var uploaded = Set<String>()
  private var downloads: [String: Task<Void, any Error>] = [:]
  public init(package: SlopPackage, api: SlopCloudAPI) {
    self.package = package
    self.api = api
  }
  public nonisolated var transport: SlopDocumentMediaTransport {
    .init(prepare: { try await self.prepare($0) }, load: { try await self.load($0) })
  }
  public func load(_ hash: String) async throws {
    if let task = downloads[hash] {
      try await task.value
      return
    }
    let task = Task {
      try await SlopMediaSync.downloadMissing(package: package, needed: [hash], api: api)
    }
    downloads[hash] = task
    defer { downloads.removeValue(forKey: hash) }
    try await task.value
  }
  public func prepare(_ hashes: Set<String>) async throws {
    uploaded.formUnion(
      try await SlopMediaSync.uploadMissing(
        package: package, api: api, needed: hashes, excluding: uploaded))
  }
}

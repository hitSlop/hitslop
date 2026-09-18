import Foundation
import HTTPTypes
import HitSlopAPI
import HitSlopCore
import HitSlopDocumentEngine
import OpenAPIRuntime
import OpenAPIURLSession

public typealias SlopCatalogTemplate = Components.Schemas.CatalogTemplate
public typealias SlopSharedDocument = Components.Schemas.SharedDocument
public struct SlopRoomSeed: Sendable {
  public let json: String
  public init(json: String) { self.json = json }
}
public typealias SlopRoomSessionToken = Components.Schemas.RoomSession
public typealias SlopCloudError = APIHTTPError

extension SlopCatalogTemplate {
  public var searchText: String {
    ([title, description, author.name] + categories.map(\.rawValue)).joined(separator: " ")
      .localizedLowercase
  }

  public func remoteTemplate() throws -> SlopRemoteTemplate {
    let key = URLComponents(string: download.url)?.queryItems?.first { $0.name == "key" }?.value
    let suffix = "_\(slug)"
    let publisher = id.hasSuffix(suffix) ? String(id.dropLast(suffix.count)) : ""
    guard let key, key == "artifacts/sha256/\(download.sha256).slop.zip",
      publisher.range(of: "^[a-zA-Z0-9_-]{16,64}$", options: .regularExpression) != nil
    else {
      throw SlopPackageError.invalid("Invalid catalog artifact identity.")
    }
    return SlopRemoteTemplate(
      publisherKeyID: publisher, slug: slug, release: release.number,
      artifactKey: key, artifactSha256: download.sha256)
  }
}

extension SlopSharedDocument {
  public var inviteURL: URL? {
    invite.flatMap { URL(string: "hitslop://join/\(documentId)#\($0)") }
  }
}
extension SlopRoomSeed {
  public func validatedTransfer(documentId: String, schema: String) throws -> StateSnapshot {
    return try StateEngine.utility(.seed, [json, documentId, schema])
  }
}

public struct SlopCloudAPI: Sendable {
  public let origin: URL
  private let transport: any ClientTransport
  public var authorization: @Sendable () async throws -> String?
  public init(
    origin: URL, transport: any ClientTransport = URLSessionTransport(),
    authorization: @escaping @Sendable () async throws -> String? = { nil }
  ) {
    self.origin = origin
    self.transport = transport
    self.authorization = authorization
  }
  private func client(token: String? = nil, mime: String? = nil) -> Client {
    let provider: @Sendable () async throws -> String? = { [authorization] in
      if let token { return token }
      return try await authorization()
    }
    return Client(
      serverURL: origin, configuration: .init(dateTranscoder: APIDateTranscoder()),
      transport: transport,
      middlewares: [
        APIAuthorization(token: provider), HTTPMiddleware(contentType: mime),
      ])
  }
  private func call<T>(_ action: () async throws -> T) async throws -> T {
    do { return try await action() } catch let error as ClientError { throw error.underlyingError }
  }
  public func catalog() async throws -> [SlopCatalogTemplate] {
    var cursor: String?
    var cursors = Set<String>()
    var templates: [String: SlopCatalogTemplate] = [:]
    repeat {
      try Task.checkCancellation()
      let page = try await call {
        try await client().listCatalog(query: .init(cursor: cursor, limit: "200")).ok.body.json
      }
      for template in page.templates { templates[template.id] = template }
      cursor = page.nextCursor
      if let cursor, !cursors.insert(cursor).inserted {
        throw SlopPackageError.invalid("Catalog repeated a pagination cursor.")
      }
    } while cursor != nil
    return templates.values.sorted { $0.id < $1.id }
  }
  public func recordCreation(templateId: String) async throws {
    _ = try await call {
      try await client().recordCreation(body: .json(.init(templateId: templateId))).ok
    }
  }
  public func putMedia(_ data: Data, mime: String) async throws -> String {
    try await call {
      try await client(mime: mime).putMedia(body: .any(HTTPBody(data))).created.body.json.sha256
    }
  }
  public func artifact(_ key: String) async throws -> Data {
    try await call {
      try await Data(
        collecting: client().getArtifact(query: .init(key: key)).ok.body.any, upTo: 25 * 1024 * 1024
      )
    }
  }
  public func media(_ sha256: String) async throws -> Data {
    try await call {
      try await Data(
        collecting: client().getMedia(path: .init(sha256: sha256)).ok.body.any,
        upTo: 25 * 1024 * 1024)
    }
  }
  public func createDocument(
    id: String, title: String, slug: String, schema: String, package: Data, seed: StateSnapshot
  ) async throws -> SlopSharedDocument {
    try await call {
      try await client().createDocument(
        body: .multipartForm(
          .init([
            .documentId(.init(payload: .init(body: HTTPBody(id)))),
            .title(.init(payload: .init(body: HTTPBody(title)))),
            .slug(.init(payload: .init(body: HTTPBody(slug)))),
            .schema(.init(payload: .init(body: HTTPBody(schema)))),
            .seed(.init(payload: .init(body: HTTPBody(Data(seed.json.utf8))))),
            .package(.init(payload: .init(body: HTTPBody(package)), filename: "\(slug).slop.zip")),
          ]))
      ).ok.body.json
    }
  }
  public func updateInvitation(documentId: String, enabled: Bool) async throws -> SlopSharedDocument
  {
    try await call {
      try await client().updateInvitation(
        path: .init(documentId: documentId), body: .json(.init(enabled: enabled))
      ).ok.body.json
    }
  }
  public func removeMember(documentId: String, memberId: String) async throws -> SlopSharedDocument
  {
    try await call {
      try await client().removeDocumentMember(
        path: .init(documentId: documentId, memberId: memberId)
      ).ok.body.json
    }
  }

  public func joinDocument(id: String, invite: String) async throws -> SlopSharedDocument {
    try await call {
      try await client().joinDocument(
        path: .init(documentId: id), body: .json(.init(invite: invite))
      ).ok.body.json
    }
  }
  public func document(_ id: String) async throws -> SlopSharedDocument {
    try await call { try await client().getDocument(path: .init(documentId: id)).ok.body.json }
  }
  public func documentPackage(_ id: String) async throws -> Data {
    try await call {
      try await Data(
        collecting: client().getDocumentPackage(path: .init(documentId: id)).ok.body.any,
        upTo: 25 * 1024 * 1024)
    }
  }
  public func session(documentId: String) async throws -> SlopRoomSessionToken {
    try await call {
      try await client().createRoomSession(path: .init(documentId: documentId)).ok.body.json
    }
  }
  public func seed(documentId: String, token: String) async throws -> SlopRoomSeed {
    // Keep arbitrary document JSON out of generated Codable value containers.
    guard !documentId.isEmpty, documentId.utf8.count <= 80,
      documentId.utf8.allSatisfy({
        (48...57).contains($0) || (65...90).contains($0) || (97...122).contains($0) || $0 == 45
      })
    else {
      throw SlopDocumentError("Invalid document ID")
    }
    var request = HTTPRequest(
      method: .get, scheme: nil, authority: nil, path: "/rooms/\(documentId)/seed")
    request.headerFields[.authorization] = "Bearer \(token)"
    let (_, body) = try await HTTPMiddleware().intercept(
      request, body: nil, baseURL: origin, operationID: "getRoomSeed"
    ) { request, body, base in
      try await transport.send(request, body: body, baseURL: base, operationID: "getRoomSeed")
    }
    guard let body else { throw SlopDocumentError("Missing room seed") }
    let data = try await Data(collecting: body, upTo: 2 * 1024 * 1024)
    guard let json = String(data: data, encoding: .utf8) else {
      throw SlopDocumentError("Room seed must be UTF-8")
    }
    return SlopRoomSeed(json: json)
  }
  public func socketURL(documentId: String) -> URL {
    var components = URLComponents(
      url: origin.appendingPathComponent("rooms/\(documentId)/socket"),
      resolvingAgainstBaseURL: false)!
    components.scheme = origin.scheme == "http" ? "ws" : "wss"
    return components.url!
  }
}

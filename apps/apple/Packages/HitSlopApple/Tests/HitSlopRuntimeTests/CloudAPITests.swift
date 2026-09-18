import Foundation
import HTTPTypes
import HitSlopAPI
import HitSlopRuntime
import OpenAPIRuntime
import Testing

private actor RecordingTransport: ClientTransport {
  struct Sent: Sendable {
    let request: HTTPRequest
    let body: Data
  }
  var sent: [Sent] = []
  func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws
    -> (HTTPResponse, HTTPBody?)
  {
    let bytes: Data
    if let body {
      bytes = try await Data(collecting: body, upTo: 1024 * 1024)
    } else {
      bytes = Data()
    }
    sent.append(.init(request: request, body: bytes))
    let payload: String
    let status: HTTPResponse.Status
    switch operationID {
    case "createDocument":
      status = .ok
      payload = """
        {"documentId":"test-room","title":"Test","slug":"test","schema":"\(String(repeating: "a", count: 64))","owner":"owner","packageSha256":"\(String(repeating: "b", count: 64))","packageBytes":3,"members":[{"id":"owner","name":"Owner","email":""}],"invite":null,"invitationsEnabled":false}
        """
    case "putMedia":
      status = .created
      payload = """
        {"sha256":"\(String(repeating: "a", count: 64))","bytes":3,"mime":"image/png"}
        """
    default:
      status = .notFound
      payload = #"{"code":"NOT_FOUND","message":"Room not found"}"#
    }
    return (
      HTTPResponse(status: status, headerFields: [.contentType: "application/json"]),
      HTTPBody(payload)
    )
  }
}

@Suite struct CloudAPITests {
  private struct SeedTransport: ClientTransport {
    let bytes: Data
    func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String)
      async throws -> (HTTPResponse, HTTPBody?)
    {
      (.init(status: .ok, headerFields: [.contentType: "application/json"]), HTTPBody(bytes))
    }
  }
  @Test func seedKeepsArbitraryJSONOutOfNativeValueTrees() async throws {
    let hash = String(repeating: "a", count: 64)
    let data = #"{"é":"composed","é":"decomposed","unknown":"\ud800","record":{"\ud800":"\udfff"}}"#
    let raw =
      "{\"protocol\":3,\"snapshot\":{\"documentId\":\"test-room\",\"schemaHash\":\"\(hash)\",\"authority\":\"epoch\",\"revision\":0,\"data\":\(data)}}"
    let api = SlopCloudAPI(
      origin: URL(string: "https://example.com")!, transport: SeedTransport(bytes: Data(raw.utf8)),
      authorization: { "token" })
    let seed = try await api.seed(documentId: "test-room", token: "room-token")
    let snapshot = try seed.validatedTransfer(documentId: "test-room", schema: hash)
    #expect(snapshot.data.utf8.elementsEqual(data.utf8))
    await #expect(throws: (any Error).self) {
      try await api.seed(documentId: "test-room\n", token: "room-token")
    }
    let invalid = SlopCloudAPI(
      origin: URL(string: "https://example.com")!, transport: SeedTransport(bytes: Data([0xff])),
      authorization: { "token" })
    await #expect(throws: (any Error).self) {
      try await invalid.seed(documentId: "test-room", token: "room-token")
    }
  }
  @Test func generatedMultipartAndBinaryRequestsPreserveCredentialsAndBytes() async throws {
    let transport = RecordingTransport()
    let api = SlopCloudAPI(
      origin: URL(string: "https://example.com")!, transport: transport,
      authorization: { "firebase-token" })
    let document = try await api.createDocument(
      id: "test-room", title: "Test", slug: "test", schema: String(repeating: "a", count: 64),
      package: Data("zip".utf8),
      seed: FixtureJSON.object([
        "documentId": .string("test-room"),
        "schemaHash": .string(String(repeating: "a", count: 64)), "authority": .string("epoch"),
        "revision": .number(0), "data": .object([:]),
      ]))
    #expect(document.invite == nil)
    #expect(document.members.first?.id == "owner")
    _ = try await api.putMedia(Data([1, 2, 3]), mime: "image/png")
    let requests = await transport.sent
    #expect(requests[0].request.path == "/api/documents")
    #expect(requests[0].request.headerFields[.authorization] == "Bearer firebase-token")
    #expect(
      requests[0].request.headerFields[.contentType]?.hasPrefix("multipart/form-data; boundary=")
        == true)
    let form = String(decoding: requests[0].body, as: UTF8.self)
    #expect(form.contains("name=\"documentId\""))
    #expect(form.contains("test-room"))
    #expect(form.contains("filename=\"test.slop.zip\""))
    #expect(form.contains("zip"))
    #expect(requests[1].request.headerFields[.contentType] == "image/png")
    #expect(requests[1].body == Data([1, 2, 3]))
  }
  @Test func roomCredentialsAndHTTPStatusSurviveTheGeneratedClient() async throws {
    let transport = RecordingTransport()
    let api = SlopCloudAPI(
      origin: URL(string: "https://example.com")!, transport: transport,
      authorization: { "firebase-token" })
    do {
      _ = try await api.seed(documentId: "test-room", token: "room-token")
      Issue.record("Expected a missing room")
    } catch let error as SlopCloudError {
      #expect(error.status == 404)
      #expect(error.message == "Room not found")
    }
    let sent = await transport.sent
    #expect(sent.first?.request.headerFields[.authorization] == "Bearer room-token")
    #expect(sent.first?.request.path == "/rooms/test-room/seed")
  }
}

private actor CatalogTransport: ClientTransport {
  let repeatingCursor: Bool
  var paths: [String] = []
  var creationBody: Data?
  init(repeatingCursor: Bool = false) { self.repeatingCursor = repeatingCursor }
  func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws
    -> (HTTPResponse, HTTPBody?)
  {
    paths.append(request.path ?? "")
    if operationID == "recordCreation" {
      if let body { creationBody = try await Data(collecting: body, upTo: 1024) }
      return (
        .init(status: .ok, headerFields: [.contentType: "application/json"]),
        HTTPBody(#"{"ok":true}"#)
      )
    }
    let secondPage = request.path?.contains("cursor=") == true
    let hash = String(repeating: "a", count: 64)
    let asset: [String: Any] = [
      "url": "https://example.com/api/artifact?key=artifacts/sha256/\(hash).slop.zip",
      "sha256": hash, "bytes": 1,
    ]
    let entry: [String: Any] = [
      "id": secondPage ? "publisher-key-id1_second" : "publisher-key-id1_first",
      "slug": secondPage ? "second" : "first", "title": "Test", "description": "Test entry",
      "categories": ["utilities"], "author": ["name": "Tests"], "creationCount": 0,
      "release": [
        "number": 1,
        "publishedAt": secondPage ? "2026-01-01T00:00:00Z" : "2026-01-01T00:00:00.000Z",
      ],
      "preview": asset, "icon": asset, "download": asset,
    ]
    let page: [String: Any] = [
      "version": 1, "templates": [entry],
      "nextCursor": secondPage && !repeatingCursor ? NSNull() : "next",
    ]
    return (
      .init(status: .ok, headerFields: [.contentType: "application/json"]),
      HTTPBody(try JSONSerialization.data(withJSONObject: page))
    )
  }
}

@Suite struct CatalogAPITests {
  @Test func loadsEveryPageAndRecordsCreationThroughGeneratedClient() async throws {
    let transport = CatalogTransport()
    let api = SlopCloudAPI(origin: URL(string: "https://example.com")!, transport: transport)
    let templates = try await api.catalog()
    #expect(templates.map(\.slug) == ["first", "second"])
    try await api.recordCreation(templateId: templates[0].id)
    let paths = await transport.paths
    #expect(paths.count == 3)
    #expect(paths[0].contains("/api/catalog?"))
    #expect(paths[0].contains("limit=200"))
    #expect(paths[1].contains("cursor=next"))
    #expect(paths[2] == "/api/catalog/created")
    let body = try #require(await transport.creationBody)
    let value = try JSONSerialization.jsonObject(with: body) as? [String: String]
    #expect(value?["templateId"] == templates[0].id)
  }

  @Test func rejectsPaginationLoopsInsteadOfReturningPartialCatalog() async throws {
    let api = SlopCloudAPI(
      origin: URL(string: "https://example.com")!,
      transport: CatalogTransport(repeatingCursor: true))
    await #expect(throws: (any Error).self) { try await api.catalog() }
  }
}

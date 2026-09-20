import Darwin
import Foundation
import HitSlopCore
import SQLite3
import Testing

@testable import HitSlopRuntime

private func securityRoot() throws -> URL {
  let root = FileManager.default.temporaryDirectory.appendingPathComponent(
    "security-\(UUID()).slop")
  try FileManager.default.createDirectory(
    at: root.appendingPathComponent("state"), withIntermediateDirectories: true)
  return root
}
private func alterDatabase(_ root: URL, _ sql: String) throws {
  var db: OpaquePointer?
  #expect(sqlite3_open(root.appendingPathComponent("state/document.sqlite").path, &db) == SQLITE_OK)
  defer { sqlite3_close(db) }
  #expect(sqlite3_exec(db, sql, nil, nil, nil) == SQLITE_OK)
}
@Test func hostileSQLiteSchemaIsRejectedWithoutChangingTheFile() throws {
  for sql in ["CREATE VIEW document AS SELECT 1 AS id", "CREATE TABLE document(id INTEGER)"] {
    let root = try securityRoot()
    defer { try? FileManager.default.removeItem(at: root) }
    try alterDatabase(root, sql)
    let url = root.appendingPathComponent("state/document.sqlite")
    let before = try Data(contentsOf: url)
    #expect(throws: SlopDocumentError.self) { _ = try SlopCommandStorage(root: root) }
    #expect(try Data(contentsOf: url) == before)
  }
  let root = try securityRoot()
  defer { try? FileManager.default.removeItem(at: root) }
  do { _ = try SlopCommandStorage(root: root) }
  try alterDatabase(
    root, "CREATE TRIGGER malicious AFTER INSERT ON receipts BEGIN DELETE FROM document; END")
  let url = root.appendingPathComponent("state/document.sqlite")
  let before = try Data(contentsOf: url)
  #expect(throws: SlopDocumentError.self) { _ = try SlopCommandStorage(root: root) }
  #expect(try Data(contentsOf: url) == before)
}
@Test func databaseReadsRejectWrongColumnTypes() throws {
  let root = try securityRoot()
  defer { try? FileManager.default.removeItem(at: root) }
  let storage = try SlopCommandStorage(root: root)
  try storage.execute(
    "INSERT INTO document(id,snapshot,metadata) VALUES(1,'not a blob','not a blob')")
  #expect(throws: SlopDocumentError.self) { _ = try storage.load() }
}
@Test func exactGuestOriginAndDocumentNavigation() throws {
  for path in ["slop://app/", "slop://app/#section", "slop://app/index.html#section"] {
    #expect(SlopRuntimeSecurity.isDocument(try #require(URL(string: path))))
  }
  for path in [
    "slop://other/", "slop://app:80/", "slop://user@app/", "slop://app/assets/code.js",
    "slop://app/?x=1", "about:blank", "file:///tmp/a", "https://example.com/",
  ] {
    #expect(!SlopRuntimeSecurity.isDocument(try #require(URL(string: path))))
  }
}
@Test func revokedLeaseAndPublicErrors() throws {
  let lease = SlopRequestLease()
  try lease.check()
  lease.invalidate()
  #expect(throws: SlopBridgeFailure.self) { try lease.check() }
  let error = SlopRuntimeSecurity.publicFailure(
    SlopDocumentError("/private/sensitive/document.sqlite: bad SQL"))
  #expect(!error.message.contains("/Users"))
  #expect(!error.message.contains("SQL"))
  #expect(SlopRuntimeSecurity.publicFailure(SlopLimitError("Too large")).code == .limitExceeded)
  let depth = SlopRuntimeSecurity.publicFailure(
    SlopDocumentError(limit: SlopLimitError("JSON exceeds 64 nesting levels")))
  #expect(depth.code == .validationFailed)
  #expect(depth.message == "JSON exceeds 64 nesting levels")
}

@Test func navigationRoutesOnlyTrustedHTTPLinksOutsideTheWebView() throws {
  let web = try #require(URL(string: "https://skins.webamp.org/"))
  for main in [true, false] {  // false includes target=_blank's missing target frame.
    #expect(
      SlopRuntimeSecurity.navigation(
        web, targetIsMainFrame: main, isLink: true, trustedSource: true, isDownload: false,
        purpose: .interactive) == .openExternal)
  }
  for (link, trusted, download, purpose) in [
    (false, true, false, SlopRuntimePurpose.interactive),
    (true, false, false, .interactive),
    (true, true, true, .interactive),
    (true, true, false, .backgroundRender),
  ] {
    #expect(
      SlopRuntimeSecurity.navigation(
        web, targetIsMainFrame: false, isLink: link, trustedSource: trusted, isDownload: download,
        purpose: purpose) == .cancel)
  }
  for value in [
    "file:///tmp/private", "hitslop://join/test", "mailto:test@example.com", "javascript:alert(1)",
    "slop://other/", "about:blank",
  ] {
    #expect(
      SlopRuntimeSecurity.navigation(
        try #require(URL(string: value)), targetIsMainFrame: true, isLink: true,
        trustedSource: true, isDownload: false, purpose: .interactive) == .cancel)
  }
  let fragment = try #require(URL(string: "slop://app/#section"))
  #expect(
    SlopRuntimeSecurity.navigation(
      fragment, targetIsMainFrame: true, isLink: true, trustedSource: true, isDownload: false,
      purpose: .interactive) == .allow)
  #expect(
    SlopRuntimeSecurity.navigation(
      fragment, targetIsMainFrame: true, isLink: true, trustedSource: true, isDownload: true,
      purpose: .interactive) == .cancel)
  #expect(
    SlopRuntimeSecurity.navigation(
      fragment, targetIsMainFrame: false, isLink: false, trustedSource: true, isDownload: false,
      purpose: .interactive) == .cancel)
}

@Test func sharingBootstrapRejectsUnsafeCachedFilesWithoutReplacingThem() async throws {
  for kind in ["symlink", "dangling", "fifo", "oversized"] {
    let root = try securityRoot()
    defer { try? FileManager.default.removeItem(at: root) }
    let schema = try FixtureJSON(
      data: Data(
        #"{"type":"object","x-hitslop":{"version":1,"container":"map"},"properties":{}}"#.utf8))
    let document = try SlopCommandDocument(root: root, schema: schema, initial: .object([:]))
    let url = root.appendingPathComponent("state/share-bootstrap.zip")
    switch kind {
    case "symlink":
      let target = root.appendingPathComponent("outside.zip")
      try Data("original".utf8).write(to: target)
      try FileManager.default.createSymbolicLink(at: url, withDestinationURL: target)
    case "dangling":
      try FileManager.default.createSymbolicLink(
        at: url, withDestinationURL: root.appendingPathComponent("missing.zip"))
    case "fifo": #expect(mkfifo(url.path, 0o600) == 0)
    default: try Data(repeating: 1, count: SlopFile.maximumBytes + 1).write(to: url)
    }
    let before = try FileManager.default.attributesOfItem(atPath: url.path)
    await #expect(throws: SlopPackageError.self) {
      _ = try await document.sharingBundle(Data("replacement".utf8))
    }
    let after = try FileManager.default.attributesOfItem(atPath: url.path)
    #expect(before[.type] as? FileAttributeType == after[.type] as? FileAttributeType)
    #expect(before[.size] as? NSNumber == after[.size] as? NSNumber)
    if kind == "symlink" {
      #expect(
        try Data(contentsOf: root.appendingPathComponent("outside.zip")) == Data("original".utf8))
    }
    try await document.close()
  }
}

@Test func rejectedCommandIsDurablyCachedAndNewRequestCanRecover() async throws {
  let root = try securityRoot()
  defer { try? FileManager.default.removeItem(at: root) }
  let schema = try FixtureJSON(
    data: Data(
      #"{"type":"object","x-hitslop":{"version":1,"container":"map"},"properties":{"left":{"type":"string"},"right":{"type":"string"}},"required":["left","right"]}"#
        .utf8))
  let document = try SlopCommandDocument(
    root: root, schema: schema, initial: .object(["left": .string(""), "right": .string("")]))
  let open = try await document.fixtureOpening()
  #expect(
    try await document.apply(
      testRequest(open, ops: [testSet("left", .string(String(repeating: "x", count: 600_000)))]))[
        "ok"] == .bool(true))
  let request = testRequest(
    open, ops: [testSet("right", .string(String(repeating: "y", count: 600_000)))])
  let rejection = try await document.apply(request)
  #expect(rejection["ok"] == .bool(false))
  #expect(
    try await document.apply(testRequest(open, ops: [testSet("left", .string(""))]))["ok"]
      == .bool(true))
  #expect(try await document.apply(request) == rejection)
  #expect(
    try await document.apply(testRequest(open, ops: [testSet("right", .string("recovered"))]))["ok"]
      == .bool(true))
  try await document.close()
}

@Test func actorRejectsRevokedBridgeRequestBeforeExecuting() async throws {
  let root = try securityRoot()
  defer { try? FileManager.default.removeItem(at: root) }
  let schema = try FixtureJSON(
    data: Data(
      #"{"type":"object","x-hitslop":{"version":1,"container":"map"},"properties":{"value":{"type":"integer"}},"required":["value"]}"#
        .utf8))
  let document = try SlopCommandDocument(
    root: root, schema: schema, initial: .object(["value": .number(0)]))
  let request = testRequest(
    try await document.fixtureOpening(), ops: [testSet("value", .number(99))])
  let lease = SlopRequestLease()
  lease.invalidate()
  await #expect(throws: SlopBridgeFailure.self) {
    _ = try await document.guestRequest(.documentExecute, requestJSON: request.json, lease: lease)
  }
  #expect(try await document.frame().data["value"] == .number(0))
  try await document.close()
}

@Test func oversizedExternalDocumentPreservesItsBytesAndCommittedState() async throws {
  let root = try securityRoot()
  defer { try? FileManager.default.removeItem(at: root) }
  let schema = try FixtureJSON(
    data: Data(
      #"{"type":"object","x-hitslop":{"version":1,"container":"map"},"properties":{"text":{"type":"string"}},"required":["text"]}"#
        .utf8))
  let initial = FixtureJSON.object(["text": .string("original")])
  let document = try SlopCommandDocument(root: root, schema: schema, initial: initial)
  try await document.flush()
  let url = root.appendingPathComponent("stores/data.json")
  let original = try Data(contentsOf: url)
  var value = try #require(JSONSerialization.jsonObject(with: original) as? [String: Any])
  value["data"] = ["text": String(repeating: "x", count: 1024 * 1024)]
  let hostile = try JSONSerialization.data(withJSONObject: value)
  try hostile.write(to: url, options: .atomic)
  try await document.flush()
  #expect(try await document.frame().fixtureData == initial)
  #expect(try await document.frame().projectionError != nil)
  #expect(try Data(contentsOf: url) == hostile)
  try original.write(to: url, options: .atomic)
  try await document.close()
}

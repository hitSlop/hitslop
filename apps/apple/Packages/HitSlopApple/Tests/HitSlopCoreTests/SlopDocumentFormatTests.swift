import Foundation
import HitSlopDocumentEngine
import Testing

@testable import HitSlopCore

private let envelope =
  #"{"type":"object","additionalProperties":false,"required":["$slop","data"],"properties":{"$slop":{"type":"object","additionalProperties":false,"required":["format","documentId","schemaHash","authority","baseRevision"],"properties":{"format":{"const":2},"documentId":{"type":"string","minLength":1},"schemaHash":{"type":"string","minLength":1},"authority":{"type":"string","minLength":1},"baseRevision":{"type":"integer","minimum":0,"maximum":9007199254740991}}},"data":{"type":"object","x-hitslop":{"version":1,"container":"map"},"properties":{"title":{"type":"string"}},"additionalProperties":true,"description":"Document annotations"}}}"#

@Test func documentFormatPreservesAnnotationsAndDeterministicOutput() throws {
  let bytes = Data(envelope.utf8)
  let extracted = try extractSchema(bytes)
  let original = try JSONSerialization.jsonObject(with: bytes) as! [String: Any]
  let expected = (original["properties"] as! [String: Any])["data"] as! NSDictionary
  let result = try JSONSerialization.jsonObject(with: extracted) as! NSDictionary
  #expect(result == expected)
  let repeated = try extractSchema(bytes)
  #expect(extracted == repeated)
}

@Test(arguments: [
  (#""description":"Document annotations""#, #""x-custom":true"#, "properties.data.x-custom"),
  (#""const":2"#, #""const":true"#, "properties.$slop.properties.format.const"),
  (#""const":2"#, #""const":1"#, "properties.$slop.properties.format.const"),
  (#""minimum":0"#, #""minimum":1"#, "properties.$slop.properties.baseRevision.minimum"),
  (#""version":1"#, #""version":"1""#, "properties.data.x-hitslop.version"),
  (#""container":"map""#, #""container":"atomic""#, "properties.data.x-hitslop.container"),
  (#""additionalProperties":false"#, #""additionalProperties":0"#, "additionalProperties"),
  (#"["$slop","data"]"#, #"["$slop","data","data"]"#, "required"),
  (
    #"["format","documentId","schemaHash","authority","baseRevision"]"#, #"["format","format"]"#,
    "properties.$slop.required"
  ),
  (
    #""format":{"const":2}"#, #""extra":{},"format":{"const":2}"#,
    "properties.$slop.properties.extra"
  ),
  (#""properties":{"$slop""#, #""properties":{"extra":{},"$slop""#, "properties.extra"),
  (
    #""minimum":0"#, #""description":"missing minimum""#,
    "properties.$slop.properties.baseRevision.minimum"
  ),
])
func documentFormatRejectsInvalidEnvelopeWithFieldDiagnostics(
  before: String, after: String, path: String
) throws {
  let bytes = Data(envelope.replacingOccurrences(of: before, with: after).utf8)
  do {
    _ = try extractSchema(bytes)
    Issue.record("Invalid envelope was accepted")
  } catch {
    #expect(!error.localizedDescription.isEmpty)
  }
}

@Test(arguments: ["null", "[]", "true", "{}", "{broken"])
func documentFormatRejectsNonEnvelopes(source: String) {
  #expect(throws: (any Error).self) {
    _ = try extractSchema(Data(source.utf8))
  }
}

private func extractSchema(_ bytes: Data) throws -> Data {
  let engine = try StateEngine()
  defer { engine.close() }
  return Data(
    try engine.call("applicationSchema", [String(decoding: bytes, as: UTF8.self)], as: String.self)
      .utf8)
}

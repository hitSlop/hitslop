import DynamicJSON
import Foundation
import Testing
@testable import HitSlopCore

private let envelope = #"{"type":"object","additionalProperties":false,"required":["$slop","data"],"properties":{"$slop":{"type":"object","additionalProperties":false,"required":["format","documentId","schemaHash","authority","baseRevision"],"properties":{"format":{"const":2},"documentId":{"type":"string","minLength":1},"schemaHash":{"type":"string","minLength":1},"authority":{"type":"string","minLength":1},"baseRevision":{"type":"integer","minimum":0,"maximum":9007199254740991}}},"data":{"type":"object","x-hitslop":{"version":1,"container":"map"},"properties":{"title":{"type":"string"}},"additionalProperties":true,"x-custom":{"null":null,"enabled":true,"values":[1,2.5,"text"],"largeInteger":9007199254740993}}}}"#

@Test func documentFormatPreservesApplicationKeywordsAndDeterministicOutput() throws {
    let bytes = Data(envelope.utf8)
    let extracted = try SlopDocumentFormat.applicationSchema(bytes)
    let original = try JSONDecoder().decode(JSON.self, from: bytes)
    let result = try JSONDecoder().decode(JSON.self, from: extracted)
    #expect(result == original["properties"]?["data"])
    let repeated = try SlopDocumentFormat.applicationSchema(bytes)
    #expect(extracted == repeated)
}

@Test(arguments: [
    (#""const":2"#, #""const":true"#, "properties.$slop.properties.format.const"),
    (#""const":2"#, #""const":1"#, "properties.$slop.properties.format.const"),
    (#""minimum":0"#, #""minimum":1"#, "properties.$slop.properties.baseRevision.minimum"),
    (#""version":1"#, #""version":"1""#, "properties.data.x-hitslop.version"),
    (#""container":"map""#, #""container":"atomic""#, "properties.data.x-hitslop.container"),
    (#""additionalProperties":false"#, #""additionalProperties":0"#, "additionalProperties"),
    (#"["$slop","data"]"#, #"["$slop","data","data"]"#, "required"),
    (#"["format","documentId","schemaHash","authority","baseRevision"]"#, #"["format","format"]"#, "properties.$slop.required"),
    (#""format":{"const":2}"#, #""extra":{},"format":{"const":2}"#, "properties.$slop.properties.extra"),
    (#""properties":{"$slop""#, #""properties":{"extra":{},"$slop""#, "properties.extra"),
    (#""minimum":0"#, #""description":"missing minimum""#, "properties.$slop.properties.baseRevision.minimum"),
])
func documentFormatRejectsInvalidEnvelopeWithFieldDiagnostics(before: String, after: String, path: String) throws {
    let bytes = Data(envelope.replacingOccurrences(of: before, with: after).utf8)
    do {
        _ = try SlopDocumentFormat.applicationSchema(bytes)
        Issue.record("Invalid envelope was accepted")
    } catch let error as SlopPackageError {
        #expect(error.localizedDescription.contains(path))
    }
}

@Test(arguments: ["null", "[]", "true", "{}", "{broken"])
func documentFormatRejectsNonEnvelopes(source: String) {
    #expect(throws: SlopPackageError.self) {
        _ = try SlopDocumentFormat.applicationSchema(Data(source.utf8))
    }
}

import Foundation
import Testing
@testable import HitSlopRuntime

struct DocumentMediaTests {
    private let schema = try! SlopDocumentJSON(data: Data(#"{"type":"object","x-hitslop":{"version":1,"container":"map"},"properties":{"photo":{"type":"object","x-hitslop":{"container":"atomic","media":true},"properties":{"sha256":{"type":"string"},"mime":{"type":"string"},"bytes":{"type":"integer"}},"required":["sha256","mime","bytes"]}}}"#.utf8))
    @Test func recordMediaUsesTheUnrestrictedKeySchema() throws {
        let record: SlopDocumentJSON = .object(["type": .string("object"), "patternProperties": .object([SlopDocumentSchema.recordKeyPattern: schema["properties"]["photo"]]), "x-hitslop": .object(["container": .string("record")])])
        var source = schema
        source["properties"] = .object(["photos": record])
        let hash = String(repeating: "a", count: 64)
        let reference: SlopDocumentJSON = .object(["sha256": .string(hash), "mime": .string("image/png"), "bytes": .number(1)])
        let document: SlopDocumentJSON = .object(["photos": .object(["a\nb": reference])])
        try SlopDocumentSchema(source).validate(document)
        let packaged: SlopDocumentJSON = .object(["properties": .object(["data": source])])
        #expect(SlopMediaSync.hashes(in: document, schema: packaged) == [hash])
        let request: SlopDocumentJSON = .object(["ops": .array([.object(["op": .string("set"), "path": .array([.object(["key": .string("photos")]), .object(["key": .string("a\nb")])]), "value": reference])])])
        #expect(SlopMediaSync.introducedHashes(in: request, schema: source) == [hash])
    }
    @Test func failedUploadNeverSendsOrPersistsAnUncertainCommand() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let document = try SlopCommandDocument(root: root, schema: schema, initial: .object([:]))
        let seed = try await document.prepareSharing()
        let opening = SlopDocumentJSON.object(["snapshot": seed, "lease": .object(["id": .string("lease"), "expiresAt": .number(9_999_999_999_999)])])
        let calls = MediaCalls()
        let hash = String(repeating: "a", count: 64)
        try await document.connect(opening: opening, media: .init(prepare: { hashes in
            #expect(hashes == [hash])
            throw URLError(.notConnectedToInternet)
        }, load: { _ in })) { _ in
            await calls.sent()
            return .object(["ok": .bool(true), "revision": .number(1)])
        }
        let reference = SlopDocumentJSON.object(["sha256": .string(hash), "mime": .string("image/png"), "bytes": .number(1)])
        let result = try await document.apply(testRequest(document.openGuest(), ops: [testSet("photo", reference)]))
        #expect(result["error"]["code"].string == "storage_unavailable")
        #expect(await calls.count == 0)
        #expect(try await document.frame().data == .object([:]))
        #expect(try await document.frame().writable)
        try await document.close()
        let reopened = try SlopCommandDocument(root: root, schema: schema, initial: .object([:]))
        try await reopened.connect(opening: opening) { _ in
            await calls.sent()
            return .object(["ok": .bool(true), "revision": .number(1)])
        }
        #expect(await calls.count == 0)
        try await reopened.close()
    }
}
private actor MediaCalls {
    private(set) var count = 0
    func sent() { count += 1 }
}

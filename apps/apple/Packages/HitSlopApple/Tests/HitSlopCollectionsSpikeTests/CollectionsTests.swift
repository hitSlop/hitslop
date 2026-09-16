import Foundation
import Testing
import HitSlopCollectionsSpike
import HitSlopSQLiteArchive
import HitSlopLoroSpike

@MainActor struct CollectionsTests {
    typealias J = SpikeJSON
    func call(_ doc: CollectionsDocument, _ value: [String: Any]) async throws -> J {
        let bytes = try JSONSerialization.data(withJSONObject: value)
        return try J(data: await doc.request(bytes))
    }
    func op(_ doc: CollectionsDocument, _ operation: String, _ args: [String: Any] = [:]) async throws -> J {
        try await call(doc, ["collection":"todos","operation":operation,"args":args])
    }
    func fixture(_ root: URL) async throws -> URL {
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let url = root.appendingPathComponent("a.slopsql"), db = try SQLiteArchive(url: url, writable: true, create: true)
        try db.putAsset("collections.schema.json", bytes: Data(contentsOf: Bundle.module.url(forResource: "collections.schema", withExtension: "json", subdirectory: "Fixtures")!))
        try db.close(); let doc = try CollectionsDocument(url: url); try await doc.close(); return url
    }
    func attach(_ doc: CollectionsDocument) async throws { _ = try await call(doc, ["method":"attach","documentId":doc.identity,"schema":doc.fingerprint]) }
    func replay(_ doc: CollectionsDocument, _ batches: [J], _ first: Int) async throws {
        let updates = batches.enumerated().map { J.object(["sequence":.number(Double(first + $0.offset)),"batch":$0.element]) }
        let request = J.object(["method":.string("receive"),"documentId":.string(doc.identity),"schema":.string(doc.fingerprint),"updates":.array(updates)])
        _ = try await doc.request(request.encoded())
    }
    @Test func validatesCommitsAndRetriesAtomically() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString); defer { try? FileManager.default.removeItem(at: root) }
        let url = try await fixture(root), doc = try CollectionsDocument(url: url)
        _ = try await call(doc,["method":"failCommit"])
        let request: [String:Any] = ["collection":"todos","operation":"insert","args":["title":"first","completed":false,"createdAt":1],"requestId":UUID().uuidString]
        await #expect(throws: (any Error).self) { try await call(doc,request) }
        #expect(try await op(doc,"count") == .number(0))
        #expect(try await call(doc,["method":"outbox"]).array.isEmpty)
        let first = try await call(doc,request)
        #expect(try await call(doc,request) == first)
        #expect(try await op(doc,"count") == .number(1))
        await #expect(throws: (any Error).self) { try await op(doc,"insert",["title":42,"completed":false,"createdAt":1]) }
        await #expect(throws: (any Error).self) { try await op(doc,"update",["id":first.string!,"changes":["_id":"bad"]]) }
        await #expect(throws: (any Error).self) { try await op(doc,"delete") }
        try await doc.close()
        let reopened = try CollectionsDocument(url:url)
        #expect(try await call(reopened,request) == first)
        #expect(try await call(reopened,["method":"outbox"]).array.count == 1)
        try await reopened.close()
    }
    @Test func independentFieldsConflictsAndTombstonesConverge() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString); defer { try? FileManager.default.removeItem(at: root) }
        let left = try await fixture(root), right = root.appendingPathComponent("b.slopsql")
        try FileManager.default.copyItem(at:left,to:right)
        let a = try CollectionsDocument(url:left), b = try CollectionsDocument(url:right)
        try await attach(a); try await attach(b)
        let id = try await op(a,"insert",["title":"original","completed":false,"createdAt":1]).string!
        let initial = try await call(a,["method":"outbox"]).array
        try await replay(a,initial,2); try await replay(b,initial,2)
        _ = try await call(a,["method":"ack","acks":try JSONSerialization.jsonObject(with:J.array(initial).encoded())])
        _ = try await op(a,"update",["id":id,"changes":["title":"left"]])
        _ = try await op(b,"update",["id":id,"changes":["completed":true]])
        let x = try await call(a,["method":"outbox"]).array, y = try await call(b,["method":"outbox"]).array
        try await replay(a,x+y,3); try await replay(b,x+y,3)
        #expect(try await op(a,"findOne",["id":id]) == op(b,"findOne",["id":id]))
        #expect(try await op(b,"findOne",["id":id])["title"] == .string("left"))
        #expect(try await op(b,"findOne",["id":id])["completed"] == .bool(true))
        _ = try await call(a,["method":"ack","acks":try JSONSerialization.jsonObject(with:J.array(x).encoded())]); _ = try await call(b,["method":"ack","acks":try JSONSerialization.jsonObject(with:J.array(y).encoded())])
        _ = try await op(a,"update",["id":id,"changes":["title":"alpha"]]); _ = try await op(b,"update",["id":id,"changes":["title":"beta"]])
        let u = try await call(a,["method":"outbox"]).array, v = try await call(b,["method":"outbox"]).array
        try await replay(a,u+v,5); try await replay(b,u+v,5)
        #expect(try await op(a,"findOne",["id":id]) == op(b,"findOne",["id":id]))
        _ = try await call(a,["method":"ack","acks":try JSONSerialization.jsonObject(with:J.array(u).encoded())]); _ = try await call(b,["method":"ack","acks":try JSONSerialization.jsonObject(with:J.array(v).encoded())])
        _ = try await op(a,"delete",["id":id]); _ = try await op(b,"update",["id":id,"changes":["title":"concurrent edit"]])
        let deleted = try await call(a,["method":"outbox"]).array + call(b,["method":"outbox"]).array
        try await replay(a,deleted,7); try await replay(b,deleted,7); try await replay(b,deleted,7)
        #expect(try await op(a,"count") == .number(0)); #expect(try await op(b,"findOne",["id":id]) == .null)
        try await a.close(); try await b.close()
    }
    @Test func indexedPagesAndOwnership() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString); defer { try? FileManager.default.removeItem(at: root) }
        let url = try await fixture(root), doc = try CollectionsDocument(url:url)
        #expect(throws: (any Error).self) { try CollectionsDocument(url:url) }
        let alias = root.appendingPathComponent("alias.slopsql"); try FileManager.default.createSymbolicLink(at:alias,withDestinationURL:url)
        #expect(throws: (any Error).self) { try CollectionsDocument(url:alias) }
        try FileManager.default.removeItem(at: alias)
        let operations = (0..<80).map { ["collection":"todos","operation":"insert","args":["title":"Task \($0)","completed":$0%2 == 0,"createdAt":$0/4]] as [String:Any] }
        _ = try await call(doc,["method":"batch","operations":operations])
        var args: [String:Any] = ["where":["completed":false],"index":"by_completed","limit":7]
        var ids: [String] = []
        while true {
            let page = try await op(doc,"find",args); ids += page["items"].array.compactMap { $0["_id"].string }
            guard let cursor = page["nextCursor"].string else { break }; args["cursor"] = cursor
        }
        #expect(ids.count == 40 && Set(ids).count == 40)
        let plan = try await call(doc,["method":"explain","collection":"todos","operation":"find","args":["where":["completed":false],"index":"by_completed"]])
        #expect(plan.array.contains { $0.string?.contains("i_todos_by_completed") == true })
        args["where"] = ["completed":true]
        await #expect(throws: (any Error).self) { try await op(doc,"find",args) }
        await #expect(throws: (any Error).self) { try await op(doc,"find",["limit":10000]) }
        try await doc.close()
        let reopened = try CollectionsDocument(url:url); #expect(try await op(reopened,"count") == .number(80)); try await reopened.close()
    }
    @Test func receiveFailureKeepsCursorAndOutbox() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString); defer { try? FileManager.default.removeItem(at: root) }
        let url = try await fixture(root), doc = try CollectionsDocument(url:url); try await attach(doc)
        _ = try await op(doc,"insert",["title":"saved","completed":false,"createdAt":1]); let updates = try await call(doc,["method":"outbox"]).array
        _ = try await call(doc,["method":"failCommit"])
        await #expect(throws: (any Error).self) { try await replay(doc,updates,2) }
        #expect(try await call(doc,["method":"cursor"]) == .number(1))
        #expect(try await call(doc,["method":"outbox"]).array == updates)
        await #expect(throws: (any Error).self) { try await replay(doc,updates,3) }
        try await replay(doc,updates,2)
        #expect(try await call(doc,["method":"cursor"]) == .number(2))
        try await doc.close()
    }
}

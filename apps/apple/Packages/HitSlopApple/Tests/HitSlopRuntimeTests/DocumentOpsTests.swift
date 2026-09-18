import Foundation
import SQLite3
import Testing

@testable import HitSlopRuntime

struct DocumentOpsTests {
    private func corpus() throws -> SlopDocumentJSON {
        try SlopDocumentJSON(
            data: Data(
                contentsOf: Bundle.module.url(
                    forResource: "document-ops", withExtension: "json", subdirectory: "Fixtures")!))
    }
    private func directory() throws -> URL {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        return root
    }
    @Test func canonicalCorpus() throws {
        let fixture = try corpus()
        let schema = try SlopDocumentSchema(fixture["schema"])
        #expect(fixture["retryWindowMs"] == .number(Double(slopRetryWindowMilliseconds)))
        for scenario in fixture["scenarios"].array {
            let root = try directory()
            defer { try? FileManager.default.removeItem(at: root) }
            let storage = try SlopCommandStorage(root: root)
            var snapshot = fixture["identity"]
            snapshot["revision"] = .number(0)
            snapshot["data"] = fixture["initial"]
            try storage.initialize(snapshot: snapshot)
            let open = try storage.open(now: 0)
            for event in scenario["events"].array {
                var request = event["request"]
                request["leaseId"] = open["lease"]["id"]
                let outcome = try storage.apply(request, schema: schema, now: 1)
                #expect(outcome.snapshot["revision"] == event["expected"]["revision"], "\(scenario["name"])")
                #expect(outcome.snapshot["data"] == event["expected"]["data"], "\(scenario["name"])")
                #expect(outcome.result["error"]["code"] == event["expected"]["error"], "\(scenario["name"])")
            }
        }
    }
    @Test func durableReceiptAndRollback() throws {
        let fixture = try corpus()
        let schema = try SlopDocumentSchema(fixture["schema"])
        let root = try directory()
        defer { try? FileManager.default.removeItem(at: root) }
        let storage = try SlopCommandStorage(root: root)
        var snapshot = fixture["identity"]
        snapshot["revision"] = .number(0)
        snapshot["data"] = fixture["initial"]
        try storage.initialize(snapshot: snapshot)
        let open = try storage.open(now: 0)
        var request = fixture["scenarios"].array.first { $0["name"].string == "increment" }!["events"].array[0][
            "request"]
        request["leaseId"] = open["lease"]["id"]
        storage.beforeCommit = { throw SlopDocumentError("Injected commit failure") }
        #expect(throws: (any Error).self) { try storage.apply(request, schema: schema, now: 1) }
        storage.beforeCommit = nil
        #expect(try storage.load()?.snapshot["revision"] == .number(0))
        _ = try storage.apply(request, schema: schema, now: 1)
        let reopened = try SlopCommandStorage(root: root)
        #expect(try reopened.apply(request, schema: schema, now: 2).snapshot["revision"] == .number(1))
        let expired = slopRetryWindowMilliseconds
        #expect(open["lease"]["expiresAt"] == .number(Double(slopRetryWindowMilliseconds)))
        _ = try reopened.open(now: expired)
        #expect(
            try reopened.apply(request, schema: schema, now: expired).result["error"]["code"].string == "lease_expired")
    }
    @Test func twoConnectionsSerializeLatestState() throws {
        let fixture = try corpus()
        let schema = try SlopDocumentSchema(fixture["schema"])
        let root = try directory()
        defer { try? FileManager.default.removeItem(at: root) }
        let first = try SlopCommandStorage(root: root)
        let second = try SlopCommandStorage(root: root)
        var snapshot = fixture["identity"]
        snapshot["revision"] = .number(0)
        snapshot["data"] = fixture["initial"]
        try first.initialize(snapshot: snapshot)
        let open = try first.open(now: 0)
        var request = fixture["scenarios"].array.first { $0["name"].string == "increment" }!["events"].array[0][
            "request"]
        request["leaseId"] = open["lease"]["id"]
        _ = try first.apply(request, schema: schema, now: 1)
        request["requestId"] = .string("second")
        #expect(try second.apply(request, schema: schema, now: 2).snapshot["data"]["count"] == .number(4))
    }
    @Test func receiptRowsContainOnlyFixedSizeDigests() throws {
        let fixture = try corpus(), root = try directory()
        defer { try? FileManager.default.removeItem(at: root) }
        let schema = try SlopDocumentSchema(fixture["schema"]), storage = try SlopCommandStorage(root: root)
        var snapshot = fixture["identity"]
        snapshot["revision"] = .number(0)
        snapshot["data"] = fixture["initial"]
        try storage.initialize(snapshot: snapshot)
        let opening = try storage.open(now: 0)
        var request = fixture["scenarios"].array.first { $0["name"].string == "increment" }!["events"].array[0]["request"]
        request["leaseId"] = opening["lease"]["id"]
        for index in 0..<5 {
            request["requestId"] = .string("command-\(index)")
            _ = try storage.apply(request, schema: schema, now: 1)
        }
        #expect(try storage.apply(request, schema: schema, now: 2).snapshot["revision"] == .number(5))
        var db: OpaquePointer?
        #expect(sqlite3_open_v2(storage.url.path, &db, SQLITE_OPEN_READONLY, nil) == SQLITE_OK)
        defer { sqlite3_close(db) }
        var statement: OpaquePointer?
        #expect(sqlite3_prepare_v2(db, "SELECT count(*), min(length(digest)), max(length(digest)) FROM receipts", -1, &statement, nil) == SQLITE_OK)
        defer { sqlite3_finalize(statement) }
        #expect(sqlite3_step(statement) == SQLITE_ROW)
        #expect(sqlite3_column_int(statement, 0) == 5)
        #expect(sqlite3_column_int(statement, 1) == 32)
        #expect(sqlite3_column_int(statement, 2) == 32)
    }
    @Test func undoIsBoundedDurableAndAtomicAcrossConnections() throws {
        let fixture = try corpus(), root = try directory()
        defer { try? FileManager.default.removeItem(at: root) }
        let schema = try SlopDocumentSchema(fixture["schema"]), first = try SlopCommandStorage(root: root)
        var snapshot = fixture["identity"]
        snapshot["revision"] = .number(0)
        snapshot["data"] = fixture["initial"]
        try first.initialize(snapshot: snapshot)
        let opening = try first.open(now: 0)
        var request = fixture["scenarios"].array.first { $0["name"].string == "increment" }!["events"].array[0]["request"]
        request["leaseId"] = opening["lease"]["id"]
        for index in 0..<20 {
            request["requestId"] = .string("increment-\(index)")
            _ = try first.apply(request, schema: schema, now: 1)
        }
        func undoCount() throws -> Int32 {
            var db: OpaquePointer?, statement: OpaquePointer?
            guard sqlite3_open_v2(first.url.path, &db, SQLITE_OPEN_READONLY, nil) == SQLITE_OK else {
                throw SlopDocumentError("Cannot inspect undo storage")
            }
            defer { sqlite3_finalize(statement); sqlite3_close(db) }
            guard sqlite3_prepare_v2(db, "SELECT count(*) FROM undo", -1, &statement, nil) == SQLITE_OK,
                sqlite3_step(statement) == SQLITE_ROW else { throw SlopDocumentError("Cannot count undo slots") }
            return sqlite3_column_int(statement, 0)
        }
        #expect(try undoCount() == 1)
        let second = try SlopCommandStorage(root: root)
        var undo = request.object
        undo.removeValue(forKey: "ops")
        undo["requestId"] = .string("undo")
        undo["undo"] = .object(["requestId": request["requestId"], "revision": .number(20)])
        let command = SlopDocumentJSON.object(undo)
        var foreign = command
        foreign["leaseId"] = try second.open(now: 1)["lease"]["id"]
        #expect(try second.apply(foreign, schema: schema, now: 1).result["error"]["code"] == .string("rejected"))
        second.beforeCommit = { throw SlopDocumentError("Injected failure") }
        #expect(throws: (any Error).self) { try second.apply(command, schema: schema, now: 2) }
        second.beforeCommit = nil
        #expect(try first.load()?.snapshot["revision"] == .number(20))
        #expect(try undoCount() == 1)
        let restored = try second.apply(command, schema: schema, now: 2)
        #expect(restored.snapshot["revision"] == .number(21))
        #expect(restored.snapshot["data"]["count"] == .number(38))
        #expect(try undoCount() == 0)
        #expect(try first.apply(command, schema: schema, now: 3).result == restored.result)
        request["requestId"] = .string("later")
        _ = try first.apply(request, schema: schema, now: 4)
        #expect(try second.apply(command, schema: schema, now: 5).snapshot["revision"] == .number(22))
        undo["requestId"] = .string("stale-undo")
        #expect(try second.apply(.object(undo), schema: schema, now: 6).result["error"]["code"] == .string("stale_revision"))
        _ = try first.open(now: slopRetryWindowMilliseconds)
        #expect(try undoCount() == 0)
        #expect(try second.apply(command, schema: schema, now: slopRetryWindowMilliseconds).result["error"]["code"] == .string("lease_expired"))
    }

    @Test func missingOrUnknownAuthorityModeIsRejected() throws {
        let fixture = try corpus(), root = try directory()
        defer { try? FileManager.default.removeItem(at: root) }
        let storage = try SlopCommandStorage(root: root)
        var snapshot = fixture["identity"]
        snapshot["revision"] = .number(0)
        snapshot["data"] = fixture["initial"]
        try storage.initialize(snapshot: snapshot)
        for metadata in [#"{"pendingProjection":false,"outstanding":{}}"#, #"{"mode":"unknown","pendingProjection":false,"outstanding":{}}"#] {
            try storage.execute("UPDATE document SET metadata=?", [.blob(Data(metadata.utf8))])
            #expect(throws: (any Error).self) { try storage.load() }
        }
    }

    @Test func unknownAnnotationsAreRejected() throws {
        let markers: [SlopDocumentJSON] = [.string("invalid"), .object([:]), .object(["container": .string("unknown")])]
        for marker in markers {
            let schema = SlopDocumentJSON.object([
                "type": .string("object"), "x-hitslop": .object(["version": .number(1), "container": .string("map")]),
                "properties": .object(["value": .object(["type": .string("object"), "x-hitslop": marker])])
            ])
            #expect(throws: (any Error).self) { try SlopDocumentSchema(schema) }
        }
    }

}

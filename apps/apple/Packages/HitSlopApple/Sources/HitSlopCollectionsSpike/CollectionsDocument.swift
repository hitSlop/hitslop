import Foundation
import Darwin
import Loro
import HitSlopSQLiteArchive
import HitSlopLoroSpike

/// A process owns each document inode. Locks live in the user's temporary
/// directory, not beside the portable document. Locking the SQLite inode itself
/// conflicts with SQLite's fcntl locks on macOS.
private final class Ownership: @unchecked Sendable {
    private var fd: Int32
    init(_ url: URL) throws {
        var info = stat()
        guard stat(url.path, &info) == 0 else { throw SQLiteFailure("Cannot stat document") }
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("hitslop-collections-locks")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        let path = directory.appendingPathComponent("\(info.st_dev)-\(info.st_ino).lock").path
        fd = Darwin.open(path, O_CREAT | O_RDWR | O_CLOEXEC | O_NOFOLLOW, 0o600)
        guard fd >= 0 else { throw SQLiteFailure("Cannot lock document") }
        if flock(fd, LOCK_EX | LOCK_NB) != 0 { Darwin.close(fd); fd = -1; throw SQLiteFailure("Document is already open; close it before CLI mutations") }
    }
    func close() { if fd >= 0 { flock(fd, LOCK_UN); Darwin.close(fd); fd = -1 } }
    deinit { close() }
}

public actor CollectionsDocument {
    private let db: SQLiteArchive
    private let owner: Ownership
    private let contract: SpikeJSON
    private let schema: SpikeSchema
    private var doc: LoroDoc
    private var generation: Int64
    private var closed = false
    private var failCommit = false
    private var crashCommit = false
    private let peer = UInt64.random(in: 1...UInt64.max)
    public nonisolated let identity: String
    public nonisolated let fingerprint: String
    private var listeners: [UUID: AsyncStream<Int64>.Continuation] = [:]

    public init(url: URL) throws {
        owner = try Ownership(url)
        db = try SQLiteArchive(url: url, writable: true)
        let bytes = try db.asset("collections.schema.json")
        contract = try SpikeJSON(data: bytes)
        guard contract["format"].string == "hitslop-collections-1" else { throw SQLiteFailure("Unsupported collections format") }
        fingerprint = SQLiteArchive.hash(bytes)
        schema = try SpikeSchema(contract["document"])
        doc = LoroDoc()
        if let row = try db.query("SELECT * FROM document WHERE id=1").first {
            guard let checkpoint = row["checkpoint"]?.data, let id = row["identity"]?.text, let n = row["generation"]?.integer else { throw SQLiteFailure("Invalid document") }
            identity = id; generation = n
            let result = try doc.import(bytes: checkpoint)
            guard result.pending?.isEmpty != false else { throw SQLiteFailure("Missing seed dependencies") }
        } else {
            identity = UUID().uuidString; generation = 0
            for name in contract["collections"].object.keys.sorted() { _ = try doc.getMap(id: "data").insertContainer(key: name, child: LoroMap()) }
            doc.commit()
            try db.execute("INSERT INTO document(id,identity,generation,checkpoint,json,theme,revision) VALUES(1,?,0,?,'{}','{}',?)", [.text(identity), .blob(try doc.exportSnapshot()), .text(doc.oplogFrontiers().encode().base64EncodedString())])
        }
        try doc.setPeerId(peer: peer)
        let current = try SpikeJSON(loro: doc.getMap(id: "data").getDeepValue())
        try schema.validate(current)
        // Rebuildable projections are checked/repaired from the validated checkpoint at open.
        try db.transaction {
            for (name, definition) in contract["collections"].object.sorted(by: { $0.key < $1.key }) {
                guard Self.safe(name), definition["fields"].object.keys.allSatisfy(Self.safe) else { throw SQLiteFailure("Invalid collection identifier") }
                let columns = definition["fields"].object.sorted(by: { $0.key < $1.key }).map { key, value in
                    "f_\(key) \(value["type"].string == "string" ? "TEXT" : "REAL") NOT NULL"
                }.joined(separator: ",")
                try db.execute("CREATE TABLE IF NOT EXISTS c_\(name)(_id TEXT PRIMARY KEY,_deleted INTEGER NOT NULL,json TEXT NOT NULL,\(columns))")
                for (index, keys) in definition["indexes"].object {
                    guard Self.safe(index), !keys.array.isEmpty, keys.array.allSatisfy({ definition["fields"].object[$0.string ?? ""] != nil }) else { throw SQLiteFailure("Invalid index") }
                    try db.execute("CREATE INDEX IF NOT EXISTS i_\(name)_\(index) ON c_\(name)(_deleted,\(keys.array.map { "f_" + $0.string! }.joined(separator: ",")),_id)")
                }
                try db.execute("DELETE FROM c_\(name)")
                for (id, row) in current[name].object { try Self.project(db, name, id, row, definition) }
            }
            try db.execute("CREATE TABLE IF NOT EXISTS collection_receipts(id TEXT PRIMARY KEY,digest TEXT NOT NULL,result TEXT NOT NULL)")
        }
    }
    private static func safe(_ s: String) -> Bool { s.range(of: "^[A-Za-z][A-Za-z0-9_]{0,63}$", options: .regularExpression) != nil }
    private static func sql(_ v: SpikeJSON) throws -> SQLiteValue {
        switch v { case .string(let s): return .text(s); case .number(let n): return .real(n); case .bool(let b): return .integer(b ? 1 : 0); default: throw SQLiteFailure("Expected scalar field") }
    }
    private static func project(_ db: SQLiteArchive, _ name: String, _ id: String, _ row: SpikeJSON, _ definition: SpikeJSON) throws {
        guard row["_id"].string == id, UUID(uuidString: id) != nil else { throw SQLiteFailure("Invalid record identity") }
        let fields = definition["fields"].object.keys.sorted()
        let values: [SQLiteValue] = [.text(id), .integer(row["_deleted"] == .bool(true) ? 1 : 0), .text(String(decoding: try row.encoded(), as: UTF8.self))] + (try fields.map { try sql(row[$0]) })
        try db.execute("INSERT OR REPLACE INTO c_\(name)(_id,_deleted,json,\(fields.map { "f_" + $0 }.joined(separator: ","))) VALUES(\(values.map { _ in "?" }.joined(separator: ",")))", values)
    }
    private func candidate() throws -> LoroDoc { let next = doc.fork(); try next.setPeerId(peer: peer); return next }
    private func live(_ d: LoroDoc) throws -> SpikeJSON { try SpikeJSON(loro: d.getMap(id: "data").getDeepValue()) }
    private func commit(_ next: LoroDoc, outgoing: Bool, cursor: Int64? = nil, receipt: (String, String, SpikeJSON)? = nil) throws {
        next.commit()
        let before = try live(doc), after = try live(next)
        try schema.validate(after)
        let bytes = outgoing ? try next.exportUpdates(vv: doc.oplogVv()) : Data()
        try db.transaction {
            guard try db.query("SELECT generation FROM document").first?["generation"]?.integer == generation else { throw SQLiteFailure("Stale document generation") }
            for (name, records) in after.object {
                for (id, row) in records.object where before[name][id] != row { try Self.project(db, name, id, row, contract["collections"][name]) }
                guard Set(before[name].object.keys).isSubset(of: Set(records.object.keys)) else { throw SQLiteFailure("Records require tombstones") }
                for (id, row) in before[name].object where row["_deleted"] == .bool(true) {
                    guard records[id]["_deleted"] == .bool(true) else { throw SQLiteFailure("Deleted records cannot be restored") }
                }
            }
            try db.execute("UPDATE document SET generation=?,checkpoint=?,revision=?,cursor=COALESCE(?,cursor) WHERE id=1", [.integer(generation + 1), .blob(try next.exportSnapshot()), .text(next.oplogFrontiers().encode().base64EncodedString()), cursor.map(SQLiteValue.integer) ?? .null])
            if !bytes.isEmpty { try db.execute("INSERT INTO outbox(id,hash,bytes) VALUES(?,?,?)", [.text(UUID().uuidString), .text(SQLiteArchive.hash(bytes)), .blob(bytes)]) }
            if let (id, digest, result) = receipt { try db.execute("INSERT INTO collection_receipts VALUES(?,?,?)", [.text(id), .text(digest), .text(String(decoding: try result.encoded(), as: UTF8.self))]) }
            if crashCommit { raise(SIGKILL) }
            if failCommit { failCommit = false; throw SQLiteFailure("Injected commit failure") }
        }
        doc = next; generation += 1
        for c in listeners.values { c.yield(generation) }
    }
    public func changes() -> AsyncStream<Int64> {
        let id = UUID()
        return AsyncStream { c in listeners[id] = c; c.yield(generation); c.onTermination = { [weak self] _ in Task { await self?.remove(id) } } }
    }
    private func remove(_ id: UUID) { listeners.removeValue(forKey: id) }
    public func close() throws { guard !closed else { return }; try db.close(); closed = true; owner.close(); for c in listeners.values { c.finish() }; listeners.removeAll() }
    public func request(_ data: Data) throws -> Data {
        guard !closed, data.count <= 16_777_216 else { throw SQLiteFailure("Closed document or oversized request") }
        let request = try SpikeJSON(data: data), method = request["method"].string ?? "call"
        switch method {
        case "inspect": return try SpikeJSON.object(["identity": .string(identity), "schemaHash": .string(fingerprint), "schema": contract, "generation": .number(Double(generation)), "cursor": .number(Double(try cursor()))]).encoded()
        case "seed": return try SpikeJSON.object(["protocol": .number(2), "documentId": .string(identity), "schema": .string(fingerprint), "checkpoint": .string(try doc.exportSnapshot().base64EncodedString()), "version": .string(doc.oplogFrontiers().encode().base64EncodedString())]).encoded()
        case "cursor": return try SpikeJSON.number(Double(try cursor())).encoded()
        case "outbox": return try outbox().encoded()
        case "ack": try acknowledge(request["acks"]); return Data("null".utf8)
        case "receive": try receive(request); return Data("null".utf8)
        case "attach":
            guard request["documentId"].string == identity, request["schema"].string == fingerprint, try cursor() == 0 else { throw SQLiteFailure("Invalid room seed attachment") }
            try db.execute("UPDATE document SET cursor=1"); return Data("null".utf8)
        case "crashCommit": try db.execute("PRAGMA cache_size=8"); try db.execute("PRAGMA cache_spill=ON"); crashCommit = true; return Data("null".utf8)
        case "failCommit": failCommit = true; return Data("null".utf8)
        case "batch":
            guard !request["operations"].array.isEmpty, request["operations"].array.count <= 10_000 else { throw SQLiteFailure("Invalid mutation batch") }
            return try mutate(request["operations"].array, request: request).encoded()
        default:
            let operation = request["operation"].string ?? ""
            if ["insert", "update", "delete"].contains(operation) { return try mutate([request], request: request).array[0].encoded() }
            return try query(request, explain: method == "explain").encoded()
        }
    }
    private func mutate(_ operations: [SpikeJSON], request: SpikeJSON) throws -> SpikeJSON {
        let digest = SQLiteArchive.hash(try request.encoded())
        let requestID = request["requestId"].string ?? UUID().uuidString
        guard UUID(uuidString: requestID) != nil else { throw SQLiteFailure("Invalid request ID") }
        if let prior = try db.query("SELECT digest,result FROM collection_receipts WHERE id=?", [.text(requestID)]).first {
            guard prior["digest"]?.text == digest else { throw SQLiteFailure("Request ID reused") }
            return try SpikeJSON(data: Data(prior["result"]!.text!.utf8))
        }
        let next = try candidate(); var results: [SpikeJSON] = []
        for op in operations {
            let name = op["collection"].string ?? "", definition = contract["collections"][name]
            guard definition != .null, let records = next.getMap(id: "data").get(key: name)?.asLoroMap() else { throw SQLiteFailure("Unknown collection") }
            let args = op["args"], operation = op["operation"].string ?? ""
            if operation == "insert" {
                guard case .object = args, Set(args.object.keys) == Set(definition["fields"].object.keys) else { throw SQLiteFailure("Insert requires exactly the declared fields") }
                let id = UUID().uuidString, row = try records.insertContainer(key: id, child: LoroMap())
                try row.insert(key: "_id", v: LoroValue.string(value: id)); try row.insert(key: "_deleted", v: LoroValue.bool(value: false))
                for (key, value) in args.object { try row.insert(key: key, v: value.loro) }
                results.append(.string(id))
            } else {
                guard ["update", "delete"].contains(operation), let id = args["id"].string else { throw SQLiteFailure("Explicit record ID required") }
                guard let row = records.get(key: id)?.asLoroMap(), row.get(key: "_deleted")?.asValue() != .bool(value: true) else { results.append(.number(0)); continue }
                if operation == "delete" { try row.insert(key: "_deleted", v: LoroValue.bool(value: true)) }
                else {
                    guard case .object = args["changes"], Set(args["changes"].object.keys).isSubset(of: Set(definition["fields"].object.keys)) else { throw SQLiteFailure("Unknown or host-owned field") }
                    for (key, value) in args["changes"].object { try row.insert(key: key, v: value.loro) }
                }
                results.append(.number(1))
            }
        }
        let result = SpikeJSON.array(results)
        try commit(next, outgoing: true, receipt: (requestID, digest, result)); return result
    }
    private func query(_ request: SpikeJSON, explain: Bool) throws -> SpikeJSON {
        let name = request["collection"].string ?? "", definition = contract["collections"][name], args = request["args"]
        guard definition != .null else { throw SQLiteFailure("Unknown collection") }
        let operation = request["operation"].string ?? "find"
        guard ["find", "findOne", "count"].contains(operation) else { throw SQLiteFailure("Unknown operation") }
        var conditions = ["_deleted=0"], values: [SQLiteValue] = []
        if operation == "findOne" { guard let id = args["id"].string else { throw SQLiteFailure("Explicit ID required") }; conditions.append("_id=?"); values.append(.text(id)) }
        guard args["where"] == .null || { if case .object = args["where"] { return true }; return false }() else { throw SQLiteFailure("Invalid filter") }
        for (key, value) in args["where"].object.sorted(by: { $0.key < $1.key }) {
            guard definition["fields"].object[key] != nil else { throw SQLiteFailure("Unknown filter field") }
            let type = definition["fields"][key]["type"].string
            guard (type == "string" && value.string != nil) || (type == "boolean" && (value == .bool(true) || value == .bool(false))) || (["number", "integer"].contains(type ?? "") && value.number != nil) else { throw SQLiteFailure("Invalid filter type") }
            conditions.append("f_\(key)=?"); values.append(try Self.sql(value))
        }
        var fields: [String] = []
        if let index = args["index"].string { guard definition["indexes"].object[index] != nil else { throw SQLiteFailure("Unknown index") }; fields = definition["indexes"][index].array.compactMap(\.string) }
        let columns = fields.map { "f_" + $0 } + ["_id"]
        guard args["order"] == .null || ["asc", "desc"].contains(args["order"].string ?? "") else { throw SQLiteFailure("Invalid order") }
        let descending = args["order"].string == "desc"
        var queryIdentity = args; queryIdentity["cursor"] = .null; queryIdentity["limit"] = .null
        let binding = SQLiteArchive.hash(try SpikeJSON.object(["collection": .string(name), "args": queryIdentity, "schema": .string(fingerprint)]).encoded())
        if let cursor = args["cursor"].string {
            guard let bytes = Data(base64Encoded: cursor), let page = try? SpikeJSON(data: bytes), page["binding"].string == binding, page["values"].array.count == columns.count else { throw SQLiteFailure("Cursor does not match query") }
            conditions.append("(\(columns.joined(separator: ","))) \(descending ? "<" : ">") (\(columns.map { _ in "?" }.joined(separator: ",")))")
            values += try page["values"].array.map(Self.sql)
        }
        let size = args["limit"].number ?? 50
        guard size >= 1, size <= 200, size.rounded() == size else { throw SQLiteFailure("Limit must be 1–200") }
        let limit = operation == "findOne" ? 1 : Int(size)
        let sql = "SELECT \(operation == "count" ? "count(*) AS n" : "json") FROM c_\(name) WHERE \(conditions.joined(separator: " AND "))" + (operation == "count" ? "" : " ORDER BY \(columns.map { $0 + (descending ? " DESC" : " ASC") }.joined(separator: ",")) LIMIT \(limit + 1)")
        if explain { return .array(try db.query("EXPLAIN QUERY PLAN " + sql, values).map { .string($0["detail"]?.text ?? "") }) }
        let rows = try db.query(sql, values)
        if operation == "count" { return .number(Double(rows[0]["n"]!.integer!)) }
        var items = try rows.map { try SpikeJSON(data: Data($0["json"]!.text!.utf8)) }
        if operation == "findOne" { return items.first.map(Self.publicRow) ?? .null }
        var cursor: SpikeJSON = .null
        if items.count > limit {
            items.removeLast(); let last = items.last!
            cursor = .string(try SpikeJSON.object(["binding": .string(binding), "values": .array(fields.map { last[$0] } + [last["_id"]])]).encoded().base64EncodedString())
        }
        return .object(["items": .array(items.map(Self.publicRow)), "nextCursor": cursor])
    }
    private static func publicRow(_ row: SpikeJSON) -> SpikeJSON { var fields = row.object; fields.removeValue(forKey: "_deleted"); return .object(fields) }
    private func cursor() throws -> Int64 { try db.query("SELECT cursor FROM document").first?["cursor"]?.integer ?? 0 }
    private func outbox() throws -> SpikeJSON {
        var result: [SpikeJSON] = [], size = 0
        for row in try db.query("SELECT id,hash,bytes FROM outbox ORDER BY sequence LIMIT 32") {
            let bytes = row["bytes"]!.data!; if !result.isEmpty && size + bytes.count > 262_144 { break }; size += bytes.count
            result.append(.object(["id": .string(row["id"]!.text!), "hash": .string(row["hash"]!.text!), "bytes": .string(bytes.base64EncodedString())]))
        }
        return .array(result)
    }
    private func acknowledge(_ acks: SpikeJSON) throws {
        guard !acks.array.isEmpty, acks.array.count <= 32 else { throw SQLiteFailure("Invalid acknowledgement batch") }
        try db.transaction {
            for ack in acks.array {
                guard let row = try db.query("SELECT id,hash FROM outbox ORDER BY sequence LIMIT 1").first, row["id"]?.text == ack["id"].string, row["hash"]?.text == ack["hash"].string else { throw SQLiteFailure("Out-of-order acknowledgement") }
                try db.execute("DELETE FROM outbox WHERE id=?", [.text(ack["id"].string!)])
            }
        }
    }
    private func receive(_ input: SpikeJSON) throws {
        guard input["documentId"].string == identity, input["schema"].string == fingerprint, input["updates"].array.count <= 32 else { throw SQLiteFailure("Room or schema mismatch") }
        var cursor = try cursor(); let next = try candidate(); var changed = false
        for update in input["updates"].array {
            guard let number = update["sequence"].number, number >= 2, number < Double(Int64.max), number.rounded() == number,
                  let bytes = Data(base64Encoded: update["batch"]["bytes"].string ?? ""), SQLiteArchive.hash(bytes) == update["batch"]["hash"].string else { throw SQLiteFailure("Invalid incoming batch") }
            let sequence = Int64(number)
            if sequence <= cursor { continue }
            guard sequence == cursor + 1 else { throw SQLiteFailure("Delivery gap") }
            let status = try next.import(bytes: bytes)
            guard status.pending?.isEmpty != false else { throw SQLiteFailure("Missing dependencies") }
            cursor = sequence; changed = true
        }
        if changed { try commit(next, outgoing: false, cursor: cursor) }
    }
}

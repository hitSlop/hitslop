import Foundation
import HitSlopSQLiteArchive
import HitSlopLoroSpike

public struct SQLiteFrame: Encodable, Sendable {
    public let publication: Int64
    public let revision: String
    package let data: SpikeJSON
    public let theme: [String: String]
    public let dirty = false
    public let error: String? = nil
    public let projectionError: String? = nil
    public func encoded() throws -> Data { try JSONEncoder().encode(self) }
}

public struct SQLiteBatch: Codable, Sendable {
    public let id: String
    public let hash: String
    public let bytes: Data
}

/// Durable confirmed frames. All edits happen on a candidate replica; failed
/// transactions never leak uncommitted data into the live view or the outbox.
public actor SQLiteDocument {
    public nonisolated let url: URL
    public nonisolated let identity: String
    private let db: SQLiteArchive
    private let schema: SpikeSchema
    private var replica: SpikeReplica
    private var generation: Int64
    private let peer = UInt64.random(in: 1...UInt64.max)
    private let defaults: [String: String]
    private var listeners: [UUID: AsyncStream<SQLiteFrame>.Continuation] = [:]
    private struct Receipt { var sequence: Int; var digest: String; var result: Result<SQLiteFrame, SQLiteFailure> }
    private struct Draft { var base: String; var sequence: Int; var authored: String; var failed = false }
    private var receipts: [String: Receipt] = [:]
    private var drafts: [String: Draft] = [:]
    private var failCommit = false

    public init(url: URL) throws {
        self.url = url
        db = try SQLiteArchive(url: url, writable: true)
        let appSchema = try SpikeSchema(SpikeJSON(data: db.asset("data.schema.json")))
        schema = try Self.platformSchema(appSchema)
        defaults = try Self.parseDefaults(db.asset("assets/theme.css"))
        if let row = try db.query("SELECT * FROM document WHERE id=1").first {
            guard let id = row["identity"]?.text, let checkpoint = row["checkpoint"]?.data, let revision = row["revision"]?.text,
                  let json = row["json"]?.text, let theme = row["theme"]?.text, let generation = row["generation"]?.integer else { throw SQLiteFailure("Incomplete document") }
            identity = id; self.generation = generation
            replica = try SpikeReplica(schema: schema, initial: .null, snapshot: checkpoint)
            let value = try replica.current()
            guard try value["content"].encoded() == Data(json.utf8), try value["theme"].encoded() == Data(theme.utf8), replica.revision() == revision else { throw SQLiteFailure("Projection differs from checkpoint") }
            try Self.validateTheme(value["theme"], defaults: defaults)
        } else {
            identity = UUID().uuidString; generation = 0
            let initial = try SpikeJSON(data: db.asset("assets/initial.json"))
            replica = try SpikeReplica(schema: schema, initial: .object(["content": initial, "theme": .object([:])]))
            let value = try replica.current()
            try db.execute("INSERT INTO document(id,identity,generation,checkpoint,json,theme,revision) VALUES(1,?,0,?,?,?,?)", [
                .text(identity), .blob(try replica.snapshot()), .text(String(decoding: try value["content"].encoded(), as: UTF8.self)),
                .text("{}"), .text(replica.revision())])
        }
    }
    private static func platformSchema(_ app: SpikeSchema) throws -> SpikeSchema {
        var wrapper = app.source
        wrapper["properties"] = .object(["content": app.source, "theme": .object([
            "type": .string("object"), "x-hitslop": .object(["container": .string("record")]),
            "patternProperties": .object(["^.*$": .object(["type": .string("string")])])])])
        wrapper["required"] = .array([.string("content"), .string("theme")])
        wrapper["additionalProperties"] = .bool(false)
        return try SpikeSchema(wrapper)
    }
    private static func parseDefaults(_ bytes: Data) throws -> [String: String] {
        let css = String(decoding: bytes, as: UTF8.self)
        let regex = try NSRegularExpression(pattern: "(--slop-[a-z0-9-]+)\\s*:\\s*([^;{}]+);")
        let text = css as NSString
        let pairs = regex.matches(in: css, range: NSRange(location: 0, length: text.length)).map { (text.substring(with: $0.range(at: 1)), text.substring(with: $0.range(at: 2)).trimmingCharacters(in: .whitespacesAndNewlines)) }
        guard !pairs.isEmpty, Set(pairs.map(\.0)).count == pairs.count else { throw SQLiteFailure("Invalid authored theme contract") }
        return Dictionary(uniqueKeysWithValues: pairs)
    }
    private static func validateTheme(_ value: SpikeJSON, defaults: [String: String]) throws {
        for (name, token) in value.object {
            guard defaults[name] != nil, let text = token.string, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                  text.utf8.count <= 2048, !text.contains(where: { "{};\0<>".contains($0) }), !text.contains("/*"), !text.lowercased().contains("url(") else {
                throw SQLiteFailure("Invalid theme token: \(name)")
            }
            let refs = try NSRegularExpression(pattern: "var\\(\\s*(--[a-zA-Z0-9-]+)")
            let ns = text as NSString
            for match in refs.matches(in: text, range: NSRange(location: 0, length: ns.length)) {
                guard defaults[ns.substring(with: match.range(at: 1))] != nil else { throw SQLiteFailure("Unknown theme reference") }
            }
        }
    }
    public func frame() throws -> SQLiteFrame {
        let value = try replica.current()
        let token = try SpikeJSON.object(["identity": .string(identity), "frontiers": .string(replica.revision())]).encoded().base64EncodedString()
        return SQLiteFrame(publication: generation, revision: token, data: value["content"], theme: value["theme"].object.compactMapValues(\.string))
    }
    private func frontier(_ token: String) throws -> String {
        guard let bytes = Data(base64Encoded: token), let value = try? SpikeJSON(data: bytes), value["identity"].string == identity, let f = value["frontiers"].string else { throw SQLiteFailure("Foreign revision") }
        return f
    }
    public func events() throws -> AsyncStream<SQLiteFrame> {
        let id = UUID(), frame = try frame()
        return AsyncStream { c in
            listeners[id] = c; c.yield(frame)
            c.onTermination = { [weak self] _ in Task { await self?.removeListener(id) } }
        }
    }
    private func removeListener(_ id: UUID) { listeners.removeValue(forKey: id) }
    private func candidate() throws -> SpikeReplica { try SpikeReplica(schema: schema, initial: .null, snapshot: replica.snapshot(), peer: peer) }
    @discardableResult private func commit(_ staged: SpikeReplica, outgoing: Bool, cursor: Int64? = nil) throws -> SQLiteFrame {
        let value = try staged.current()
        try Self.validateTheme(value["theme"], defaults: defaults)
        let bytes = outgoing ? try staged.updates(since: replica) : Data()
        let next = generation + 1
        try db.transaction {
            guard try db.query("SELECT generation FROM document WHERE id=1").first?["generation"]?.integer == generation else { throw SQLiteFailure("Document changed in another process; reopen it") }
            try db.execute("UPDATE document SET generation=?,checkpoint=?,json=?,theme=?,revision=?,cursor=COALESCE(?,cursor) WHERE id=1", [
                .integer(next), .blob(try staged.snapshot()), .text(String(decoding: try value["content"].encoded(), as: UTF8.self)),
                .text(String(decoding: try value["theme"].encoded(), as: UTF8.self)), .text(staged.revision()), cursor.map(SQLiteValue.integer) ?? .null])
            if !bytes.isEmpty {
                try db.execute("INSERT INTO outbox(id,hash,bytes) VALUES(?,?,?)", [.text(UUID().uuidString), .text(SQLiteArchive.hash(bytes)), .blob(bytes)])
            }
            if failCommit { failCommit = false; throw SQLiteFailure("Injected commit failure") }
        }
        replica = staged; generation = next
        let frame = try frame(); for listener in listeners.values { listener.yield(frame) }; return frame
    }
    public func request(_ bytes: Data) throws -> Data {
        let body = try SpikeJSON(data: bytes)
        switch body["method"].string {
        case "open", "flush": return try frame().encoded()
        case "releaseDraft": drafts.removeValue(forKey: "\(body["session"].string ?? ""):\(body["draft"].string ?? "")"); return try frame().encoded()
        case "apply": return try apply(body, bytes: bytes).encoded()
        case "theme": return try setTheme(body["name"].string, value: body["value"].string).encoded()
        default: throw SQLiteFailure("Unknown SQLite spike method")
        }
    }
    private func apply(_ body: SpikeJSON, bytes: Data) throws -> SQLiteFrame {
        guard let session = body["session"].string, !session.isEmpty, let n = body["sequence"].number, n > 0, n.rounded() == n, n < Double(Int.max), let baseToken = body["base"].string else { throw SQLiteFailure("Invalid edit") }
        let sequence = Int(n), digest = SQLiteArchive.hash(bytes)
        if let receipt = receipts[session], receipt.sequence == sequence {
            guard receipt.digest == digest else { throw SQLiteFailure("Sequence reused for different edit") }; return try receipt.result.get()
        }
        guard sequence == (receipts[session]?.sequence ?? 0) + 1 else { throw SQLiteFailure("Out-of-order edit") }
        let draftKey = body["draft"].string.map { session + ":" + $0 }
        let result: Result<SQLiteFrame, SQLiteFailure>
        do {
            var base = try frontier(baseToken)
            if let key = draftKey {
                guard body["draft"].string?.isEmpty == false else { throw SQLiteFailure("Empty draft identity") }
                if let draft = drafts[key] {
                    guard !draft.failed, draft.base == baseToken, body["parent"].number == Double(draft.sequence) else { throw SQLiteFailure("Invalid text ancestry") }
                    base = draft.authored
                } else if body["parent"] != .null { throw SQLiteFailure("Unknown text ancestry") }
            } else if body["parent"] != .null { throw SQLiteFailure("Parent requires a draft") }
            let staged = try candidate()
            var value = try staged.value(at: base)
            value["content"] = body["after"] // Preserve historical theme: data edits do not edit it.
            let authored = try staged.apply(base: base, after: value)
            let frame = try commit(staged, outgoing: true)
            if let key = draftKey { drafts[key] = Draft(base: baseToken, sequence: sequence, authored: authored) }
            result = .success(frame)
        } catch {
            if let key = draftKey { drafts[key] = Draft(base: baseToken, sequence: sequence, authored: "", failed: true) }
            result = .failure(SQLiteFailure(error.localizedDescription))
        }
        // Consume failed requests too; clients advance their sequence after rejection.
        receipts[session] = Receipt(sequence: sequence, digest: digest, result: result)
        return try result.get()
    }

    @discardableResult public func setTheme(_ name: String?, value: String?) throws -> SQLiteFrame {
        let staged = try candidate()
        var after = try staged.current()
        var theme = after["theme"].object
        if let name {
            guard defaults[name] != nil else { throw SQLiteFailure("Unknown theme token") }
            theme[name] = value.map(SpikeJSON.string)
        } else { theme = [:] }
        after["theme"] = .object(theme); try Self.validateTheme(after["theme"], defaults: defaults)
        _ = try staged.apply(base: staged.revision(), after: after)
        return try commit(staged, outgoing: true)
    }
    public func outbox() throws -> [SQLiteBatch] {
        try db.query("SELECT id,hash,bytes FROM outbox ORDER BY sequence").map { row in
            guard let id = row["id"]?.text, let hash = row["hash"]?.text, let bytes = row["bytes"]?.data, SQLiteArchive.hash(bytes) == hash else { throw SQLiteFailure("Invalid outgoing batch") }
            return SQLiteBatch(id: id, hash: hash, bytes: bytes)
        }
    }
    public func acknowledge(_ batch: SQLiteBatch) throws {
        guard let first = try outbox().first, first.id == batch.id, first.hash == batch.hash else { throw SQLiteFailure("Invalid acknowledgement") }
        try db.execute("DELETE FROM outbox WHERE id=?", [.text(batch.id)])
    }
    public func receive(_ batch: SQLiteBatch, sequence: Int64) throws {
        guard SQLiteArchive.hash(batch.bytes) == batch.hash else { throw SQLiteFailure("Batch hash mismatch") }
        let cursor = try db.query("SELECT cursor FROM document WHERE id=1").first?["cursor"]?.integer ?? 0
        if sequence <= cursor { return }
        guard sequence == cursor + 1 else { throw SQLiteFailure("Delivery gap") }
        let staged = try candidate(); try staged.receive(batch.bytes)
        try commit(staged, outgoing: false, cursor: sequence)
    }
    public func snapshot(to destination: URL) throws -> Int64 { try db.backup(to: destination); return generation }
    public func saveArtwork(preview: Data, icon: Data, generation expected: Int64) throws -> Bool {
        try db.transaction {
            guard generation == expected, try db.query("SELECT generation FROM document WHERE id=1").first?["generation"]?.integer == expected else { return false }
            for (kind, bytes) in [("preview", preview), ("icon", icon)] {
                guard bytes.count <= 33_554_432, bytes.starts(with: [137,80,78,71,13,10,26,10]) else { throw SQLiteFailure("Invalid PNG") }
                try db.execute("INSERT OR REPLACE INTO artwork VALUES(?,?,?)", [.text(kind), .integer(expected), .blob(bytes)])
            }
            return true
        }
    }
    public func injectCommitFailure() { failCommit = true }
    public func close() throws { try db.close(); for listener in listeners.values { listener.finish() }; listeners.removeAll() }
}

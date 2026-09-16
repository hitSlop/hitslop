import Foundation
import Loro

/// Confined to the document executor. Forks validate before changing the live doc.
public final class SlopDocumentReplica {
    public let schema: SlopDocumentSchema
    let doc: LoroDoc

    private init(schema: SlopDocumentSchema, document: LoroDoc) {
        self.schema = schema
        self.doc = document
    }
    func fork() -> SlopDocumentReplica { SlopDocumentReplica(schema: schema, document: doc.fork()) }

    public init(schema: SlopDocumentSchema, initial: SlopDocumentJSON, snapshot: Data? = nil, peer: UInt64? = nil) throws {
        self.schema = schema
        doc = LoroDoc()
        if let peer { try doc.setPeerId(peer: peer) }
        if let snapshot {
            let status = try doc.import(bytes: snapshot)
            guard status.pending?.isEmpty != false else { throw SlopDocumentError("Missing Loro dependencies") }
        }
        else {
            try schema.validate(initial)
            try Self.seedMap(doc.getMap(id: "data"), schema.mapping, initial)
            doc.commit()
        }
        try schema.validate(current())
    }
    public func current() throws -> SlopDocumentJSON { try SlopDocumentJSON(loro: doc.getMap(id: "data").getDeepValue()) }
    public func value(at revision: String) throws -> SlopDocumentJSON {
        guard let bytes = Data(base64Encoded: revision) else { throw SlopDocumentError("Invalid revision") }
        let frontiers = try Frontiers.decode(bytes: bytes)
        guard doc.frontiersToVv(frontiers: frontiers) != nil else { throw SlopDocumentError("Unknown revision") }
        let historical = try doc.forkAt(frontiers: frontiers)
        guard historical.stateFrontiers().eq(other: frontiers) else { throw SlopDocumentError("Unavailable revision history") }
        return try SlopDocumentJSON(loro: historical.getMap(id: "data").getDeepValue())
    }
    public func snapshot() throws -> Data { try doc.exportSnapshot() }
    public func revision() -> String { doc.oplogFrontiers().encode().base64EncodedString() }
    @discardableResult public func apply(base: String, after: SlopDocumentJSON) throws -> String {
        try schema.validate(after)
        guard let bytes = Data(base64Encoded: base) else { throw SlopDocumentError("Invalid revision") }
        let frontiers = try Frontiers.decode(bytes: bytes)
        guard doc.frontiersToVv(frontiers: frontiers) != nil else { throw SlopDocumentError("Unknown revision") }
        let staged = try doc.forkAt(frontiers: frontiers)
        guard staged.stateFrontiers().eq(other: frontiers) else { throw SlopDocumentError("Unavailable revision history") }
        let before = try SlopDocumentJSON(loro: staged.getMap(id: "data").getDeepValue())
        try schema.validate(before)
        try Self.applyMap(staged.getMap(id: "data"), schema.mapping, before, after)
        try schema.validate(SlopDocumentJSON(loro: staged.getMap(id: "data").getDeepValue()))
        staged.commit()
        let authored = staged.oplogFrontiers().encode().base64EncodedString()
        try receive(staged.exportUpdates(vv: doc.oplogVv()))
        return authored
    }
    public func receive(_ bytes: Data) throws {
        let staged = doc.fork()
        let status = try staged.import(bytes: bytes)
        guard status.pending?.isEmpty != false else { throw SlopDocumentError("Missing Loro dependencies") }
        try schema.validate(SlopDocumentJSON(loro: staged.getMap(id: "data").getDeepValue()))
        _ = try doc.import(bytes: bytes)
    }
    public func updates(since other: SlopDocumentReplica) throws -> Data { try doc.exportUpdates(vv: other.doc.oplogVv()) }
    public func versionVector() -> Data { doc.oplogVv().encode() }
    public func updates(since version: Data) throws -> Data { try doc.exportUpdates(vv: VersionVector.decode(bytes: version)) }

    private enum Slot {
        case map(LoroMap, String), list(LoroMovableList, UInt32)
        func get() -> ValueOrContainer? {
            switch self { case .map(let m, let k): m.get(key: k); case .list(let l, let i): l.get(index: i) }
        }
        func insert<T: ContainerLike>(_ value: T) throws -> T {
            switch self {
            case .map(let m, let k): try m.insertContainer(key: k, child: value)
            case .list(let l, let i): try l.insertContainer(pos: i, child: value)
            }
        }
        func value(_ value: SlopDocumentJSON, inserting: Bool) throws {
            switch self {
            case .map(let m, let k): try m.insert(key: k, v: value.loro)
            case .list(let l, let i):
                if inserting { try l.insert(pos: i, v: value.loro) }
                else { try l.set(pos: i, value: value.loro) }
            }
        }
    }
    private static func seed(_ slot: Slot, _ node: SlopDocumentMapping, _ value: SlopDocumentJSON) throws {
        switch node {
        case .text:
            let t = try slot.insert(LoroText()); try t.insert(pos: 0, s: value.string ?? "")
        case .map, .record: try seedMap(slot.insert(LoroMap()), node, value)
        case .list(_, let item):
            let l = try slot.insert(LoroMovableList())
            for (i, v) in value.array.enumerated() { try seed(.list(l, UInt32(i)), item, v) }
        case .atomic: try slot.value(value, inserting: true)
        }
    }
    private static func seedMap(_ map: LoroMap, _ node: SlopDocumentMapping, _ value: SlopDocumentJSON) throws {
        for (key, child) in value.object.sorted(by: { $0.key < $1.key }) {
            let field: SlopDocumentMapping
            switch node { case .map(let fields): field = fields[key] ?? .atomic; case .record(let v): field = v; default: throw SlopDocumentError("Expected map") }
            try seed(.map(map, key), field, child)
        }
    }
    private static func apply(_ slot: Slot, _ node: SlopDocumentMapping, _ before: SlopDocumentJSON, _ after: SlopDocumentJSON) throws {
        if before == after { return }
        switch node {
        case .text:
            guard let text = slot.get()?.asLoroText() else { throw SlopDocumentError("Expected text container") }
            try text.update(s: after.string ?? "", options: UpdateOptions(timeoutMs: nil, useRefinedDiff: false))
        case .map, .record:
            guard let map = slot.get()?.asLoroMap() else { throw SlopDocumentError("Expected map container") }
            try applyMap(map, node, before, after)
        case .list(let key, let item):
            guard let list = slot.get()?.asLoroMovableList() else { throw SlopDocumentError("Expected movable list") }
            try applyList(list, key, item, before.array, after.array)
        case .atomic: try slot.value(after, inserting: false)
        }
    }
    private static func applyMap(_ map: LoroMap, _ node: SlopDocumentMapping, _ before: SlopDocumentJSON, _ after: SlopDocumentJSON) throws {
        for key in before.object.keys where after.object[key] == nil { try map.delete(key: key) }
        for (key, child) in after.object.sorted(by: { $0.key < $1.key }) {
            let field: SlopDocumentMapping
            switch node { case .map(let fields): field = fields[key] ?? .atomic; case .record(let v): field = v; default: throw SlopDocumentError("Expected map") }
            if let previous = before.object[key] { try apply(.map(map, key), field, previous, child) }
            else { try seed(.map(map, key), field, child) }
        }
    }
    private static func applyList(_ list: LoroMovableList, _ key: String, _ item: SlopDocumentMapping, _ before: [SlopDocumentJSON], _ after: [SlopDocumentJSON]) throws {
        func index(_ id: String) -> UInt32? {
            for i in 0..<list.len() {
                let v = list.get(index: i)
                if v?.asLoroMap()?.get(key: key)?.asValue() == .string(value: id) { return i }
                if case .map(let object) = v?.asValue(), object[key] == .string(value: id) { return i }
            }
            return nil
        }
        func keyed(_ values: [SlopDocumentJSON]) throws -> [(String, SlopDocumentJSON)] {
            var seen = Set<String>()
            return try values.map { value in
                guard let id = value[key].string, !id.isEmpty, seen.insert(id).inserted else {
                    throw SlopDocumentError("List IDs must be non-empty and unique")
                }
                return (id, value)
            }
        }
        let old = Dictionary(uniqueKeysWithValues: try keyed(before))
        let entries = try keyed(after)
        let next = Set(entries.map { $0.0 })
        for id in old.keys where !next.contains(id) { if let i = index(id) { try list.delete(pos: i, len: 1) } }
        for (i, entry) in entries.enumerated() where old[entry.0] == nil {
            try seed(.list(list, min(UInt32(i), list.len())), item, entry.1)
        }
        for (id, child) in entries {
            if let previous = old[id], let i = index(id) { try apply(.list(list, i), item, previous, child) }
        }
        for (i, entry) in entries.enumerated() {
            if let from = index(entry.0), from != UInt32(i) { try list.mov(from: from, to: UInt32(i)) }
        }
    }
}

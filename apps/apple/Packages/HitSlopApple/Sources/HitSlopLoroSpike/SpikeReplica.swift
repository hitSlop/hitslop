import Foundation
import Loro

/// Confined to the document executor. Forks validate before changing the live doc.
package final class SpikeReplica {
    package let schema: SpikeSchema
    let doc: LoroDoc

    package init(schema: SpikeSchema, initial: SpikeJSON, snapshot: Data? = nil, peer: UInt64? = nil) throws {
        self.schema = schema
        doc = LoroDoc()
        if let peer { try doc.setPeerId(peer: peer) }
        if let snapshot {
            let status = try doc.import(bytes: snapshot)
            guard status.pending?.isEmpty != false else { throw SpikeFailure("Missing Loro dependencies") }
        }
        else {
            try schema.validate(initial)
            try Self.seedMap(doc.getMap(id: "data"), schema.mapping, initial)
            doc.commit()
        }
        try schema.validate(current())
    }
    package func current() throws -> SpikeJSON { try SpikeJSON(loro: doc.getMap(id: "data").getDeepValue()) }
    package func value(at revision: String) throws -> SpikeJSON {
        guard let bytes = Data(base64Encoded: revision) else { throw SpikeFailure("Invalid revision") }
        let frontiers = try Frontiers.decode(bytes: bytes)
        guard doc.frontiersToVv(frontiers: frontiers) != nil else { throw SpikeFailure("Unknown revision") }
        let historical = try doc.forkAt(frontiers: frontiers)
        guard historical.stateFrontiers().eq(other: frontiers) else { throw SpikeFailure("Unavailable revision history") }
        return try SpikeJSON(loro: historical.getMap(id: "data").getDeepValue())
    }
    package func snapshot() throws -> Data { try doc.exportSnapshot() }
    package func revision() -> String { doc.oplogFrontiers().encode().base64EncodedString() }
    @discardableResult package func apply(base: String, after: SpikeJSON) throws -> String {
        try schema.validate(after)
        guard let bytes = Data(base64Encoded: base) else { throw SpikeFailure("Invalid revision") }
        let frontiers = try Frontiers.decode(bytes: bytes)
        guard doc.frontiersToVv(frontiers: frontiers) != nil else { throw SpikeFailure("Unknown revision") }
        let staged = try doc.forkAt(frontiers: frontiers)
        guard staged.stateFrontiers().eq(other: frontiers) else { throw SpikeFailure("Unavailable revision history") }
        let before = try SpikeJSON(loro: staged.getMap(id: "data").getDeepValue())
        try Self.applyMap(staged.getMap(id: "data"), schema.mapping, before, after)
        try schema.validate(SpikeJSON(loro: staged.getMap(id: "data").getDeepValue()))
        staged.commit()
        let authored = staged.oplogFrontiers().encode().base64EncodedString()
        try receive(staged.exportUpdates(vv: doc.oplogVv()))
        return authored
    }
    package func receive(_ bytes: Data) throws {
        let staged = doc.fork()
        let status = try staged.import(bytes: bytes)
        guard status.pending?.isEmpty != false else { throw SpikeFailure("Missing Loro dependencies") }
        try schema.validate(SpikeJSON(loro: staged.getMap(id: "data").getDeepValue()))
        _ = try doc.import(bytes: bytes)
    }
    package func updates(since other: SpikeReplica) throws -> Data { try doc.exportUpdates(vv: other.doc.oplogVv()) }
    package func versionVector() -> Data { doc.oplogVv().encode() }
    package func updates(since version: Data) throws -> Data { try doc.exportUpdates(vv: VersionVector.decode(bytes: version)) }

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
        func value(_ value: SpikeJSON, inserting: Bool) throws {
            switch self {
            case .map(let m, let k): try m.insert(key: k, v: value.loro)
            case .list(let l, let i):
                if inserting { try l.insert(pos: i, v: value.loro) }
                else { try l.set(pos: i, value: value.loro) }
            }
        }
    }
    private static func seed(_ slot: Slot, _ node: SpikeMapping, _ value: SpikeJSON) throws {
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
    private static func seedMap(_ map: LoroMap, _ node: SpikeMapping, _ value: SpikeJSON) throws {
        for (key, child) in value.object.sorted(by: { $0.key < $1.key }) {
            let field: SpikeMapping
            switch node { case .map(let fields): field = fields[key] ?? .atomic; case .record(let v): field = v; default: throw SpikeFailure("Expected map") }
            try seed(.map(map, key), field, child)
        }
    }
    private static func apply(_ slot: Slot, _ node: SpikeMapping, _ before: SpikeJSON, _ after: SpikeJSON) throws {
        if before == after { return }
        switch node {
        case .text:
            guard let text = slot.get()?.asLoroText() else { throw SpikeFailure("Expected text container") }
            try text.update(s: after.string ?? "", options: UpdateOptions(timeoutMs: nil, useRefinedDiff: false))
        case .map, .record:
            guard let map = slot.get()?.asLoroMap() else { throw SpikeFailure("Expected map container") }
            try applyMap(map, node, before, after)
        case .list(let key, let item):
            guard let list = slot.get()?.asLoroMovableList() else { throw SpikeFailure("Expected movable list") }
            try applyList(list, key, item, before.array, after.array)
        case .atomic: try slot.value(after, inserting: false)
        }
    }
    private static func applyMap(_ map: LoroMap, _ node: SpikeMapping, _ before: SpikeJSON, _ after: SpikeJSON) throws {
        for key in before.object.keys where after.object[key] == nil { try map.delete(key: key) }
        for (key, child) in after.object.sorted(by: { $0.key < $1.key }) {
            let field: SpikeMapping
            switch node { case .map(let fields): field = fields[key] ?? .atomic; case .record(let v): field = v; default: throw SpikeFailure("Expected map") }
            if let previous = before.object[key] { try apply(.map(map, key), field, previous, child) }
            else { try seed(.map(map, key), field, child) }
        }
    }
    private static func applyList(_ list: LoroMovableList, _ key: String, _ item: SpikeMapping, _ before: [SpikeJSON], _ after: [SpikeJSON]) throws {
        func index(_ id: String) -> UInt32? {
            for i in 0..<list.len() {
                let v = list.get(index: i)
                if v?.asLoroMap()?.get(key: key)?.asValue() == .string(value: id) { return i }
                if case .map(let object) = v?.asValue(), object[key] == .string(value: id) { return i }
            }
            return nil
        }
        let old = Dictionary(uniqueKeysWithValues: before.map { ($0[key].string!, $0) })
        let next = Set(after.compactMap { $0[key].string })
        for id in old.keys where !next.contains(id) { if let i = index(id) { try list.delete(pos: i, len: 1) } }
        for (i, child) in after.enumerated() where old[child[key].string!] == nil {
            try seed(.list(list, min(UInt32(i), list.len())), item, child)
        }
        for child in after {
            let id = child[key].string!
            if let previous = old[id], let i = index(id) { try apply(.list(list, i), item, previous, child) }
        }
        for (i, child) in after.enumerated() {
            if let from = index(child[key].string!), from != UInt32(i) { try list.mov(from: from, to: UInt32(i)) }
        }
    }
}

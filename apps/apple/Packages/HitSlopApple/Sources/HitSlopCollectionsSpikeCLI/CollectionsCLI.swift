import Foundation
import HitSlopCollectionsSpike
import HitSlopSQLiteArchive

@main struct CLI {
    static func main() async {
        do {
            let args = Array(CommandLine.arguments.dropFirst())
            guard args.count >= 2 else { throw SQLiteFailure("Usage: hitslop-collections-spike pack <assets> <file> | serve <file> | call <file> <json> | open <file>") }
            if args[0] == "pack" {
                guard args.count == 3 else { throw SQLiteFailure("pack requires assets and destination") }
                let root = URL(fileURLWithPath: args[1]), target = URL(fileURLWithPath: args[2])
                let db = try SQLiteArchive(url: target, writable: true, create: true)
                try db.transaction {
                    let paths = FileManager.default.enumerator(at: root, includingPropertiesForKeys: [.isRegularFileKey, .isSymbolicLinkKey])!
                    for case let url as URL in paths {
                        let values = try url.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey])
                        guard values.isSymbolicLink != true else { throw SQLiteFailure("Symlink in runtime") }
                        if values.isRegularFile == true { try db.putAsset(String(url.path.dropFirst(root.path.count + 1)), bytes: Data(contentsOf: url)) }
                    }
                }
                try db.close()
                if args[0] == "call", args.count == 3, let input = try JSONSerialization.jsonObject(with: Data(args[2].utf8)) as? [String: Any], input["method"] as? String == "inspect" {
                let db = try SQLiteArchive(url: URL(fileURLWithPath: args[1]))
                let schema = try db.asset("collections.schema.json"), row = try db.query("SELECT identity,generation,cursor FROM document").first!
                let output: [String: Any] = ["identity": row["identity"]!.text!, "schemaHash": SQLiteArchive.hash(schema), "schema": try JSONSerialization.jsonObject(with: schema), "generation": row["generation"]!.integer!, "cursor": row["cursor"]!.integer!, "guide": String(decoding: try db.asset("collections-guide.md"), as: UTF8.self)]
                print(String(decoding: try JSONSerialization.data(withJSONObject: output, options: [.sortedKeys]), as: UTF8.self)); return
            }
            let document = try CollectionsDocument(url: target); try await document.close(); print(target.path); return
            }
            if args[0] == "call", args.count == 3, let input = try JSONSerialization.jsonObject(with: Data(args[2].utf8)) as? [String: Any], input["method"] as? String == "inspect" {
                let db = try SQLiteArchive(url: URL(fileURLWithPath: args[1]))
                let schema = try db.asset("collections.schema.json"), row = try db.query("SELECT identity,generation,cursor FROM document").first!
                let output: [String: Any] = ["identity": row["identity"]!.text!, "schemaHash": SQLiteArchive.hash(schema), "schema": try JSONSerialization.jsonObject(with: schema), "generation": row["generation"]!.integer!, "cursor": row["cursor"]!.integer!, "guide": String(decoding: try db.asset("collections-guide.md"), as: UTF8.self)]
                print(String(decoding: try JSONSerialization.data(withJSONObject: output, options: [.sortedKeys]), as: UTF8.self)); return
            }
            let document = try CollectionsDocument(url: URL(fileURLWithPath: args[1]))
            if args[0] == "call" {
                guard args.count == 3 else { throw SQLiteFailure("call requires JSON") }
                print(String(decoding: try await document.request(Data(args[2].utf8)), as: UTF8.self))
            } else if args[0] == "serve" {
                var connection: CollectionsConnection?
                var syncTask: Task<Void, Never>?
                defer { syncTask?.cancel() }
                while let line = readLine() {
                    do {
                        let input = try JSONSerialization.jsonObject(with: Data(line.utf8)) as? [String: Any] ?? [:]
                        if input["method"] as? String == "connect" {
                            guard let endpoint = input["endpoint"] as? String, let url = URL(string: endpoint), ["https", "http"].contains(url.scheme ?? ""), let token = input["token"] as? String else { throw SQLiteFailure("Invalid test connection") }
                            syncTask?.cancel()
                            let next = CollectionsConnection(document: document, endpoint: url, credential: token); connection = next
                            syncTask = Task.detached { await next.run() }; print("{\"ok\":true,\"value\":null}"); fflush(stdout); continue
                        }
                        if input["method"] as? String == "disconnect" { syncTask?.cancel(); syncTask = nil; connection = nil; print("{\"ok\":true,\"value\":null}"); fflush(stdout); continue }
                        if input["method"] as? String == "status" { let value = await connection?.status ?? "offline"; let encoded = try JSONSerialization.data(withJSONObject: ["ok":true,"value":value]); print(String(decoding: encoded, as: UTF8.self)); fflush(stdout); continue }
                        let result = try await document.request(Data(line.utf8)); print("{\"ok\":true,\"value\":\(String(decoding: result, as: UTF8.self))}") }
                    catch { let data = try JSONSerialization.data(withJSONObject: ["ok": false, "error": error.localizedDescription]); print(String(decoding: data, as: UTF8.self)) }
                    fflush(stdout)
                }
            } else if args[0] == "verify-ui" {
                guard args.count == 3 else { throw SQLiteFailure("verify-ui requires output PNG") }
                try await CollectionsWindow.verify(document: document, url: URL(fileURLWithPath: args[1]), png: URL(fileURLWithPath: args[2]))
            } else if args[0] == "open" {
                CollectionsWindow.open(document: document, url: URL(fileURLWithPath: args[1]))
            } else { throw SQLiteFailure("Unknown command") }
            try await document.close()
        } catch { FileHandle.standardError.write(Data((error.localizedDescription + "\n").utf8)); exit(1) }
    }
}

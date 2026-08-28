import Foundation
import SlopCore
import XCTest

final class SlopCoreTests: XCTestCase {
    private var temporaryURLs: [URL] = []

    override func tearDownWithError() throws {
        temporaryURLs.forEach { try? FileManager.default.removeItem(at: $0) }
        temporaryURLs.removeAll()
    }

    func testManifestUsesWebCartridgeContract() throws {
        let package = try copiedFixture(named: "Todo")
        XCTAssertEqual(package.manifest.format, SlopManifest.supportedFormat)
        XCTAssertTrue(package.isSourceCurrent)
        XCTAssertTrue(package.isArtifactCurrent)
        XCTAssertEqual(Array(package.entryURL.pathComponents.suffix(2)), ["build", "index.html"])
        XCTAssertEqual(package.sourceURLs.map(\.lastPathComponent), ["main.ts"])
        XCTAssertThrowsError(try package.documentAssetURL(path: "../manifest.json"))
        XCTAssertEqual(package.themeURL.lastPathComponent, "theme.css")
        XCTAssertEqual(package.manifest.window.shape.kind, .roundedRect)
    }

    func testThemeChangesDoNotInvalidateSourceHash() throws {
        let package = try copiedFixture(named: "Todo")
        let sourceHash = try package.canonicalSourceHash()
        try Data(":root { --slop-accent: hotpink; }\n".utf8).write(to: package.themeURL, options: .atomic)
        let reopened = try SlopPackage(rootURL: package.rootURL)
        XCTAssertEqual(try reopened.canonicalSourceHash(), sourceHash)
        XCTAssertTrue(reopened.isSourceCurrent)

        let source = reopened.sourceRootURL.appendingPathComponent("main.ts")
        try Data("document.body.textContent = 'changed';\n".utf8).write(to: source, options: .atomic)
        XCTAssertFalse(try SlopPackage(rootURL: package.rootURL).isSourceCurrent)
    }

    func testSourceHashIncludesNestedFiles() throws {
        let package = try copiedFixture(named: "Todo")
        let nested = package.sourceRootURL.appendingPathComponent("models/state.json")
        try FileManager.default.createDirectory(at: nested.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data("{}\n".utf8).write(to: nested)
        let reopened = try SlopPackage(rootURL: package.rootURL)
        XCTAssertEqual(reopened.sourceURLs.map(\.lastPathComponent), ["main.ts", "state.json"])
        XCTAssertFalse(reopened.isSourceCurrent)
    }

    func testFirstReleaseManifestRejectsMissingCatalogAndInvalidCircle() throws {
        let package = try copiedFixture(named: "Todo")
        let data = try Data(contentsOf: package.manifestURL)
        var object = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        object.removeValue(forKey: "catalog")
        try JSONSerialization.data(withJSONObject: object).write(to: package.manifestURL, options: .atomic)
        XCTAssertThrowsError(try SlopPackage(rootURL: package.rootURL))

        var manifest = package.manifest
        manifest.window.shape = .init(kind: .circle)
        try SlopManifestIO.write(manifest, to: package.rootURL)
        XCTAssertThrowsError(try SlopPackage(rootURL: package.rootURL))
    }

    func testRejectsWASMFormatAndSourceSymlinks() throws {
        let package = try copiedFixture(named: "Todo")
        var object = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: package.manifestURL)) as? [String: Any])
        object["format"] = "slop-wasm/1"
        try JSONSerialization.data(withJSONObject: object).write(to: package.manifestURL, options: .atomic)
        XCTAssertThrowsError(try SlopPackage(rootURL: package.rootURL))

        object["format"] = SlopManifest.supportedFormat
        try JSONSerialization.data(withJSONObject: object).write(to: package.manifestURL, options: .atomic)
        let link = package.sourceRootURL.appendingPathComponent("linked.ts")
        try FileManager.default.createSymbolicLink(at: link, withDestinationURL: package.sourceRootURL.appendingPathComponent("main.ts"))
        XCTAssertThrowsError(try SlopPackage(rootURL: package.rootURL))
    }

    func testJSONWritesAtomicallyAndRejectsStaleRevision() throws {
        let package = try copiedFixture(named: "Todo")
        let store = SlopJSONStore(url: try package.storeURL(id: "state", kind: .json))
        let initial = try store.read()
        let replacement: [String: Any] = [
            "title": "Field notes",
            "subtitle": "",
            "nextID": 1,
            "todos": [],
        ]
        let written = try store.write(replacement, expectedRevision: initial.revision)
        XCTAssertNotEqual(written.revision, initial.revision)
        XCTAssertThrowsError(try store.write(replacement, expectedRevision: initial.revision))
        XCTAssertTrue(try String(contentsOf: store.url, encoding: .utf8).hasSuffix("\n"))
    }

    func testSQLiteQueriesTransactionsAndCheckpoint() throws {
        let package = try copiedFixture(named: "SQLiteTodo")
        let database = try SlopDatabase(url: package.storeURL(id: "main", kind: .sqlite))
        defer { database.close() }
        let before = try XCTUnwrap(database.query("SELECT count(*) AS count FROM todos").first?["count"] as? Int64)
        XCTAssertEqual(
            try database.transaction([
                ("INSERT INTO todos(title, done, position) VALUES (?, 0, ?)", ["Test", 999]),
            ]),
            1
        )
        XCTAssertEqual(try database.query("SELECT count(*) AS count FROM todos").first?["count"] as? Int64, before + 1)
        XCTAssertThrowsError(try database.query("DELETE FROM todos"))
        database.checkpoint()
    }

    func testDuplicatePreservesDataAndArtifactButGetsNewIdentity() throws {
        let source = try copiedFixture(named: "SQLiteTodo")
        let destination = source.rootURL.deletingLastPathComponent().appendingPathComponent("Duplicate.slop")
        let duplicateURL = try SlopDuplicator.duplicate(from: source.rootURL, to: destination, title: "Duplicate")
        let duplicate = try SlopPackage(rootURL: duplicateURL)
        XCTAssertNotEqual(duplicate.manifest.id, source.manifest.id)
        XCTAssertEqual(duplicate.manifest.title, "Duplicate")
        XCTAssertEqual(try Data(contentsOf: duplicate.entryURL), try Data(contentsOf: source.entryURL))
        XCTAssertTrue(duplicate.isSourceCurrent)
        XCTAssertTrue(duplicate.isArtifactCurrent)
        XCTAssertFalse(FileManager.default.fileExists(atPath: duplicateURL.appendingPathComponent("data.sqlite-wal").path))
        XCTAssertFalse(FileManager.default.fileExists(atPath: duplicateURL.appendingPathComponent("data.sqlite-shm").path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: duplicateURL.appendingPathComponent("AGENTS.md").path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: duplicateURL.appendingPathComponent(".agents/skills/hitslop/SKILL.md").path))
        XCTAssertTrue(try String(contentsOf: duplicateURL.appendingPathComponent("AGENTS.md"), encoding: .utf8).contains("Duplicate"))
    }

    func testDuplicateReadsSQLiteTemplateWithoutWritingSidecarsToSource() throws {
        let source = try copiedFixture(named: "SQLiteTodo")
        let databaseURL = try source.storeURL(id: "main", kind: .sqlite)
        let destination = source.rootURL.deletingLastPathComponent().appendingPathComponent("Read Only Duplicate.slop")

        try FileManager.default.setAttributes([.posixPermissions: 0o444], ofItemAtPath: databaseURL.path)
        try FileManager.default.setAttributes([.posixPermissions: 0o555], ofItemAtPath: source.rootURL.path)
        defer {
            try? FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: source.rootURL.path)
            try? FileManager.default.setAttributes([.posixPermissions: 0o644], ofItemAtPath: databaseURL.path)
        }

        let duplicateURL = try SlopDuplicator.duplicate(from: source.rootURL, to: destination)
        XCTAssertFalse(FileManager.default.fileExists(atPath: databaseURL.path + "-wal"))
        XCTAssertFalse(FileManager.default.fileExists(atPath: databaseURL.path + "-shm"))
        XCTAssertFalse(FileManager.default.fileExists(atPath: duplicateURL.appendingPathComponent("data.sqlite-wal").path))
        XCTAssertFalse(FileManager.default.fileExists(atPath: duplicateURL.appendingPathComponent("data.sqlite-shm").path))

        let duplicate = try SlopPackage(rootURL: duplicateURL)
        let database = try SlopDatabase(url: duplicate.storeURL(id: "main", kind: .sqlite))
        defer { database.close() }
        XCTAssertEqual(try database.query("SELECT count(*) AS count FROM todos").first?["count"] as? Int64, 3)
    }

    func testDuplicateSnapshotsCommittedRowsFromLiveWAL() throws {
        let source = try copiedFixture(named: "SQLiteTodo")
        let sourceDatabase = try SlopDatabase(url: source.storeURL(id: "main", kind: .sqlite))
        defer { sourceDatabase.close() }
        try sourceDatabase.execute(
            "INSERT INTO todos(title, done, position) VALUES (?, 0, ?)",
            parameters: ["Committed in WAL", 10_000]
        )

        let destination = source.rootURL.deletingLastPathComponent().appendingPathComponent("Live WAL Duplicate.slop")
        let duplicateURL = try SlopDuplicator.duplicate(from: source.rootURL, to: destination)
        XCTAssertFalse(FileManager.default.fileExists(atPath: duplicateURL.appendingPathComponent("data.sqlite-wal").path))
        XCTAssertFalse(FileManager.default.fileExists(atPath: duplicateURL.appendingPathComponent("data.sqlite-shm").path))

        let duplicate = try SlopPackage(rootURL: duplicateURL)
        let duplicateDatabase = try SlopDatabase(url: duplicate.storeURL(id: "main", kind: .sqlite))
        defer { duplicateDatabase.close() }
        let rows = try duplicateDatabase.query(
            "SELECT title FROM todos WHERE title = ?",
            parameters: ["Committed in WAL"]
        )
        XCTAssertEqual(rows.first?["title"] as? String, "Committed in WAL")
    }

    func testDuplicateLeavesJSONStoreUnchanged() throws {
        let source = try copiedFixture(named: "Todo")
        let sourceData = try Data(contentsOf: source.storeURL(id: "state", kind: .json))
        let destination = source.rootURL.deletingLastPathComponent().appendingPathComponent("JSON Duplicate.slop")

        let duplicate = try SlopPackage(rootURL: SlopDuplicator.duplicate(from: source.rootURL, to: destination))
        XCTAssertEqual(try Data(contentsOf: duplicate.storeURL(id: "state", kind: .json)), sourceData)
    }

    func testDuplicateCleansDestinationWhenSQLiteSnapshotFails() throws {
        let source = try copiedFixture(named: "SQLiteTodo")
        try Data("not a sqlite database".utf8).write(
            to: source.storeURL(id: "main", kind: .sqlite),
            options: .atomic
        )
        let destination = source.rootURL.deletingLastPathComponent().appendingPathComponent("Broken Duplicate.slop")

        XCTAssertThrowsError(try SlopDuplicator.duplicate(from: source.rootURL, to: destination))
        XCTAssertFalse(FileManager.default.fileExists(atPath: destination.path))
    }

    private func copiedFixture(named name: String) throws -> SlopPackage {
        let source = try XCTUnwrap(Bundle.module.url(forResource: name, withExtension: "slop", subdirectory: "Fixtures"))
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("slop-core-tests-\(UUID().uuidString)")
        let destination = root.appendingPathComponent("\(name).slop")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        try FileManager.default.copyItem(at: source, to: destination)
        temporaryURLs.append(root)
        return try SlopPackage(rootURL: destination)
    }
}

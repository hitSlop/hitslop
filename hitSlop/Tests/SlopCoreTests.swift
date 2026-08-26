import AppKit
import Foundation
import SQLite3
import XCTest
#if SWIFT_PACKAGE
@testable import SlopCore
#endif

final class SlopCoreTests: XCTestCase {
    func testOpenWriteAndReadMetadata() throws {
        let package = try makeFixture()
        defer { try? FileManager.default.removeItem(at: package.deletingLastPathComponent()) }
        let database = try SlopDatabase(packageURL: package)
        XCTAssertEqual(try database.metadata().title, "Fixture")
        let result = try database.execute("INSERT INTO items(name) VALUES (?)", parameters: ["One"])
        XCTAssertEqual(result["changes"] as? Int, 1)
        XCTAssertEqual(try database.query("SELECT name FROM items").first?["name"] as? String, "One")
        XCTAssertEqual(try database.revision(), 1)
    }

    func testPreviewIsWrittenIntoThePackageForFinder() throws {
        let package = try makeFixture()
        defer { try? FileManager.default.removeItem(at: package.deletingLastPathComponent()) }
        let png = Data(base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=")!
        let database = try SlopDatabase(packageURL: package)
        try database.storePreview(png, forRevision: 1)
        try SlopPreviewIcon.install(png, into: package)
        database.close()

        let thumbnail = package.appendingPathComponent("QuickLook/Thumbnail.png")
        let preview = package.appendingPathComponent("QuickLook/Preview.png")
        XCTAssertEqual(try Data(contentsOf: preview), png)
        XCTAssertEqual(try Data(contentsOf: package.appendingPathComponent("preview.png")), png)
        XCTAssertTrue(FileManager.default.fileExists(atPath: thumbnail.path))
        XCTAssertEqual(SlopPreviewIcon.png(inPackage: package), png)

        let reread = try SlopDatabase(packageURL: package, readOnly: true)
        XCTAssertEqual(try reread.asset(path: "/preview.png")?.data, png)
    }

    func testCloneInstallsPreviewFiles() throws {
        let source = try makeFixture()
        let root = source.deletingLastPathComponent()
        defer { try? FileManager.default.removeItem(at: root) }
        let png = Data(base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=")!
        let sourceDB = try SlopDatabase(packageURL: source)
        try sourceDB.storePreview(png, forRevision: 0)
        sourceDB.close()

        let destination = root.appendingPathComponent("Copy.slop")
        _ = try SlopPackage.clone(from: source, to: destination, title: "Copy")
        XCTAssertEqual(try Data(contentsOf: destination.appendingPathComponent("QuickLook/Preview.png")), png)
        XCTAssertTrue(FileManager.default.fileExists(atPath: destination.appendingPathComponent("QuickLook/Thumbnail.png").path))
    }

    func testDocumentIconIsSquare() throws {
        let png = try sampleCardPNG(width: 80, height: 120)
        let icon = try XCTUnwrap(SlopPreviewIcon.documentIcon(from: png, cornerRadius: 22))
        XCTAssertEqual(icon.size.width, CGFloat(SlopPreviewIcon.iconPixelSize))
        XCTAssertEqual(icon.size.height, CGFloat(SlopPreviewIcon.iconPixelSize))
    }

    func testCloneReplacesEmptySavePanelPackage() throws {
        let source = try makeFixture()
        let root = source.deletingLastPathComponent()
        defer { try? FileManager.default.removeItem(at: root) }
        let destination = root.appendingPathComponent("Copy.slop")
        try FileManager.default.createDirectory(at: destination, withIntermediateDirectories: true)
        let clone = try SlopPackage.clone(from: source, to: destination, title: "Copy")
        XCTAssertEqual(clone, destination)
        XCTAssertTrue(FileManager.default.fileExists(atPath: clone.appendingPathComponent(slopDatabaseName).path))
    }

    func testPackAuthoringFolder() throws {
        let source = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("TemplateSources/Habit Tracker")
        XCTAssertTrue(FileManager.default.fileExists(atPath: source.appendingPathComponent("view.html").path))
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let destination = root.appendingPathComponent("Habit Tracker.slop")
        let packed = try SlopPackage.pack(from: source, to: destination)
        let database = try SlopDatabase(packageURL: packed, readOnly: true)
        XCTAssertEqual(try database.metadata().title, "Habit Tracker")
        XCTAssertTrue(try database.mainHTML().contains("Habit Tracker"))
        XCTAssertNotNil(try database.asset(path: "/preview.png"))
        XCTAssertFalse(try database.docs().isEmpty)
        XCTAssertTrue(FileManager.default.fileExists(atPath: packed.appendingPathComponent("preview.png").path))
        database.close()
    }

    func testCloneUsesBackupAndMintsIdentity() throws {
        let source = try makeFixture()
        let root = source.deletingLastPathComponent()
        defer { try? FileManager.default.removeItem(at: root) }
        let destination = root.appendingPathComponent("Copy.slop")
        let clone = try SlopPackage.clone(from: source, to: destination, title: "Copy")
        let originalDB = try SlopDatabase(packageURL: source, readOnly: true)
        let cloneDB = try SlopDatabase(packageURL: clone, readOnly: true)
        XCTAssertNotEqual(try originalDB.metadata()["document_id"], try cloneDB.metadata()["document_id"])
        XCTAssertEqual(try cloneDB.metadata().title, "Copy")
    }

    func testDataVersionObservesAnotherConnection() throws {
        let package = try makeFixture()
        defer { try? FileManager.default.removeItem(at: package.deletingLastPathComponent()) }
        let observer = try SlopDatabase(packageURL: package, readOnly: true)
        let before = try observer.dataVersion()
        let writer = try SlopDatabase(packageURL: package)
        try writer.execute("INSERT INTO items(name) VALUES (?)", parameters: ["External"])
        XCTAssertNotEqual(try observer.dataVersion(), before)
    }

    func testQueryRejectsMutation() throws {
        let package = try makeFixture()
        defer { try? FileManager.default.removeItem(at: package.deletingLastPathComponent()) }
        let database = try SlopDatabase(packageURL: package)
        XCTAssertThrowsError(try database.query("INSERT INTO items(name) VALUES ('Nope')"))
        XCTAssertEqual(try database.query("SELECT count(*) AS count FROM items").first?["count"] as? Int64, 0)
    }

    func testRestrictedHostConnectionStillAllowsDocumentWrites() throws {
        let package = try makeFixture()
        defer { try? FileManager.default.removeItem(at: package.deletingLastPathComponent()) }
        let database = try SlopDatabase(packageURL: package, restricted: true)

        let result = try database.execute(
            "INSERT INTO items(name) VALUES (?)",
            parameters: ["Clicked"]
        )

        XCTAssertEqual(result["changes"] as? Int, 1)
        XCTAssertEqual(try database.query("SELECT name FROM items").first?["name"] as? String, "Clicked")
        XCTAssertEqual(try database.revision(), 1)
    }

    private func makeFixture() throws -> URL {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let package = root.appendingPathComponent("Fixture.slop")
        try FileManager.default.createDirectory(at: package, withIntermediateDirectories: true)
        let sqliteURL = package.appendingPathComponent(slopDatabaseName)
        var handle: OpaquePointer?
        guard sqlite3_open(sqliteURL.path, &handle) == SQLITE_OK else { throw SlopError.sqlite("fixture open failed") }
        defer { sqlite3_close(handle) }
        let sql = """
        PRAGMA application_id = 1397509968;
        PRAGMA user_version = 2;
        CREATE TABLE slop_meta(key TEXT PRIMARY KEY,value ANY);
        CREATE TABLE slop_view(path TEXT PRIMARY KEY,mime TEXT NOT NULL,body TEXT NOT NULL);
        CREATE TABLE slop_docs(topic TEXT PRIMARY KEY,body TEXT NOT NULL);
        CREATE TABLE slop_assets(path TEXT PRIMARY KEY,mime TEXT NOT NULL,body BLOB NOT NULL);
        CREATE TABLE items(id INTEGER PRIMARY KEY,name TEXT NOT NULL);
        INSERT INTO slop_meta VALUES('format','slop/2'),('document_id','source-id'),('title','Fixture'),('revision','0');
        INSERT INTO slop_view VALUES('/','text/html','<!doctype html><title>Fixture</title>');
        """
        guard sqlite3_exec(handle, sql, nil, nil, nil) == SQLITE_OK else { throw SlopError.sqlite("fixture schema failed") }
        return package
    }

    private func sampleCardPNG(width: Int, height: Int) throws -> Data {
        guard let rep = NSBitmapImageRep(
            bitmapDataPlanes: nil,
            pixelsWide: width,
            pixelsHigh: height,
            bitsPerSample: 8,
            samplesPerPixel: 4,
            hasAlpha: true,
            isPlanar: false,
            colorSpaceName: .deviceRGB,
            bytesPerRow: 0,
            bitsPerPixel: 0
        ) else {
            throw SlopError.invalidArgument("Could not create sample PNG.")
        }
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
        NSColor.systemPink.setFill()
        NSBezierPath(rect: NSRect(x: 0, y: 0, width: width, height: height)).fill()
        NSGraphicsContext.restoreGraphicsState()
        guard let data = rep.representation(using: .png, properties: [:]) else {
            throw SlopError.invalidArgument("Could not encode sample PNG.")
        }
        return data
    }
}

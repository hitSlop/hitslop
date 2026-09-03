import CoreGraphics
import Foundation
import ImageIO
import SQLite3
import Testing
@testable import HitSlopCore

@Test func rejectsTraversal() { #expect(!SlopPackage.isSafeRelativePath("../data.json")); #expect(SlopPackage.isSafeRelativePath("stores/data.json")) }
@Test func hashIsStable() { #expect(SlopArchive.sha256(of: Data("hello".utf8)) == "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824") }

@Test func validatesSchemaAndRuntimeBoundary() throws {
    let root = try fixture(); defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    #expect(throws: Never.self) { _ = try SlopPackage(rootURL: root) }
    try Data("{}".utf8).write(to: root.appendingPathComponent("package.json"))
    #expect(throws: SlopPackageError.self) { _ = try SlopPackage(rootURL: root) }
}

@Test func allowsHostFinderIconOnlyInDocuments() throws {
    let root = try fixture(); defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    try Data().write(to: root.appendingPathComponent("Icon\r"))
    #expect(throws: Never.self) { _ = try SlopPackage(rootURL: root) }
    #expect(throws: SlopPackageError.self) { try SlopPackage(rootURL: root).validateAsTemplate(requirePreview: false) }
    try Data().write(to: root.appendingPathComponent("other-icon"))
    #expect(throws: SlopPackageError.self) { _ = try SlopPackage(rootURL: root) }
}

@Test func duplicateKeepsManifestIdenticalAndStartsWithoutStores() throws {
    let source = try fixture(), temporary = source.deletingLastPathComponent(); defer { try? FileManager.default.removeItem(at: temporary) }
    try SlopDuplicator.makeImmutable(source)
    let destination = temporary.appendingPathComponent("copy.slop")
    try SlopDuplicator.duplicate(from: source, to: destination)
    #expect(try Data(contentsOf: source.appendingPathComponent("manifest.json")) == Data(contentsOf: destination.appendingPathComponent("manifest.json")))
    #expect(!FileManager.default.fileExists(atPath: destination.appendingPathComponent("stores").path))
    let sourceMode = try FileManager.default.attributesOfItem(atPath: source.path)[.posixPermissions] as? NSNumber
    let destinationMode = try FileManager.default.attributesOfItem(atPath: destination.path)[.posixPermissions] as? NSNumber
    #expect((sourceMode?.intValue ?? 0) & 0o222 == 0)
    #expect((destinationMode?.intValue ?? 0) & 0o200 != 0)
    try FileManager.default.createDirectory(at: destination.appendingPathComponent("stores"), withIntermediateDirectories: true)
    try Data(#"{}"#.utf8).write(to: destination.appendingPathComponent("stores/data.json"))
}

@Test func duplicateDocumentPreservesCanonicalStores() throws {
    let source = try fixture(), temporary = source.deletingLastPathComponent(); defer { try? FileManager.default.removeItem(at: temporary) }
    try FileManager.default.createDirectory(at: source.appendingPathComponent("stores"), withIntermediateDirectories: true)
    try Data(#"{"count":3}"#.utf8).write(to: source.appendingPathComponent("stores/data.json"))
    let database = try SlopDatabaseFixture(url: source.appendingPathComponent("stores/data.sqlite"))
    try database.write()
    let media = source.appendingPathComponent("stores/media", isDirectory: true)
    try FileManager.default.createDirectory(at: media, withIntermediateDirectories: true)
    try writeSkin(to: media.appendingPathComponent("hero"), width: 2, height: 2)
    let destination = temporary.appendingPathComponent("document-copy.slop")
    try SlopDuplicator.duplicate(from: source, to: destination)
    #expect(try Data(contentsOf: destination.appendingPathComponent("stores/data.json")) == Data(#"{"count":3}"#.utf8))
    #expect(FileManager.default.fileExists(atPath: destination.appendingPathComponent("stores/data.sqlite").path))
    #expect(!FileManager.default.fileExists(atPath: destination.appendingPathComponent("stores/data.sqlite-wal").path))
    #expect(FileManager.default.fileExists(atPath: destination.appendingPathComponent("stores/media/hero").path))
}

@Test func namedMediaStoresValidateImagesAndReplaceAtomically() throws {
    let root = try fixture(), temporary = root.deletingLastPathComponent(); defer { try? FileManager.default.removeItem(at: temporary) }
    let input = temporary.appendingPathComponent("input.png")
    try writeSkin(to: input, width: 2, height: 2)
    let store = SlopMediaStore(directoryURL: root.appendingPathComponent("stores/media", isDirectory: true))
    let first = try store.write("hero", base64: Data(contentsOf: input).base64EncodedString())
    #expect(try store.open("hero").exists)
    #expect(try store.open("hero").revision == first)
    #expect(throws: SlopPackageError.self) { _ = try store.write("../hero", base64: Data(contentsOf: input).base64EncodedString()) }
    #expect(throws: SlopPackageError.self) { _ = try store.write("bad", base64: Data("not an image".utf8).base64EncodedString()) }
    #expect(throws: Never.self) { _ = try SlopPackage(rootURL: root) }
    try store.remove("hero")
    #expect(try !store.open("hero").exists)
}

@Test func namedMediaStoresAcceptBoundedZIPArchives() throws {
    let root = try fixture(), temporary = root.deletingLastPathComponent(); defer { try? FileManager.default.removeItem(at: temporary) }
    let encoded = "UEsDBBQAAAAIAG1VIV3uQOUFCQAAAAcAAAAIAAAATUFJTi5CTVBLy6woKS1KBQBQSwECFAAUAAAACABtVSFd7kDlBQkAAAAHAAAACAAAAAAAAAAAAAAAAAAAAAAATUFJTi5CTVBQSwUGAAAAAAEAAQA2AAAALwAAAAAA"
    let archive = try #require(Data(base64Encoded: encoded))
    let store = SlopMediaStore(directoryURL: root.appendingPathComponent("stores/media", isDirectory: true))
    let revision = try store.write("skin", base64: encoded)
    #expect(try store.open("skin").revision == revision)
    #expect(try SlopMediaStore.mediaMIMEType(archive) == "application/zip")
    #expect(throws: SlopPackageError.self) { _ = try store.write("bad", base64: Data("not media".utf8).base64EncodedString()) }
    #expect(throws: Never.self) { _ = try SlopPackage(rootURL: root) }
}

@Test func documentsAllowOnlyCanonicalLazyStores() throws {
    let root = try fixture(); defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    try FileManager.default.createDirectory(at: root.appendingPathComponent("stores"), withIntermediateDirectories: true)
    try Data("{}\n".utf8).write(to: root.appendingPathComponent("stores/data.json"))
    try Data(":root { --slop-accent: tomato; }\n".utf8).write(to: root.appendingPathComponent("stores/theme.css"))
    try Data(#"{"type":"object"}"#.utf8).write(to: root.appendingPathComponent("data.schema.json"))
    #expect(throws: Never.self) { _ = try SlopPackage(rootURL: root) }
    #expect(throws: SlopPackageError.self) { try SlopPackage(rootURL: root).validateAsTemplate(requirePreview: false) }
    try Data("{}\n".utf8).write(to: root.appendingPathComponent("stores/state.json"))
    #expect(throws: SlopPackageError.self) { _ = try SlopPackage(rootURL: root) }
}

@Test func rejectsInvalidSchemaMetadataAndThemeEncoding() throws {
    let root = try fixture(); defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    try Data("not json".utf8).write(to: root.appendingPathComponent("data.schema.json"))
    #expect(throws: (any Error).self) { _ = try SlopPackage(rootURL: root) }
    try FileManager.default.removeItem(at: root.appendingPathComponent("data.schema.json"))
    try FileManager.default.createDirectory(at: root.appendingPathComponent("stores"), withIntermediateDirectories: true)
    try Data([0xff]).write(to: root.appendingPathComponent("stores/theme.css"))
    #expect(throws: SlopPackageError.self) { _ = try SlopPackage(rootURL: root) }
}

@Test func rejectsNoncanonicalSchemaMetadataNames() throws {
    let root = try fixture(); defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    try Data(#"{"type":"object"}"#.utf8).write(to: root.appendingPathComponent("schema.json"))
    #expect(throws: SlopPackageError.self) { _ = try SlopPackage(rootURL: root) }
}

@Test func validatesCanonicalEmbeddedDocumentSkill() throws {
    let root = try fixture(); defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    let skill = root.appendingPathComponent(".agents/skills/hitslop-document/SKILL.md")
    #expect(throws: Never.self) { _ = try SlopPackage(rootURL: root) }
    try Data("changed".utf8).write(to: skill)
    #expect(throws: SlopPackageError.self) { _ = try SlopPackage(rootURL: root) }
}

@Test func rejectsPackageWithoutDocumentSkill() throws {
    let root = try fixture(); defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    try FileManager.default.removeItem(at: root.appendingPathComponent(".agents"))
    #expect(throws: SlopPackageError.self) { _ = try SlopPackage(rootURL: root) }
}

@Test func validatesSkinPixelsAndAlpha() throws {
    let root = try fixture(skin: true); defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    #expect(throws: Never.self) { _ = try SlopPackage(rootURL: root) }
    try writeSkin(to: root.appendingPathComponent("assets/skin.png"), width: 319, height: 240)
    #expect(throws: SlopPackageError.self) { _ = try SlopPackage(rootURL: root) }
}

@Test func templatesRequireTwoIndependentlyValidStaticPreviews() throws {
    let root = try fixture(); defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    let quickLook = root.appendingPathComponent("QuickLook", isDirectory: true)
    try FileManager.default.createDirectory(at: quickLook, withIntermediateDirectories: true)
    let png = Data(base64Encoded: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")!
    try png.write(to: quickLook.appendingPathComponent("Preview.png"))
    #expect(throws: SlopPackageError.self) { try SlopPackage(rootURL: root).validateAsTemplate() }
    try writeSkin(to: quickLook.appendingPathComponent("Icon.png"), width: 512, height: 512)
    #expect(throws: Never.self) { try SlopPackage(rootURL: root).validateAsTemplate() }
    try writeSkin(to: quickLook.appendingPathComponent("Icon.png"), width: 2, height: 1)
    #expect(throws: SlopPackageError.self) { try SlopPackage(rootURL: root).validateAsTemplate() }
    try Data("different".utf8).write(to: quickLook.appendingPathComponent("Icon.png"))
    #expect(throws: SlopPackageError.self) { try SlopPackage(rootURL: root).validateAsTemplate() }
}

private func fixture(skin: Bool = false) throws -> URL {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent("hitslop-core-\(UUID().uuidString)", isDirectory: true)
    let root = directory.appendingPathComponent("tiny-counter.slop", isDirectory: true)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    try Data("<html><head></head><body></body></html>".utf8).write(to: root.appendingPathComponent("app.html"))
    let presentation = skin ? #"{"width":320,"height":240,"skin":"assets/skin.png"}"# : #"{"width":320,"height":240}"#
    let manifest = #"{"$schema":"https://api.hitslop.com/schemas/v1/manifest.schema.json","slug":"tiny-counter","title":"Tiny Counter","description":"Counts things.","categories":["utilities"],"presentation":\#(presentation)}"#
    try Data(manifest.utf8).write(to: root.appendingPathComponent("manifest.json"))
    try writeCanonicalDocumentSkill(to: root)
    if skin { try FileManager.default.createDirectory(at: root.appendingPathComponent("assets"), withIntermediateDirectories: true); try writeSkin(to: root.appendingPathComponent("assets/skin.png"), width: 320, height: 240) }
    return root
}

private func writeCanonicalDocumentSkill(to root: URL) throws {
    let skill = root.appendingPathComponent(".agents/skills/hitslop-document/SKILL.md")
    try FileManager.default.createDirectory(at: skill.deletingLastPathComponent(), withIntermediateDirectories: true)
    try SlopPackage.canonicalDocumentSkillData().write(to: skill)
}

private func writeSkin(to url: URL, width: Int, height: Int) throws {
    let bytes = Data(repeating: 255, count: width * height * 4)
    guard let provider = CGDataProvider(data: bytes as CFData),
          let image = CGImage(width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue), provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent),
          let destination = CGImageDestinationCreateWithURL(url as CFURL, "public.png" as CFString, 1, nil) else { throw SlopPackageError.invalid("could not create test skin") }
    CGImageDestinationAddImage(destination, image, nil)
    guard CGImageDestinationFinalize(destination) else { throw SlopPackageError.invalid("could not write test skin") }
}

private final class SlopDatabaseFixture {
    private var handle: OpaquePointer?

    init(url: URL) throws {
        guard sqlite3_open(url.path, &handle) == SQLITE_OK else { throw SlopPackageError.invalid("could not create test database") }
        guard sqlite3_exec(handle, "PRAGMA journal_mode=WAL", nil, nil, nil) == SQLITE_OK else { throw SlopPackageError.invalid("could not enable test WAL") }
    }

    deinit { sqlite3_close(handle) }

    func write() throws {
        guard sqlite3_exec(handle, "CREATE TABLE items (value INTEGER); INSERT INTO items VALUES (3)", nil, nil, nil) == SQLITE_OK else {
            throw SlopPackageError.invalid("could not write test database")
        }
    }
}

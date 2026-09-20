import CoreGraphics
import Foundation
import ImageIO
import Testing
import ZIPFoundation
@testable import HitSlopCore

@Test func rejectsTraversal() { #expect(!SlopPackage.isSafeRelativePath("../data.json")); #expect(SlopPackage.isSafeRelativePath("stores/data.json")) }
@Test func hashIsStable() { #expect(SlopArchive.sha256(of: Data("hello".utf8)) == "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824") }

@Test func damagedOptionalGuidanceDoesNotBlockOpening() throws {
    let root = try fixture(); defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    let skill = root.appendingPathComponent(".agents/skills/hitslop-document/SKILL.md")
    try FileManager.default.removeItem(at: skill)
    #expect(throws: Never.self) { _ = try SlopPackage(rootURL: root) }
    try Data("guidance".utf8).write(to: skill)
    let references = skill.deletingLastPathComponent().appendingPathComponent("references")
    try FileManager.default.createDirectory(at: references, withIntermediateDirectories: true)
    try Data([0xff]).write(to: references.appendingPathComponent("app-guide.md"))
    #expect(throws: Never.self) { _ = try SlopPackage(rootURL: root) }
    #expect(throws: SlopPackageError.self) { try SlopPackage(rootURL: root).validateAsTemplate(requirePreview: false) }
}

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

@Test func documentMediaIsImmutableAndVerified() throws {
    let root = try fixture(), temporary = root.deletingLastPathComponent(); defer { try? FileManager.default.removeItem(at: temporary) }
    let input = temporary.appendingPathComponent("input.png")
    try writeSkin(to: input, width: 2, height: 2)
    let bytes = try Data(contentsOf: input)
    let store = SlopMediaStore(directoryURL: root.appendingPathComponent("stores/media", isDirectory: true))
    let first = try store.add(bytes, imageOnly: true)
    #expect(try store.open(first.sha256))
    #expect(try store.read(first.sha256) == bytes)
    #expect(try store.add(bytes).sha256 == first.sha256)
    #expect(try FileManager.default.contentsOfDirectory(atPath: store.url(for: first.sha256).deletingLastPathComponent().path).count == 1)
    #expect(throws: SlopPackageError.self) { _ = try store.open("../photo") }
    #expect(throws: SlopPackageError.self) { _ = try store.add(Data("not an image".utf8)) }
    #expect(throws: SlopPackageError.self) { _ = try SlopPackage(rootURL: root) } // media imports are deferred in v1
    try Data("corrupt".utf8).write(to: store.url(for: first.sha256))
    #expect(throws: SlopPackageError.self) { _ = try store.read(first.sha256) }
    #expect(throws: SlopPackageError.self) { _ = try store.add(bytes) }
}

@Test func documentMediaAcceptsBoundedZIPArchivesOnlyForFiles() throws {
    let root = try fixture(), temporary = root.deletingLastPathComponent(); defer { try? FileManager.default.removeItem(at: temporary) }
    let encoded = "UEsDBBQAAAAIAG1VIV3uQOUFCQAAAAcAAAAIAAAATUFJTi5CTVBLy6woKS1KBQBQSwECFAAUAAAACABtVSFd7kDlBQkAAAAHAAAACAAAAAAAAAAAAAAAAAAAAAAATUFJTi5CTVBQSwUGAAAAAAEAAQA2AAAALwAAAAAA"
    let archive = try #require(Data(base64Encoded: encoded))
    let store = SlopMediaStore(directoryURL: root.appendingPathComponent("stores/media", isDirectory: true))
    let reference = try store.add(base64: encoded, imageOnly: false)
    #expect(try store.open(reference.sha256))
    #expect(reference.mime == "application/zip")
    #expect(throws: SlopPackageError.self) { _ = try store.add(archive, imageOnly: true) }
    #expect(throws: SlopPackageError.self) { _ = try store.add(Data("not media".utf8)) }
    #expect(throws: SlopPackageError.self) { _ = try SlopPackage(rootURL: root) } // media imports are deferred in v1
}

@Test func rejectsInvalidSchemaMetadataButOpensDamagedMutableTheme() throws {
    let root = try fixture(); defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    try Data("not json".utf8).write(to: root.appendingPathComponent("data.schema.json"))
    #expect(throws: (any Error).self) { _ = try SlopPackage(rootURL: root) }
    try FileManager.default.removeItem(at: root.appendingPathComponent("data.schema.json"))
    try FileManager.default.createDirectory(at: root.appendingPathComponent("stores"), withIntermediateDirectories: true)
    try Data([0xff]).write(to: root.appendingPathComponent("stores/theme.css"))
    #expect(throws: Never.self) { _ = try SlopPackage(rootURL: root) }
}

@Test func rejectsNoncanonicalSchemaMetadataNames() throws {
    let root = try fixture(); defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    try Data(#"{"type":"object"}"#.utf8).write(to: root.appendingPathComponent("schema.json"))
    #expect(throws: SlopPackageError.self) { _ = try SlopPackage(rootURL: root) }
}

@Test func manifestURIFormatDoesNotRepairInvalidAuthorURLs() throws {
    let root = try fixture(); defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    let url = root.appendingPathComponent("manifest.json")
    var manifest = try #require(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
    for authorURL in ["https://example.com/with space", "https://example.com/%zz"] {
        manifest["author"] = ["name": "Author", "url": authorURL]
        try JSONSerialization.data(withJSONObject: manifest).write(to: url)
        #expect(throws: (any Error).self) { _ = try SlopPackage(rootURL: root) }
    }
}

@Test func opensChangedEmbeddedDocumentGuidance() throws {
    let root = try fixture(); defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    let skill = root.appendingPathComponent(".agents/skills/hitslop-document/SKILL.md")
    #expect(throws: Never.self) { _ = try SlopPackage(rootURL: root) }
    try Data("changed".utf8).write(to: skill)
    #expect(throws: Never.self) { _ = try SlopPackage(rootURL: root) }
}

@Test func opensPackageWithoutDocumentSkill() throws {
    let root = try fixture(); defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    try FileManager.default.removeItem(at: root.appendingPathComponent(".agents"))
    #expect(throws: Never.self) { _ = try SlopPackage(rootURL: root) }
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
    #expect(throws: SlopPackageError.self) { try SlopPackage(rootURL: root).validateAsTemplate(requirePreview: true) }
    try writeSkin(to: quickLook.appendingPathComponent("Icon.png"), width: 512, height: 512)
    #expect(throws: Never.self) { try SlopPackage(rootURL: root).validateAsTemplate(requirePreview: true) }
    try writeSkin(to: quickLook.appendingPathComponent("Icon.png"), width: 2, height: 1)
    #expect(throws: SlopPackageError.self) { try SlopPackage(rootURL: root).validateAsTemplate(requirePreview: true) }
    try Data("different".utf8).write(to: quickLook.appendingPathComponent("Icon.png"))
    #expect(throws: SlopPackageError.self) { try SlopPackage(rootURL: root).validateAsTemplate(requirePreview: true) }
}

private func fixture(skin: Bool = false) throws -> URL {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent("hitslop-core-\(UUID().uuidString)", isDirectory: true)
    let root = directory.appendingPathComponent("tiny-counter.slop", isDirectory: true)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    try Data("<html><head></head><body></body></html>".utf8).write(to: root.appendingPathComponent("app.html"))
    try Data(#"{"format":1,"root":{"kind":"object","properties":{}}}"#.utf8).write(to: root.appendingPathComponent("state.schema.json"))
    try Data("{}".utf8).write(to: root.appendingPathComponent("initial.json"))
    let presentation = skin ? #"{"width":320,"height":240,"skin":"assets/skin.png"}"# : #"{"width":320,"height":240}"#
    let manifest = #"{"runtime":"hitslop-v1","$schema":"https://api.hitslop.com/schemas/v1/manifest.schema.json","author":{"name":"Fixture Author","url":"https://example.com"},"slug":"tiny-counter","title":"Tiny Counter","description":"Counts things.","categories":["utilities"],"presentation":\#(presentation)}"#
    try Data(manifest.utf8).write(to: root.appendingPathComponent("manifest.json"))
    try writeCanonicalDocumentSkill(to: root)
    if skin { try FileManager.default.createDirectory(at: root.appendingPathComponent("assets"), withIntermediateDirectories: true); try writeSkin(to: root.appendingPathComponent("assets/skin.png"), width: 320, height: 240) }
    return root
}

private func writeCanonicalDocumentSkill(to root: URL) throws {
    let skill = root.appendingPathComponent(".agents/skills/hitslop-document/SKILL.md")
    try FileManager.default.createDirectory(at: skill.deletingLastPathComponent(), withIntermediateDirectories: true)
    try Data(contentsOf: URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("../../../../../../packages/cli/skills/hitslop-document/SKILL.md").standardizedFileURL).write(to: skill)
}

private func writeSkin(to url: URL, width: Int, height: Int) throws {
    let bytes = Data(repeating: 255, count: width * height * 4)
    guard let provider = CGDataProvider(data: bytes as CFData),
          let image = CGImage(width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue), provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent),
          let destination = CGImageDestinationCreateWithURL(url as CFURL, "public.png" as CFString, 1, nil) else { throw SlopPackageError.invalid("could not create test skin") }
    CGImageDestinationAddImage(destination, image, nil)
    guard CGImageDestinationFinalize(destination) else { throw SlopPackageError.invalid("could not write test skin") }
}


@Test func sharedAppOmitsPrivateFilesAndDoesNotRequireCatalogPreview() throws {
    let root = try fixture()
    defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    for name in ["stores", "state"] { try FileManager.default.createDirectory(at: root.appendingPathComponent(name), withIntermediateDirectories: true) }
    try Data("private".utf8).write(to: root.appendingPathComponent("stores/theme.css"))
    try Data("private".utf8).write(to: root.appendingPathComponent("state/document.sqlite"))
    let archive = root.deletingLastPathComponent().appendingPathComponent("share.zip")
    try SlopArchive.packSharedApp(root).write(to: archive)
    let destination = root.deletingLastPathComponent().appendingPathComponent("joined.slop")
    try SlopArchive.extractDocument(archive, to: destination)
    #expect(!FileManager.default.fileExists(atPath: destination.appendingPathComponent("state").path))
    #expect(!FileManager.default.fileExists(atPath: destination.appendingPathComponent("stores").path))
    #expect(!FileManager.default.fileExists(atPath: destination.appendingPathComponent("QuickLook/Preview.png").path))
    let original = try Data(contentsOf: destination.appendingPathComponent("app.html"))
    #expect(throws: SlopPackageError.self) { try SlopArchive.extractDocument(archive, to: destination) }
    #expect(try Data(contentsOf: destination.appendingPathComponent("app.html")) == original)
}

@Test func joinRejectsExpansionBombBeforeCreatingDestination() throws {
    let root = try fixture()
    defer { try? FileManager.default.removeItem(at: root.deletingLastPathComponent()) }
    let zip = root.deletingLastPathComponent().appendingPathComponent("oversized.zip")
    let archive = try Archive(url: zip, accessMode: .create)
    try archive.addEntry(with: "assets/bomb", type: .file, uncompressedSize: Int64(26 * 1024 * 1024), compressionMethod: .deflate) { _, size in Data(repeating: 0, count: size) }
    let destination = root.deletingLastPathComponent().appendingPathComponent("joined.slop")
    #expect(throws: SlopPackageError.self) { try SlopArchive.extractDocument(zip, to: destination) }
    #expect(!FileManager.default.fileExists(atPath: destination.path))
}

private func writeV1Schema(_ root: URL) throws {
    let schema = #"{"type":"object","x-hitslop":{"version":1,"container":"map"},"properties":{"count":{"type":"integer"}},"required":["count"],"additionalProperties":true}"#
    try v1Envelope(schema).write(to: root.appendingPathComponent("data.schema.json"))
    try FileManager.default.createDirectory(at: root.appendingPathComponent("assets"), withIntermediateDirectories: true)
    try Data(#"{"count":0}"#.utf8).write(to: root.appendingPathComponent("assets/initial.json"))
}

private func v1Envelope(_ schema: String) throws -> Data {
    let application = try JSONSerialization.jsonObject(with: Data(schema.utf8))
    return try JSONSerialization.data(withJSONObject: ["type": "object", "additionalProperties": false,
        "required": ["$slop", "data"], "properties": ["data": application,
        "$slop": ["type": "object", "additionalProperties": false, "required": ["format", "documentId", "schemaHash", "authority", "baseRevision"],
        "properties": ["format": ["const": 2], "documentId": ["type": "string", "minLength": 1], "schemaHash": ["type": "string", "minLength": 1], "authority": ["type": "string", "minLength": 1], "baseRevision": ["type": "integer", "minimum": 0, "maximum": 9007199254740991]]]]])
}

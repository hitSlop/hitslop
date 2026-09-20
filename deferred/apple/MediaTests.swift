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


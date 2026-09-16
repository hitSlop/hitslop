import Foundation
import Darwin
import Testing
@testable import HitSlopCore

@Test func checkedReadsRejectLinksSpecialFilesAndOversize() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: root.appendingPathComponent("assets"), withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: root) }
    let target = root.appendingPathComponent("assets/test.txt")
    try Data("safe".utf8).write(to: target)
    #expect(try SlopFile.read(target, within: root, maximumBytes: 4) == Data("safe".utf8))
    #expect(throws: SlopPackageError.self) { _ = try SlopFile.read(target, within: root, maximumBytes: 3) }
    let link = root.appendingPathComponent("assets/link")
    try FileManager.default.createSymbolicLink(at: link, withDestinationURL: target)
    #expect(throws: SlopPackageError.self) { _ = try SlopFile.read(link, within: root) }
    let directoryLink = root.appendingPathComponent("alias")
    try FileManager.default.createSymbolicLink(at: directoryLink, withDestinationURL: root.appendingPathComponent("assets"))
    #expect(throws: SlopPackageError.self) { _ = try SlopFile.read(directoryLink.appendingPathComponent("test.txt"), within: root) }
    let fifo = root.appendingPathComponent("pipe")
    #expect(mkfifo(fifo.path, 0o600) == 0)
    #expect(throws: SlopPackageError.self) { _ = try SlopFile.read(fifo, within: root) }
    #expect(throws: SlopPackageError.self) { _ = try SlopFile.read(root.deletingLastPathComponent().appendingPathComponent("outside"), within: root) }
    #expect(try Data(contentsOf: target) == Data("safe".utf8))
}

@Test func JSONBoundsHandleEscapesDepthAndExactSize() throws {
    let valid = Data(#"{"value":"[\"{}]"}"#.utf8)
    try SlopJSONLimits.check(valid, maximumBytes: valid.count)
    #expect(throws: SlopLimitError.self) { try SlopJSONLimits.check(valid, maximumBytes: valid.count - 1) }
    try SlopJSONLimits.check(Data((String(repeating: "[", count: 64) + "0" + String(repeating: "]", count: 64)).utf8))
    #expect(throws: SlopLimitError.self) {
        try SlopJSONLimits.check(Data((String(repeating: "[", count: 65) + "0" + String(repeating: "]", count: 65)).utf8))
    }
    #expect(throws: SlopLimitError.self) { try SlopJSONLimits.checkObject(["text": String(repeating: "x", count: 1000)], maximumBytes: 100) }
}

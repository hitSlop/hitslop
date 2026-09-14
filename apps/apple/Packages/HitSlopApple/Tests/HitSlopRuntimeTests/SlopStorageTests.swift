import Foundation
import Testing
import DynamicJSON
import HitSlopCore
@testable import HitSlopRuntime

private func temporaryDirectory() -> URL {
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("hitslop-storage-\(UUID())", isDirectory: true)
    try! FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    return url
}
@Test func sharedDataConformanceFixtures() throws {
    let url = try #require(Bundle.module.url(forResource: "data-conformance", withExtension: "json", subdirectory: "Fixtures"))
    let fixtures = try #require(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [[String: Any]])
    for fixture in fixtures {
        let schema = try JSONSchema(data: JSONSerialization.data(withJSONObject: fixture["schema"]!))
        for item in fixture["cases"] as! [[String: Any]] {
            let data = try JSONSerialization.data(withJSONObject: item["value"]!, options: [.fragmentsAllowed])
            let result = try JSON(data: data).validate(with: schema, dialect: SlopJSONValidation.dialect)
            #expect(result.isValid == (item["valid"] as! Bool))
        }
    }
}

@Test func invalidThemeKeepsLastValidStylesheet() throws {
    let directory = temporaryDirectory()
    defer { try? FileManager.default.removeItem(at: directory) }
    let defaults = directory.appendingPathComponent("defaults.css"), override = directory.appendingPathComponent("theme.css")
    try Data(":root { --slop-accent: red; }".utf8).write(to: defaults)
    let store = SlopThemeStore(url: override, defaultURL: defaults)
    let valid = Data(":root { --slop-accent: blue; }".utf8)
    try valid.write(to: override)
    #expect(store.stylesheet() == valid)
    try Data("body { display: none; }".utf8).write(to: override)
    #expect(store.stylesheet() == valid)
    try Data(":root { --slop-unknown: green; }".utf8).write(to: override)
    #expect(store.stylesheet() == valid)
    try FileManager.default.removeItem(at: override)
    #expect(store.stylesheet().isEmpty)
}

@Test func watcherRefreshDetectsReplacementWithUnchangedSizeAndTimestamp() throws {
    let directory = temporaryDirectory()
    defer { try? FileManager.default.removeItem(at: directory) }
    let url = directory.appendingPathComponent("data.json")
    try Data(#"{"count":1}"#.utf8).write(to: url)
    let store = SlopProjectionObserver(url: url)
    let before = try store.revision()
    let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
    try Data(#"{"count":2}"#.utf8).write(to: url, options: .atomic)
    try FileManager.default.setAttributes([.modificationDate: attributes[.modificationDate]!], ofItemAtPath: url.path)
    #expect(try store.revision(refresh: true) != before)
}

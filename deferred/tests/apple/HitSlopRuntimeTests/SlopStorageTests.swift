import Foundation
import HitSlopCore
import HitSlopDocumentEngine
import Testing

@testable import HitSlopRuntime

private func temporaryDirectory() -> URL {
  let url = FileManager.default.temporaryDirectory.appendingPathComponent(
    "hitslop-storage-\(UUID().uuidString)", isDirectory: true)
  try! FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
  return url
}

@Test func sharedDataConformanceFixtures() throws {
  let url = try #require(
    Bundle.module.url(
      forResource: "data-conformance", withExtension: "json", subdirectory: "Fixtures"))
  let fixtures = try #require(
    JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [[String: Any]])
  for fixture in fixtures {
    let schema = String(
      decoding: try JSONSerialization.data(withJSONObject: fixture["schema"]!), as: UTF8.self)
    let engine = try StateEngine()
    defer { engine.close() }
    let wrapped = "{\"type\":\"object\",\"properties\":{\"value\":\(schema)},\"required\":[\"value\"],\"x-hitslop\":{\"version\":1,\"container\":\"map\"}}"
    if fixture["supported"] as? Bool != true {
      #expect(throws: StateEngineError.self) { try engine.configure(wrapped) }
      continue
    }
    try engine.configure(wrapped)
    for item in try #require(fixture["cases"] as? [[String: Any]]) {
      let bytes = try JSONSerialization.data(
        withJSONObject: item["value"]!, options: [.fragmentsAllowed])
      let valid =
        (try? engine.call(
          "validateData", ["{\"value\":\(String(decoding: bytes, as: UTF8.self))}"], as: String.self))
        != nil
      #expect(valid == (item["valid"] as? Bool == true), "\(fixture["name"]!) / \(item["value"]!)")
    }
  }
}

@Test func invalidThemeKeepsLastValidStylesheet() throws {
  let directory = temporaryDirectory()
  defer { try? FileManager.default.removeItem(at: directory) }
  let defaults = directory.appendingPathComponent("defaults.css")
  let override = directory.appendingPathComponent("theme.css")
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

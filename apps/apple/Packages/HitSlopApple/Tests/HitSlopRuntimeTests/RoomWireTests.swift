import Foundation
import HitSlopAPI
import Testing

@testable import HitSlopRuntime

@Suite struct RoomWireTests {
  @Test func canonicalFixturesRoundTripAndRejectMalformedMessages() throws {
    let url = try #require(
      Bundle.module.url(forResource: "room-wire", withExtension: "json", subdirectory: "Fixtures"))
    let fixtures = try #require(
      JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: [[String: Any]]])
    func decode<T: Decodable>(_ type: T.Type, _ data: Data) throws -> T {
      let engine = try StateEngine()
      defer { engine.close() }
      let _: Bool = try engine.call(
        "validateRoom",
        [
          String(decoding: data, as: UTF8.self),
          String(type == Components.Schemas.RoomClientMessage.self),
        ])
      return try JSONDecoder().decode(type, from: data)
    }
    func check<T: Codable>(_ type: T.Type, _ key: String) throws {
      for value in fixtures[key]! {
        let data = try JSONSerialization.data(withJSONObject: value, options: .sortedKeys)
        let decoded = try decode(type, data)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        #expect(try encoder.encode(decoded) == data)
      }
    }
    try check(Components.Schemas.RoomServerMessage.self, "server")
    try check(Components.Schemas.RoomClientMessage.self, "client")
    for value in fixtures["invalidServer"]! {
      let data = try JSONSerialization.data(withJSONObject: value)
      #expect(throws: (any Error).self) {
        try decode(Components.Schemas.RoomServerMessage.self, data)
      }
    }
    for value in fixtures["invalidClient"]! {
      let data = try JSONSerialization.data(withJSONObject: value)
      #expect(throws: (any Error).self) {
        try decode(Components.Schemas.RoomClientMessage.self, data)
      }
    }
  }
}

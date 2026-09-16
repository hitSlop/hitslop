import Foundation
import Testing
import HitSlopAPI

@Suite struct RoomWireTests {
    @Test func canonicalFixturesRoundTripAndRejectMalformedMessages() throws {
        let url = try #require(Bundle.module.url(forResource: "room-wire", withExtension: "json", subdirectory: "Fixtures"))
        let fixtures = try #require(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: [[String: Any]]])
        func check<T: Codable>(_ type: T.Type, _ key: String) throws {
            for value in fixtures[key]! {
                let data = try JSONSerialization.data(withJSONObject: value, options: .sortedKeys)
                let decoded = try JSONDecoder().decode(type, from: data)
                let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
                #expect(try encoder.encode(decoded) == data)
            }
        }
        try check(Components.Schemas.RoomServerMessage.self, "server")
        try check(Components.Schemas.RoomClientMessage.self, "client")
        for value in fixtures["invalidServer"]! {
            let data = try JSONSerialization.data(withJSONObject: value)
            #expect(throws: (any Error).self) { try JSONDecoder().decode(Components.Schemas.RoomServerMessage.self, from: data) }
        }
        for value in fixtures["invalidClient"]! {
            let data = try JSONSerialization.data(withJSONObject: value)
            #expect(throws: (any Error).self) { try JSONDecoder().decode(Components.Schemas.RoomClientMessage.self, from: data) }
        }
    }
}

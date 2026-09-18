import Foundation
import Testing
import HitSlopAPI
@testable import HitSlopRuntime

@Suite struct RoomWireTests {
    @Test func canonicalFixturesRoundTripAndRejectMalformedMessages() throws {
        let url = try #require(Bundle.module.url(forResource: "room-wire", withExtension: "json", subdirectory: "Fixtures"))
        let fixtures = try #require(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: [[String: Any]]])
        func decode<T: Decodable>(_ type: T.Type, _ data: Data) throws -> T {
            let message = try SlopDocumentJSON(data: data)
            // Generated Codable does not enforce numeric const; the transport does.
            if ["hello", "welcome", "execute"].contains(message["type"].string ?? "") { try SlopRoomSession.requireProtocol(message) }
            return try JSONDecoder().decode(type, from: data)
        }
        func check<T: Codable>(_ type: T.Type, _ key: String) throws {
            for value in fixtures[key]! {
                let data = try JSONSerialization.data(withJSONObject: value, options: .sortedKeys)
                let decoded = try decode(type, data)
                let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
                #expect(try encoder.encode(decoded) == data)
            }
        }
        try check(Components.Schemas.RoomServerMessage.self, "server")
        try check(Components.Schemas.RoomClientMessage.self, "client")
        for value in fixtures["invalidServer"]! {
            let data = try JSONSerialization.data(withJSONObject: value)
            #expect(throws: (any Error).self) { try decode(Components.Schemas.RoomServerMessage.self, data) }
        }
        for value in fixtures["invalidClient"]! {
            let data = try JSONSerialization.data(withJSONObject: value)
            #expect(throws: (any Error).self) { try decode(Components.Schemas.RoomClientMessage.self, data) }
        }
    }
}

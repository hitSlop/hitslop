import Foundation
import CryptoKit
import HitSlopAPI

/// Immutable retry unit. Only the document journal creates/removes these entries.
public typealias SlopLoroBatch = Components.Schemas.RoomBatch

extension SlopLoroBatch {
    public init(id: String = UUID().uuidString, data: Data) {
        self.init(id: id, hash: Self.digest(data), bytes: data.base64EncodedString())
    }
    public static func digest(_ data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
    public func decoded() throws -> Data {
        guard UUID(uuidString: id) != nil, let data = Data(base64Encoded: bytes), !data.isEmpty,
              data.base64EncodedString() == bytes, Self.digest(data) == hash else { throw SlopDocumentError("Invalid incremental batch") }
        return data
    }
}

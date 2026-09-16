import Foundation
import CryptoKit

package enum SpikeTransport: String, Codable, Sendable { case snapshot, incremental }

/// Immutable retry unit. Only the document journal creates/removes these entries.
package struct SpikeBatch: Codable, Equatable, Sendable {
    package let id: String
    package let hash: String
    package let bytes: String
    package init(id: String = UUID().uuidString, data: Data) {
        self.id = id; self.hash = Self.digest(data); self.bytes = data.base64EncodedString()
    }
    package static func digest(_ data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
    package func decoded() throws -> Data {
        guard UUID(uuidString: id) != nil, let data = Data(base64Encoded: bytes), !data.isEmpty,
              data.base64EncodedString() == bytes, Self.digest(data) == hash else { throw SpikeFailure("Invalid incremental batch") }
        return data
    }
}

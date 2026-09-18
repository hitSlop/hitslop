import Foundation

/// Fixed host metadata plus opaque JSON text. Application values are never decoded in Swift.
public struct StateSnapshot: Codable, Equatable, Sendable {
  public let json: String
  public let documentId: String
  public let schemaHash: String
  /// A JSON string token, preserving exact JavaScript identifier equality.
  public let authority: String
  public let revision: Int
  public let data: String
  public static func == (lhs: Self, rhs: Self) -> Bool {
    lhs.json.utf8.elementsEqual(rhs.json.utf8)
  }
}
public struct StateLease: Codable, Equatable, Sendable {
  public let json: String
  public let key: String
  public let expiresAt: Int
  public init(id: String, expiresAt: Int) throws {
    struct Lease: Encodable {
      let id: String
      let expiresAt: Int
    }
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
    json = String(
      decoding: try encoder.encode(Lease(id: id, expiresAt: expiresAt)), as: UTF8.self)
    key = String(decoding: try encoder.encode(id), as: UTF8.self).utf16.map {
      $0 >= 127 ? String(format: "\\u%04x", $0) : String(UnicodeScalar($0)!)
    }.joined()
    self.expiresAt = expiresAt
  }
}
public struct StateOpening: Codable, Equatable, Sendable {
  public let json: String
  public let snapshot: StateSnapshot
  public let lease: StateLease
  public init(
    snapshot: StateSnapshot, lease: StateLease, connected: Bool? = nil, writable: Bool? = nil
  ) {
    self.snapshot = snapshot
    self.lease = lease
    let status =
      connected.map { ",\"status\":{\"connected\":\($0),\"writable\":\(writable ?? false)}" } ?? ""
    json = "{\"snapshot\":\(snapshot.json),\"lease\":\(lease.json)\(status)}"
  }
}
public struct StateRequest: Codable, Sendable {
  public let json: String
  public let canonical: String
  public let documentId: String
  public let schemaHash: String
  public let authority: String
  public let leaseKey: String
  public let requestKey: String
  public let kind: String
}
public struct StateFailure: Codable, Equatable, Sendable {
  public let code: String
  public let message: String
}
public struct StateResult: Codable, Equatable, Sendable {
  public let json: String
  public let ok: Bool
  public let revision: Int?
  public let error: StateFailure?
  public static func failure(_ code: String, _ message: String) -> Self {
    let error = StateFailure(code: code, message: message)
    struct Wire: Encodable {
      let ok: Bool
      let error: StateFailure
    }
    let json = String(
      decoding: try! JSONEncoder().encode(Wire(ok: false, error: error)), as: UTF8.self)
    return Self(json: json, ok: false, revision: nil, error: error)
  }
}
public struct StateEvaluation: Codable, Sendable {
  public let result: StateResult
  public let snapshot: StateSnapshot?
  public let receipt: String?
}
public struct StateBridgeRequest: Decodable, Sendable {
  public let nativeJSON: String
  public let requestJSON: String?
}

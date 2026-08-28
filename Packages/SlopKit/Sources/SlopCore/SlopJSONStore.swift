import CryptoKit
import Foundation

public struct SlopJSONSnapshot {
    public let value: Any
    public let revision: String
}

public final class SlopJSONStore: @unchecked Sendable {
    public static let defaultMaxBytes = 1_048_576

    public let url: URL
    public let maxBytes: Int
    private let lock = NSLock()

    public init(url: URL, maxBytes: Int = defaultMaxBytes) {
        self.url = url
        self.maxBytes = maxBytes
    }

    public func read() throws -> SlopJSONSnapshot {
        try locked {
            let data = try Data(contentsOf: url)
            guard data.count <= maxBytes else {
                throw SlopHostError.json("\(url.lastPathComponent) exceeds its \(maxBytes)-byte limit")
            }
            do {
                return SlopJSONSnapshot(
                    value: try JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed]),
                    revision: Self.revision(for: data)
                )
            } catch {
                throw SlopHostError.json("Could not decode \(url.lastPathComponent): \(error.localizedDescription)")
            }
        }
    }

    public func write(_ value: Any, expectedRevision: String?) throws -> SlopJSONSnapshot {
        try locked {
            let currentData = try Data(contentsOf: url)
            if let expectedRevision, expectedRevision != Self.revision(for: currentData) {
                throw SlopHostError.json("revision_conflict")
            }
            guard JSONSerialization.isValidJSONObject(value) else {
                throw SlopHostError.json("The value must be a JSON object or array")
            }
            var data = try JSONSerialization.data(
                withJSONObject: value,
                options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
            )
            data.append(0x0A)
            guard data.count <= maxBytes else {
                throw SlopHostError.json("The encoded value exceeds the \(maxBytes)-byte limit")
            }
            try data.write(to: url, options: .atomic)
            return SlopJSONSnapshot(value: value, revision: Self.revision(for: data))
        }
    }

    public func revision() throws -> String {
        try locked { Self.revision(for: try Data(contentsOf: url)) }
    }

    private static func revision(for data: Data) -> String {
        "sha256:" + SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    private func locked<T>(_ operation: () throws -> T) rethrows -> T {
        lock.lock()
        defer { lock.unlock() }
        return try operation()
    }
}

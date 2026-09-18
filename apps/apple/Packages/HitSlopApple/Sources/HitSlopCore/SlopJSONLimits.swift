import Foundation

public struct SlopLimitError: LocalizedError, Sendable {
    public let message: String
    public init(_ message: String) { self.message = message }
    public var errorDescription: String? { message }
}

public enum SlopJSONLimits {
    public static let documentBytes = 1024 * 1024
    public static let maximumDepth = 64
    /// Bounded protocol/storage wrappers around a document; data still has a 64-level limit.
    public static let framedDepth = maximumDepth + 4

    public static func byteLimitLabel(_ bytes: Int) -> String {
        if bytes % (1024 * 1024) == 0 { return "\(bytes / (1024 * 1024)) MiB" }
        if bytes % 1024 == 0 { return "\(bytes / 1024) KiB" }
        return "\(bytes) bytes"
    }

    /// Bounds before recursive decoding; structural validity remains the decoder's job.
    public static func check(_ data: Data, maximumBytes: Int = documentBytes, maximumDepth: Int = maximumDepth) throws {
        guard data.count <= maximumBytes else { throw SlopLimitError("JSON exceeds \(byteLimitLabel(maximumBytes)); reduce the size of the request") }
        var depth = 0, quoted = false, escaped = false
        for byte in data {
            if quoted {
                if escaped { escaped = false }
                else if byte == 92 { escaped = true }
                else if byte == 34 { quoted = false }
            } else if byte == 34 { quoted = true }
            else if byte == 91 || byte == 123 {
                depth += 1
                guard depth <= maximumDepth else { throw SlopLimitError("JSON exceeds \(maximumDepth) nesting levels") }
            } else if byte == 93 || byte == 125 { depth -= 1 }
        }
    }

    /// WebKit already decoded IPC. Walk it with a bounded stack before serializing again.
    public static func checkObject(_ value: Any, maximumBytes: Int, maximumDepth: Int = maximumDepth) throws {
        var bytes = 0
        func walk(_ value: Any, depth: Int) throws {
            if let value = value as? String { bytes += value.utf8.count + 2 }
            else if let value = value as? [String: Any] {
                guard depth < maximumDepth else { throw SlopLimitError("JSON exceeds \(maximumDepth) nesting levels") }
                bytes += 2 + max(0, value.count - 1)
                for (key, child) in value {
                    bytes += key.utf8.count + 3
                    try walk(child, depth: depth + 1)
                }
            } else if let value = value as? [Any] {
                guard depth < maximumDepth else { throw SlopLimitError("JSON exceeds \(maximumDepth) nesting levels") }
                bytes += 2 + max(0, value.count - 1)
                for child in value { try walk(child, depth: depth + 1) }
            } else { bytes += 1 }
            guard bytes <= maximumBytes else { throw SlopLimitError("Host request exceeds \(byteLimitLabel(maximumBytes)); reduce the size of the request") }
        }
        try walk(value, depth: 0)
    }
}

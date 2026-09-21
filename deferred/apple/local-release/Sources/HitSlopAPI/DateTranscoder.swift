import Foundation
import OpenAPIRuntime

/// RFC 3339 catalog timestamps may include fractional seconds (as JavaScript emits).
public struct APIDateTranscoder: DateTranscoder {
    public init() {}
    public func encode(_ date: Date) throws -> String {
        try ISO8601DateTranscoder.iso8601WithFractionalSeconds.encode(date)
    }
    public func decode(_ value: String) throws -> Date {
        do { return try ISO8601DateTranscoder.iso8601WithFractionalSeconds.decode(value) }
        catch { return try ISO8601DateTranscoder.iso8601.decode(value) }
    }
}

import Foundation

public struct SlopRuntimeVersion: Comparable, Sendable, Equatable {
    public let rawValue: String
    private let major: Int, minor: Int, patch: Int
    public init(_ value: String) throws {
        guard value.range(of: #"^[1-9][0-9]{0,8}\.(?:0|[1-9][0-9]{0,8})\.(?:0|[1-9][0-9]{0,8})(?![\s\S])"#, options: .regularExpression) != nil else {
            throw SlopPackageError.invalid("Invalid runtime version: \(value)")
        }
        let parts = value.split(separator: ".").map { Int($0)! }
        rawValue = value; major = parts[0]; minor = parts[1]; patch = parts[2]
    }
    public static func < (lhs: Self, rhs: Self) -> Bool {
        (lhs.major, lhs.minor, lhs.patch) < (rhs.major, rhs.minor, rhs.patch)
    }
    public static func select(required: String, available: [String]) throws -> String {
        let minimum = try Self(required)
        let versions = try available.map(Self.init)
        guard let selected = versions.filter({ $0.major == minimum.major && $0 >= minimum }).max() else {
            throw SlopRuntimeCompatibilityError(required: required, available: available)
        }
        return selected.rawValue
    }
}

public struct SlopRuntimeCompatibilityError: LocalizedError, Equatable, Sendable {
    public let required: String
    public let available: [String]
    public init(required: String, available: [String]) { self.required = required; self.available = available }
    public var errorDescription: String? {
        "This version of hitSlop cannot open this document. It requires runtime \(required) or a newer compatible release. Installed runtimes: \(available.isEmpty ? "none" : available.joined(separator: ", ")). Check for a hitSlop update."
    }
}

import CryptoKit
import Foundation
import ImageIO

public final class SlopMediaStore: @unchecked Sendable {
    public let directoryURL: URL

    public init(directoryURL: URL) { self.directoryURL = directoryURL }

    public static func isValidName(_ name: String) -> Bool {
        guard (1...64).contains(name.count), let first = name.first, first.isASCII, first.isLowercase, first.isLetter else { return false }
        return name.allSatisfy { character in
            character.isASCII && (character.isLowercase && character.isLetter || character.isNumber || character == "-")
        }
    }

    public func url(for name: String) throws -> URL {
        guard Self.isValidName(name) else { throw SlopPackageError.invalid("invalid media name") }
        return directoryURL.appendingPathComponent(name, isDirectory: false)
    }

    public func open(_ name: String) throws -> (exists: Bool, revision: String?) {
        let url = try url(for: name)
        guard FileManager.default.fileExists(atPath: url.path) else { return (false, nil) }
        let data = try Data(contentsOf: url)
        _ = try Self.imageMIMEType(data)
        return (true, Self.revision(data))
    }

    @discardableResult public func write(_ name: String, base64: String) throws -> String {
        guard let data = Data(base64Encoded: base64) else { throw SlopPackageError.invalid("image data is not valid base64") }
        _ = try Self.imageMIMEType(data)
        let destination = try url(for: name)
        try FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true)
        try data.write(to: destination, options: .atomic)
        return Self.revision(data)
    }

    public func remove(_ name: String) throws {
        let url = try url(for: name)
        if FileManager.default.fileExists(atPath: url.path) { try FileManager.default.removeItem(at: url) }
    }

    public func directoryRevision() throws -> String? {
        guard FileManager.default.fileExists(atPath: directoryURL.path) else { return nil }
        let urls = try FileManager.default.contentsOfDirectory(at: directoryURL, includingPropertiesForKeys: [.isRegularFileKey, .isSymbolicLinkKey]).sorted { $0.lastPathComponent < $1.lastPathComponent }
        guard !urls.isEmpty else { return nil }
        var hasher = SHA256()
        for url in urls {
            let values = try url.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey])
            guard values.isRegularFile == true, values.isSymbolicLink != true, Self.isValidName(url.lastPathComponent) else { throw SlopPackageError.invalid("invalid media store entry") }
            let data = try Data(contentsOf: url)
            _ = try Self.imageMIMEType(data)
            hasher.update(data: Data(url.lastPathComponent.utf8)); hasher.update(data: data)
        }
        return hasher.finalize().map { String(format: "%02x", $0) }.joined()
    }

    public static func imageMIMEType(_ data: Data) throws -> String {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              CGImageSourceCreateImageAtIndex(source, 0, nil) != nil,
              let type = CGImageSourceGetType(source) as String? else {
            throw SlopPackageError.invalid("selected file is not an image")
        }
        switch type {
        case "public.png": return "image/png"
        case "public.jpeg": return "image/jpeg"
        case "com.compuserve.gif": return "image/gif"
        case "org.webmproject.webp": return "image/webp"
        default: return "image/*"
        }
    }

    private static func revision(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }
}

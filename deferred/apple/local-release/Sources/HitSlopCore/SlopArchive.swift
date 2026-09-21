import Foundation
import CryptoKit
import ZIPFoundation
import HitSlopCore

public enum SlopArchive {
  public static func sha256(of data: Data) -> String {
    SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
  }
  public static func extract(
    _ archiveURL: URL, to destination: URL, expectedSHA256: String? = nil,
    requirePreview: Bool = false, replaceExisting: Bool = true
  ) throws {
    let data = try SlopFile.read(archiveURL, within: archiveURL.deletingLastPathComponent())
    guard data.count <= 25 * 1024 * 1024 else {
      throw SlopPackageError.invalid("artifact exceeds 25 MB")
    }
    if let expectedSHA256, sha256(of: data) != expectedSHA256 {
      throw SlopPackageError.invalid("artifact checksum mismatch")
    }
    let archive = try Archive(data: data, accessMode: .read)
    var total: UInt64 = 0
    var count = 0
    var paths = Set<String>()
    for entry in archive {
      count += 1
      guard count <= 256 else {
        throw SlopPackageError.invalid("archive contains more than 256 entries")
      }
      guard paths.insert(entry.path).inserted, Self.safe(entry) else {
        throw SlopPackageError.unsafeArchive(entry.path)
      }
      guard entry.uncompressedSize <= 25 * 1024 * 1024 else {
        throw SlopPackageError.invalid("archive entry exceeds 25 MB")
      }
      total += entry.uncompressedSize
      guard total <= 50 * 1024 * 1024 else {
        throw SlopPackageError.invalid("archive expands beyond 50 MB")
      }
    }
    let temporary = destination.deletingLastPathComponent().appendingPathComponent(
      ".\(UUID().uuidString).slop", isDirectory: true)
    try FileManager.default.createDirectory(at: temporary, withIntermediateDirectories: true)
    do {
      for entry in archive {
        _ = try archive.extract(entry, to: temporary.appendingPathComponent(entry.path))
      }
      let package = try SlopPackage(rootURL: temporary)
      try package.validateAsTemplate(requirePreview: requirePreview)
      if FileManager.default.fileExists(atPath: destination.path) {
        guard replaceExisting else { throw SlopPackageError.invalid("destination already exists") }
        try SlopDuplicator.makeWritable(destination)
        try FileManager.default.removeItem(at: destination)
      }
      try FileManager.default.moveItem(at: temporary, to: destination)
      try SlopDuplicator.makeImmutable(destination)
    } catch {
      try? FileManager.default.removeItem(at: temporary)
      throw error
    }
  }

  /// Join only extracts an immutable app into a new staging destination.
  public static func extractDocument(
    _ archiveURL: URL, to destination: URL, expectedSHA256: String? = nil
  ) throws {
    try SlopLocalDocument.requireLocal(destination)
    guard !FileManager.default.fileExists(atPath: destination.path) else {
      throw SlopPackageError.invalid("destination already exists")
    }
    try extract(
      archiveURL, to: destination, expectedSHA256: expectedSHA256, requirePreview: false,
      replaceExisting: false)
    try SlopDuplicator.makeWritable(destination)
  }

  public static func packSharedApp(_ root: URL) throws -> Data {
    let package = try SlopPackage(rootURL: root)
    let temporary = FileManager.default.temporaryDirectory.appendingPathComponent(
      "\(UUID().uuidString).slop", isDirectory: true)
    try FileManager.default.createDirectory(at: temporary, withIntermediateDirectories: true)
    defer {
      try? SlopDuplicator.makeWritable(temporary)
      try? FileManager.default.removeItem(at: temporary)
    }
    for path in [
      "manifest.json", "app.html", "state.schema.json", "initial.json", "assets", ".agents",
      "QuickLook/Icon.png",
    ] {
      let source = package.rootURL.appendingPathComponent(path)
      guard FileManager.default.fileExists(atPath: source.path) else { continue }
      let target = temporary.appendingPathComponent(path)
      try FileManager.default.createDirectory(
        at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
      try FileManager.default.copyItem(at: source, to: target)
    }
    try SlopPackage(rootURL: temporary).validateAsTemplate(requirePreview: false)
    return try pack(temporary)
  }

  private static func safe(_ entry: Entry) -> Bool {
    SlopPackage.isSafeRelativePath(entry.path) && entry.path.count <= 240 && entry.type != .symlink
  }

  public static func pack(_ root: URL) throws -> Data {
    _ = try SlopPackage(rootURL: root)
    let temporary = FileManager.default.temporaryDirectory.appendingPathComponent(
      "\(UUID().uuidString).slop.zip")
    defer { try? FileManager.default.removeItem(at: temporary) }
    let archive = try Archive(url: temporary, accessMode: .create)
    let files = FileManager.default.enumerator(
      at: root, includingPropertiesForKeys: [.isRegularFileKey, .isSymbolicLinkKey])
    var paths: [String] = []
    while let url = files?.nextObject() as? URL {
      let values = try url.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey])
      guard values.isSymbolicLink != true else {
        throw SlopPackageError.invalid("runtime documents cannot contain symlinks")
      }
      guard values.isRegularFile == true else { continue }
      let rootPath = root.standardizedFileURL.path
      let full = url.standardizedFileURL.path
      guard full.hasPrefix(rootPath + "/") else { continue }
      let relative = String(full.dropFirst(rootPath.count + 1))
      guard SlopPackage.isSafeRelativePath(relative) else {
        throw SlopPackageError.unsafeArchive(relative)
      }
      paths.append(relative)
    }
    for path in paths.sorted() {
      try archive.addEntry(with: path, fileURL: root.appendingPathComponent(path))
    }
    return try Data(contentsOf: temporary)
  }
}

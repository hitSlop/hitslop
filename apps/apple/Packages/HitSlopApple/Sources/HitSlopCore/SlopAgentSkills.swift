#if os(macOS)
import Darwin
import Foundation

public enum SlopAgentSkills {
    public static let managedNames = ["hitslop-authoring", "hitslop-design", "hitslop-document"]
    private static let versionKey = "agentSkillsAppVersion"

    public static func bundledSkillsURL() -> URL? {
        Bundle.module.url(forResource: "skills", withExtension: nil)
    }

    public static func defaultCacheRoot() -> URL {
        FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".hitslop/skills", isDirectory: true)
    }

    public static func defaultDiscoveryRoots() -> [URL] {
        let home = FileManager.default.homeDirectoryForCurrentUser
        return [home.appendingPathComponent(".agents/skills"), home.appendingPathComponent(".claude/skills")]
    }

    /// Passing an app version refreshes once per app update, then only repairs
    /// missing skills. A deliberate CLI sync therefore survives ordinary launches.
    @discardableResult public static func sync(
        from bundledSkills: URL? = bundledSkillsURL(),
        cacheRoot: URL = defaultCacheRoot(),
        discoveryRoots: [URL] = defaultDiscoveryRoots(),
        appVersion: String? = nil,
        defaults: UserDefaults = .standard,
        fileManager: FileManager = .default
    ) throws -> [URL] {
        let cache = cacheRoot.standardizedFileURL
        try fileManager.createDirectory(at: cache.deletingLastPathComponent(), withIntermediateDirectories: true)
        let lock = try lockSkills(cache)
        defer { Darwin.close(lock) }
        // Shared with the CLI; recover a replacement interrupted by process exit.
        let previous = URL(fileURLWithPath: cache.path + ".previous")
        if !exists(cache, fileManager), exists(previous, fileManager) {
            try fileManager.moveItem(at: previous, to: cache)
        }
        let missingOnly = appVersion != nil && defaults.string(forKey: versionKey) == appVersion
        let missing = managedNames.filter { !exists(cache.appendingPathComponent("\($0)/SKILL.md"), fileManager) }
        if !missingOnly || !missing.isEmpty {
            guard let bundledSkills else { throw SlopPackageError.missing("bundled agent skills") }
            let staging = URL(fileURLWithPath: cache.path + ".staging-" + UUID().uuidString)
            defer { try? fileManager.removeItem(at: staging) }
            if missingOnly && exists(cache, fileManager) {
                try fileManager.copyItem(at: cache, to: staging)
            } else {
                try fileManager.createDirectory(at: staging, withIntermediateDirectories: true)
            }
            for name in missingOnly ? missing : managedNames {
                let source = bundledSkills.appendingPathComponent(name)
                let skill = source.appendingPathComponent("SKILL.md")
                let values = try skill.resourceValues(forKeys: [.isRegularFileKey])
                guard values.isRegularFile == true else { throw SlopPackageError.missing("bundled skill \(name)") }
                let destination = staging.appendingPathComponent(name)
                if exists(destination, fileManager) { try fileManager.removeItem(at: destination) }
                try fileManager.copyItem(at: source, to: destination)
            }
            if exists(previous, fileManager) { try fileManager.removeItem(at: previous) }
            if exists(cache, fileManager) { try fileManager.moveItem(at: cache, to: previous) }
            do { try fileManager.moveItem(at: staging, to: cache) }
            catch {
                if exists(previous, fileManager) { try fileManager.moveItem(at: previous, to: cache) }
                throw error
            }
            try? fileManager.removeItem(at: previous)
        }
        var conflicts: [URL] = []
        for root in discoveryRoots {
            try fileManager.createDirectory(at: root, withIntermediateDirectories: true)
            for name in managedNames {
                let link = root.appendingPathComponent(name), target = cache.appendingPathComponent(name)
                if let destination = try? fileManager.destinationOfSymbolicLink(atPath: link.path) {
                    let resolved = URL(fileURLWithPath: destination, relativeTo: URL(fileURLWithPath: root.path, isDirectory: true)).standardizedFileURL.path
                    if resolved == target.path { continue }
                    if !resolved.hasPrefix(cache.path + "/") { conflicts.append(link); continue }
                    try fileManager.removeItem(at: link)
                } else if exists(link, fileManager) { conflicts.append(link); continue }
                try fileManager.createSymbolicLink(at: link, withDestinationURL: target)
            }
        }
        if let appVersion { defaults.set(appVersion, forKey: versionKey) }
        return conflicts
    }

    private static func exists(_ url: URL, _ fileManager: FileManager) -> Bool {
        fileManager.fileExists(atPath: url.path) || (try? fileManager.destinationOfSymbolicLink(atPath: url.path)) != nil
    }

    // The CLI uses the same open(O_EXLOCK) lock. The kernel releases it on exit;
    // the lock file must stay in place so all writers lock the same inode.
    private static func lockSkills(_ cache: URL) throws -> Int32 {
        for attempt in 0...40 {
            let descriptor = Darwin.open(cache.path + ".lock", O_CREAT | O_RDWR | O_EXLOCK | O_NONBLOCK, mode_t(0o600))
            if descriptor >= 0 { return descriptor }
            let code = errno
            guard code == EAGAIN, attempt < 40 else { throw POSIXError(POSIXErrorCode(rawValue: code) ?? .EIO) }
            Thread.sleep(forTimeInterval: 0.05)
        }
        throw POSIXError(.EAGAIN)
    }
}
#endif

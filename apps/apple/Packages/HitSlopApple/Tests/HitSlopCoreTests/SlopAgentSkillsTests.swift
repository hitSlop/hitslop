import Darwin
import Foundation
import Testing
@testable import HitSlopCore

@Suite struct SlopAgentSkillsTests {
    private let fm = FileManager.default

    @Test func installsSkillsAndPreservesConflictingLinksAndDirectories() throws {
        let root = temporaryRoot()
        defer { try? fm.removeItem(at: root) }
        let cache = root.appendingPathComponent("cache"), agents = root.appendingPathComponent("agents")
        let custom = agents.appendingPathComponent("hitslop-authoring")
        try fm.createDirectory(at: custom, withIntermediateDirectories: true)
        try Data("keep me".utf8).write(to: custom.appendingPathComponent("notes.md"))
        let unrelated = agents.appendingPathComponent("hitslop-design")
        try fm.createSymbolicLink(atPath: unrelated.path, withDestinationPath: "../elsewhere")
        let managed = agents.appendingPathComponent("hitslop-document")
        try fm.createSymbolicLink(atPath: managed.path, withDestinationPath: "../cache/old-document")

        let conflicts = try SlopAgentSkills.sync(cacheRoot: cache, discoveryRoots: [agents])
        #expect(conflicts.map(\.path) == [custom.path, unrelated.path])
        #expect(try String(contentsOf: custom.appendingPathComponent("notes.md"), encoding: .utf8) == "keep me")
        #expect(try fm.destinationOfSymbolicLink(atPath: unrelated.path) == "../elsewhere")
        #expect(try fm.destinationOfSymbolicLink(atPath: managed.path) == cache.appendingPathComponent("hitslop-document").path)
        for name in SlopAgentSkills.managedNames { #expect(fm.fileExists(atPath: cache.appendingPathComponent("\(name)/SKILL.md").path)) }
    }

    @Test func refreshesOncePerAppVersionAndRepairsMissingSkills() throws {
        let root = temporaryRoot(), suite = UUID().uuidString
        let defaults = try #require(UserDefaults(suiteName: suite))
        defer { try? fm.removeItem(at: root); defaults.removePersistentDomain(forName: suite) }
        let cache = root.appendingPathComponent("cache"), agents = root.appendingPathComponent("agents")
        let authoring = cache.appendingPathComponent("hitslop-authoring/SKILL.md")
        try SlopAgentSkills.sync(cacheRoot: cache, discoveryRoots: [agents], appVersion: "1", defaults: defaults)
        try Data("explicit CLI guidance".utf8).write(to: authoring)
        // No bundle is needed for a normal launch with complete installed skills.
        try SlopAgentSkills.sync(from: nil, cacheRoot: cache, discoveryRoots: [agents], appVersion: "1", defaults: defaults)
        #expect(try String(contentsOf: authoring, encoding: .utf8) == "explicit CLI guidance")
        try fm.removeItem(at: cache.appendingPathComponent("hitslop-design"))
        try fm.removeItem(at: agents.appendingPathComponent("hitslop-design"))
        try SlopAgentSkills.sync(cacheRoot: cache, discoveryRoots: [agents], appVersion: "1", defaults: defaults)
        #expect(try String(contentsOf: authoring, encoding: .utf8) == "explicit CLI guidance")
        #expect(fm.fileExists(atPath: agents.appendingPathComponent("hitslop-design/SKILL.md").path))
        try SlopAgentSkills.sync(cacheRoot: cache, discoveryRoots: [agents], appVersion: "2", defaults: defaults)
        #expect(try String(contentsOf: authoring, encoding: .utf8).contains("name: hitslop-authoring"))
    }

    @Test func failedStagingPreservesInstallationAndRetriesVersion() throws {
        let root = temporaryRoot(), suite = UUID().uuidString
        let defaults = try #require(UserDefaults(suiteName: suite))
        defer { try? fm.removeItem(at: root); defaults.removePersistentDomain(forName: suite) }
        let cache = root.appendingPathComponent("cache"), bundle = root.appendingPathComponent("incomplete")
        try SlopAgentSkills.sync(cacheRoot: cache, discoveryRoots: [], appVersion: "1", defaults: defaults)
        let authoring = cache.appendingPathComponent("hitslop-authoring/SKILL.md")
        try Data("previous guidance".utf8).write(to: authoring)
        try fm.createDirectory(at: bundle.appendingPathComponent("hitslop-authoring"), withIntermediateDirectories: true)
        try Data("replacement".utf8).write(to: bundle.appendingPathComponent("hitslop-authoring/SKILL.md"))
        #expect(throws: (any Error).self) {
            try SlopAgentSkills.sync(from: bundle, cacheRoot: cache, discoveryRoots: [], appVersion: "2", defaults: defaults)
        }
        #expect(try String(contentsOf: authoring, encoding: .utf8) == "previous guidance")
        try SlopAgentSkills.sync(cacheRoot: cache, discoveryRoots: [], appVersion: "2", defaults: defaults)
        #expect(try String(contentsOf: authoring, encoding: .utf8).contains("name: hitslop-authoring"))
    }

    @Test func activationFailureRestoresPreviousTree() throws {
        let root = temporaryRoot()
        defer { try? fm.removeItem(at: root) }
        let cache = root.appendingPathComponent("cache")
        try SlopAgentSkills.sync(cacheRoot: cache, discoveryRoots: [])
        let authoring = cache.appendingPathComponent("hitslop-authoring/SKILL.md")
        try Data("previous guidance".utf8).write(to: authoring)
        #expect(throws: (any Error).self) {
            try SlopAgentSkills.sync(cacheRoot: cache, discoveryRoots: [], fileManager: FailingActivationFileManager())
        }
        #expect(try String(contentsOf: authoring, encoding: .utf8) == "previous guidance")
        try SlopAgentSkills.sync(cacheRoot: cache, discoveryRoots: [])
    }

    @Test func recoversInterruptedActivation() throws {
        let root = temporaryRoot(), suite = UUID().uuidString
        let defaults = try #require(UserDefaults(suiteName: suite))
        defer { try? fm.removeItem(at: root); defaults.removePersistentDomain(forName: suite) }
        let cache = root.appendingPathComponent("cache")
        try SlopAgentSkills.sync(cacheRoot: cache, discoveryRoots: [], appVersion: "1", defaults: defaults)
        let authoring = cache.appendingPathComponent("hitslop-authoring/SKILL.md")
        try Data("previous guidance".utf8).write(to: authoring)
        try fm.moveItem(at: cache, to: URL(fileURLWithPath: cache.path + ".previous"))
        try SlopAgentSkills.sync(cacheRoot: cache, discoveryRoots: [], appVersion: "1", defaults: defaults)
        #expect(try String(contentsOf: authoring, encoding: .utf8) == "previous guidance")
    }

    @Test func competingUpdatesLeaveACompleteInstallation() async throws {
        let root = temporaryRoot()
        defer { try? fm.removeItem(at: root) }
        let cache = root.appendingPathComponent("cache")
        try await withThrowingTaskGroup(of: Void.self) { group in
            for _ in 0..<3 { group.addTask { try SlopAgentSkills.sync(cacheRoot: cache, discoveryRoots: []) } }
            try await group.waitForAll()
        }
        for name in SlopAgentSkills.managedNames {
            #expect(try String(contentsOf: cache.appendingPathComponent("\(name)/SKILL.md"), encoding: .utf8).contains("name: \(name)"))
        }
    }

    private func temporaryRoot() -> URL {
        fm.temporaryDirectory.appendingPathComponent("hitslop-skills-\(UUID().uuidString)", isDirectory: true)
    }
}

private final class FailingActivationFileManager: FileManager {
    override func moveItem(at srcURL: URL, to dstURL: URL) throws {
        if srcURL.lastPathComponent.contains(".staging-") { throw POSIXError(.EIO) }
        try super.moveItem(at: srcURL, to: dstURL)
    }
}

import Darwin
import Foundation
import HitSlopCore
import SQLite3
import Testing

@testable import HitSlopRuntime

private let crashSchema =
    #"{"type":"object","x-hitslop":{"version":1,"container":"map"},"properties":{"count":{"type":"integer"}},"required":["count"],"additionalProperties":true}"#
private func crashDocument(_ root: URL) throws -> SlopCommandDocument {
    try SlopCommandDocument(
        root: root, schema: SlopDocumentJSON(data: Data(crashSchema.utf8)), initial: .object(["count": .number(0)]))
}

@Test(arguments: [1, 2]) func databaseRequiresCurrentFormatAndPreservesRejectedBytes(_ version: Int) throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("v1-database-\(UUID())")
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: root) }
    let url = root.appendingPathComponent("state/document.sqlite")
    do {
        let storage = try SlopCommandStorage(root: root)
        try storage.execute("PRAGMA user_version=\(version)")
    }
    let unknown = try Data(contentsOf: url)
    #expect(throws: SlopDocumentError.self) { _ = try SlopCommandStorage(root: root) }
    #expect(try Data(contentsOf: url) == unknown)
    var db: OpaquePointer?
    #expect(sqlite3_open(url.path, &db) == SQLITE_OK)
    #expect(sqlite3_exec(db, "PRAGMA user_version=0", nil, nil, nil) == SQLITE_OK)
    sqlite3_close(db)
    let unversioned = try Data(contentsOf: url)
    #expect(throws: SlopDocumentError.self) { _ = try SlopCommandStorage(root: root) }
    #expect(try Data(contentsOf: url) == unversioned)
}

@Test(.enabled(if: ProcessInfo.processInfo.environment["HITSLOP_CRASH_CHILD"] == "1"))
func localCrashWriter() async throws {
    let root = URL(fileURLWithPath: try #require(ProcessInfo.processInfo.environment["HITSLOP_CRASH_ROOT"]))
    let document = try crashDocument(root)
    _ = try await document.apply(testRequest(document.openGuest(), ops: [testSet("count", .number(42))]))
    // Publication has acknowledged the committed edit; no close/flush follows.
    try Data(String(ProcessInfo.processInfo.processIdentifier).utf8).write(
        to: root.appendingPathComponent("committed.pid"), options: .atomic)
    try await Task.sleep(for: .seconds(30))
    Issue.record("The parent must terminate this writer after its acknowledged commit")
}

@Test(
    .enabled(
        if: ProcessInfo.processInfo.environment["HITSLOP_LOCAL_TESTS"] == "1"
            && ProcessInfo.processInfo.environment["HITSLOP_CRASH_CHILD"] == nil))
func acknowledgedEditSurvivesProcessTermination() async throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("crash-durability-\(UUID())")
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: root) }
    let process = Process()
    // Reuse the running test executable and its bundle arguments. Invoking
    // SwiftPM here would contend with the parent's package/build lock.
    process.executableURL = URL(fileURLWithPath: CommandLine.arguments[0])
    var arguments: [String] = []
    var skipValue = false
    for argument in CommandLine.arguments.dropFirst() {
        if skipValue {
            skipValue = false
            continue
        }
        if argument == "--filter" || argument == "--skip" {
            skipValue = true
            continue
        }
        arguments.append(argument)
    }
    process.arguments = arguments + ["--filter", "localCrashWriter"]
    var environment = ProcessInfo.processInfo.environment
    environment["HITSLOP_CRASH_CHILD"] = "1"
    environment["HITSLOP_CRASH_ROOT"] = root.path
    process.environment = environment
    process.standardOutput = FileHandle.nullDevice
    process.standardError = FileHandle.nullDevice
    try process.run()
    defer { if process.isRunning { process.terminate() } }
    let marker = root.appendingPathComponent("committed.pid")
    let deadline = ContinuousClock.now.advanced(by: .seconds(20))
    while !FileManager.default.fileExists(atPath: marker.path) {
        guard process.isRunning, ContinuousClock.now < deadline else {
            throw SlopDocumentError("Crash writer never acknowledged its edit")
        }
        try await Task.sleep(for: .milliseconds(50))
    }
    let pid = try #require(Int32(String(contentsOf: marker, encoding: .utf8)))
    try #require(pid > 1 && pid != ProcessInfo.processInfo.processIdentifier)
    #expect(kill(pid, SIGKILL) == 0)
    while process.isRunning { try await Task.sleep(for: .milliseconds(20)) }
    #expect(process.terminationStatus != 0)
    let reopened = try crashDocument(root)
    #expect(try await reopened.frame().data["count"] == .number(42))
    try await reopened.close()
}

#if os(macOS)
import Foundation
import Testing
@testable import HitSlopRuntime

@Test(.enabled(if: ProcessInfo.processInfo.environment["HITSLOP_WASM_PACKAGE"] != nil))
@MainActor func loroRunsUnderNativePackageScheme() async throws {
    let source = URL(fileURLWithPath: ProcessInfo.processInfo.environment["HITSLOP_WASM_PACKAGE"]!)
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("loro-smoke-\(UUID()).slop")
    try FileManager.default.copyItem(at: source, to: root)
    defer { try? FileManager.default.removeItem(at: root) }
    let session = try SlopRuntimeSession(packageURL: root)
    defer { session.close() }
    session.load()
    try await session.waitUntilReady()
    #expect(try await session.webView.evaluateJavaScript("document.querySelector('#result').textContent") as? String == "Loro mutation and snapshot round-trip passed")
}
#endif

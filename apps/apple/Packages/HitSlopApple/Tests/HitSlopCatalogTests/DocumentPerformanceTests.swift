import AppKit
import Darwin
import Foundation
import HitSlopHost
import Testing
@testable import HitSlopCatalog
#if canImport(HitSlopFeatures)
import ComposableArchitecture
import HitSlopFeatures
#endif

/// Opt-in measurement, not a timing assertion. Run alone in an optimized test host.
@Test(.enabled(if: ProcessInfo.processInfo.environment["HITSLOP_RUN_NATIVE_BENCHMARK"] == "1"))
@MainActor func documentPerformance() async throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("hitslop-benchmark-\(UUID())")
    defer { try? FileManager.default.removeItem(at: root) }
    let counts = ProcessInfo.processInfo.environment["HITSLOP_BENCHMARK_COUNTS"]?
        .split(separator: ",").compactMap { Int($0) } ?? [1, 5, 10]
    for count in counts {
        let urls = try (1...count).map { try performanceFixture(in: root.appendingPathComponent("count-\(count)"), index: $0) }
        let started = ContinuousClock.now
        #if canImport(HitSlopFeatures)
        let coordinator = withDependencies { $0.uuid = UUIDGenerator { UUID() } } operation: {
            SlopApplicationCoordinator(catalogURL: URL(string: "https://example.invalid")!, templatesURL: root.appendingPathComponent("templates"), presentsWindows: false)
        }
        for url in urls { coordinator.openDocument(url) }
        let deadline = ContinuousClock.now.advanced(by: .seconds(30))
        while coordinator.documentControllers.count < count, ContinuousClock.now < deadline { try await Task.sleep(for: .milliseconds(10)) }
        let controllers = coordinator.documentControllers
        #expect(controllers.count == count)
        #else
        let controllers = try urls.map { try SlopDocumentWindowController(packageURL: $0) }
        #endif
        for controller in controllers { try await controller.session.waitUntilReady(timeout: .seconds(30)) }
        let opening = milliseconds(ContinuousClock.now - started)
        try await Task.sleep(for: .seconds(1))
        let cpuStart = cpuSeconds()
        let idleStart = ContinuousClock.now
        try await Task.sleep(for: .seconds(2))
        let idleCPU = (cpuSeconds() - cpuStart) / (milliseconds(ContinuousClock.now - idleStart) / 1000) * 100
        let memory = residentMiB()
        var exports: [Double] = []
        for _ in 0..<3 {
            let exportStart = ContinuousClock.now
            try await controllers[0].session.flush()
            let data = try await SlopRenderer.exportPNGData(session: controllers[0].session)
            #expect(!data.isEmpty)
            exports.append(milliseconds(ContinuousClock.now - exportStart))
        }
        #if canImport(HitSlopFeatures)
        let label = "tca"
        #else
        let label = "baseline"
        #endif
        let result: [String: Any] = ["variant": label, "windows": count, "opening_ms": opening, "host_rss_mib": memory, "idle_host_cpu_percent": idleCPU, "export_median_ms": exports.sorted()[1]]
        let data = try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
        print("HITSLOP_BENCHMARK " + String(decoding: data, as: UTF8.self))
        for controller in controllers { controller.close() }
        #if canImport(HitSlopFeatures)
        let closeDeadline = ContinuousClock.now.advanced(by: .seconds(30))
        while !coordinator.store.documents.isEmpty, ContinuousClock.now < closeDeadline { try await Task.sleep(for: .milliseconds(10)) }
        #expect(coordinator.store.documents.isEmpty)
        #else
        // Standalone controllers perform the asynchronous guest flush before setting this barrier.
        for controller in controllers {
            let deadline = ContinuousClock.now.advanced(by: .seconds(30))
            while !controller.windowShouldClose(controller.window!), ContinuousClock.now < deadline { try await Task.sleep(for: .milliseconds(10)) }
        }
        #endif
        await SlopDocumentWindowController.finishAssetRefreshesForTermination()
    }
}

private func milliseconds(_ duration: Duration) -> Double {
    Double(duration.components.seconds) * 1000 + Double(duration.components.attoseconds) / 1e15
}
private func cpuSeconds() -> Double {
    var usage = rusage()
    getrusage(RUSAGE_SELF, &usage)
    return Double(usage.ru_utime.tv_sec + usage.ru_stime.tv_sec) + Double(usage.ru_utime.tv_usec + usage.ru_stime.tv_usec) / 1e6
}
private func residentMiB() -> Double {
    var info = mach_task_basic_info()
    var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size / MemoryLayout<natural_t>.size)
    let result = withUnsafeMutablePointer(to: &info) { pointer in
        pointer.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
            task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
        }
    }
    return result == KERN_SUCCESS ? Double(info.resident_size) / 1_048_576 : -1
}
private func performanceFixture(in directory: URL, index: Int) throws -> URL {
    let root = directory.appendingPathComponent("fixture-\(index).slop")
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    let manifest = #"{"$schema":"https://api.hitslop.com/schemas/v1/manifest.schema.json","runtime":"1.0.0","author":{"name":"Native benchmark"},"slug":"fixture-\#(index)","title":"Fixture \#(index)","description":"Disposable fixture","categories":["utilities"],"presentation":{"width":380,"height":280,"resizable":true}}"#
    try Data(manifest.utf8).write(to: root.appendingPathComponent("manifest.json"))
    try Data("<!doctype html><body style='font:20px system-ui;background:#f0ecff'><h1>Fixture</h1><p>Native state measurement</p><script>window.slop.ready()</script></body>".utf8).write(to: root.appendingPathComponent("app.html"))
    return root
}

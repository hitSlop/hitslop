import AppKit
import Darwin
import Foundation
import Testing
import HitSlopCore
import HitSlopRuntime
import WebKit

@testable import HitSlopHost

@Suite(.serialized) struct BenchmarkTests {
  private func footprint(_ pid: Int32) -> UInt64? {
    var usage = rusage_info_v4()
    let result = withUnsafeMutablePointer(to: &usage) { ptr in
      ptr.withMemoryRebound(to: rusage_info_t?.self, capacity: 1) {
        proc_pid_rusage(pid, RUSAGE_INFO_V4, $0)
      }
    }
    return result == 0 ? usage.ri_phys_footprint : nil
  }
  @Test(.enabled(if: ProcessInfo.processInfo.environment["HITSLOP_BENCH"] == "1")) @MainActor
  func currentRuntimeWindows() async throws {
    _ = NSApplication.shared
    var records: [[String: Any]] = []
    func writeEvidence(failure: String? = nil) throws {
      let root = String(#filePath.components(separatedBy: "/apps/apple/")[0])
      let out = URL(fileURLWithPath: root + "/.hitslop/v1-evidence")
      try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
      try JSONSerialization.data(
        withJSONObject: [
          "runtime": "hitslop-v1", "runtimeContract": 4, "loro": "1.16.2",
          "method":
            "Restored frameless window controllers with hover panels, in the Host test harness (not the catalog application). One sequential run per cell, fully rendered rows, host plus identified WebContent physical footprints; excludes GPU/network processes. Creation plus opening, warm machine. Public ABI-2 checkbox acceptance, framework rendering and durable drain. Debug helper/test bundle, not an optimized app. Absolute memory only; no matched-control percentage claim.",
          "results": records, "failure": failure as Any? ?? NSNull(),
        ], options: [.prettyPrinted, .sortedKeys]
      ).write(to: out.appendingPathComponent("native-owner-windows.json"))
    }
    let folder = FileManager.default.temporaryDirectory.appendingPathComponent(
      "hsl-bench-" + UUID().uuidString)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: folder) }
    let environment = ProcessInfo.processInfo.environment
    let rowCounts = environment["HITSLOP_BENCH_ROWS"]?.split(separator: ",").compactMap { Int($0) } ?? [1000, 5000]
    let windowCounts = environment["HITSLOP_BENCH_WINDOWS"]?.split(separator: ",").compactMap { Int($0) } ?? [1, 10, 20]
    for rows in rowCounts {
      for count in windowCounts {
        var windows: [SlopDocumentWindowController] = []
        let start = Date()
        for index in 0..<count {
          let root = folder.appendingPathComponent("\(rows)-\(count)-\(index).slop")
          try FileManager.default.copyItem(
            at: URL(fileURLWithPath:String(#filePath.components(separatedBy:"/apps/apple/")[0])+"/generated/v1/native-fixtures/quick-checklist.slop"), to: root)
          try JSONSerialization.data(withJSONObject: [
            "title": "Measurement",
            "tasks": (0..<rows).map { ["text": "Task \($0)", "done": false, "archived": false] as [String: Any] },
          ]).write(to: root.appendingPathComponent("initial.json"))
          // Capture public ctx for measurement while retaining the actual authored view.
          let app = root.appendingPathComponent("assets/app.js")
          try FileManager.default.moveItem(at: app, to: root.appendingPathComponent("assets/benchmark-authored.js"))
          try Data("""
            import authored from './benchmark-authored.js';
            export default { mount(ctx, target) {
              const view = authored.mount(ctx, target);
              globalThis.benchmarkDocument = ctx.document;
              globalThis.benchmarkRendered = () => view?.rendered?.();
              return view;
            } };
            """.utf8).write(to: app)
          windows.append(try await SlopDocumentWindowController.open(packageURL: root))
        }
        for window in windows {
          window.showWindow(nil)
          do { try await window.session.waitUntilReady() } catch {
            let message = "Benchmark \(rows) rows × \(count) windows: \(error.localizedDescription)"
            try writeEvidence(failure: message)
            throw SlopPackageError.invalid(message)
          }
          await window.waitForPresentation()
        }
        let openMS = Date().timeIntervalSince(start) * 1000
        let first = windows[0]
        let timings = try await first.session.webView.callAsyncJavaScript(
          """
          const doc = globalThis.benchmarkDocument, id = doc.current.tasks[0].$id;
          const acceptance = [], rendered = [];
          for (let i = 0; i < 100; i++) {
            const start = performance.now();
            await doc.fields.tasks.item(id).done.set(i % 2 === 0);
            acceptance.push(performance.now() - start);
            await globalThis.benchmarkRendered();
            rendered.push(performance.now() - start);
          }
          const start = performance.now(); await doc.flush();
          return { acceptance: acceptance.sort((a,b) => a-b), rendered: rendered.sort((a,b) => a-b), drainMS: performance.now()-start };
          """, arguments: [:], in: nil, contentWorld: .page) as! [String: Any]
        let acceptance = timings["acceptance"] as! [Double], rendered = timings["rendered"] as! [Double]
        let pids = Set(
          windows.compactMap { window -> Int32? in
            let key = "_webProcessIdentifier"
            guard window.session.webView.responds(to: NSSelectorFromString(key)) else { return nil }
            return (window.session.webView.value(forKey: key) as? NSNumber)?.int32Value
          })
        let samples = ([getpid()] + Array(pids)).compactMap { footprint($0) }
        let total = samples.reduce(UInt64(0), +)
        let hostBytes = footprint(getpid()) ?? 0
        let contentBytes = Array(pids).compactMap { footprint($0) }.reduce(UInt64(0), +)
        let database = first.packageURL.appendingPathComponent("state/document.sqlite")
        let bytes =
          (try FileManager.default.attributesOfItem(atPath: database.path)[.size] as! NSNumber)
          .intValue
        for window in windows { try await window.session.finish(); window.window?.orderOut(nil) }
        windows.removeAll()
        try await Task.sleep(for: .milliseconds(500))
        records.append([
          "rows": rows, "windows": count, "open_ms": openMS, "acceptance_p95_ms": acceptance[94], "rendered_p95_ms": rendered[94],
          "drain_ms": timings["drainMS"]!,
          "host_footprint_mib": Double(hostBytes) / 1_048_576,
          "webcontent_footprint_mib": Double(contentBytes) / 1_048_576,
          "host_plus_content_footprint_mib": Double(total) / 1_048_576,
          "processes_measured": samples.count, "database_bytes_after_100_edits": bytes,
          "host_footprint_after_close_mib": Double(footprint(getpid()) ?? 0) / 1_048_576,
        ])
        try writeEvidence()
      }
    }
    try writeEvidence()
  }
}

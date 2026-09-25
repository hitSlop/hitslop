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
    let folder = FileManager.default.temporaryDirectory.appendingPathComponent(
      "hsl-bench-" + UUID().uuidString)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: folder) }
    for rows in [100, 1000] {
      for count in [1, 10, 20] {
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
          windows.append(
            try SlopDocumentWindowController(packageURL: root))
        }
        for window in windows {
          window.showWindow(nil)
          var ready = false
          for _ in 0..<600 {
            if (try? await window.session.webView.evaluateJavaScript("Boolean(globalThis.__slop)")) as? Bool
              == true
            {
              ready = true
              break
            }
            try await Task.sleep(for: .milliseconds(50))
          }
          guard ready else { throw SlopPackageError.invalid("Benchmark runtime failed to become ready") }
        }
        let openMS = Date().timeIntervalSince(start) * 1000
        let first = windows[0]
        let times =
          try await first.session.webView.callAsyncJavaScript(
            """
            const schema=await fetch('/state.schema.json').then(r=>r.json());
            const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
            const base={schemaHash:JSON.stringify(canonical(schema)),documentPath:path};
            const hello=await globalThis.__slop.request({...base,id:'hello',method:'get'});const timings=[];
            for(let i=0;i<100;i++){const start=performance.now();const reply=await globalThis.__slop.request({...base,id:'edit-'+i,epoch:hello.epoch,method:'apply',op:{type:'text.replace',path:['title'],value:'Edit '+i}});if(!reply.ok)throw new Error(reply.error);timings.push(performance.now()-start)}
            for(let i=0;i<1000;i++)await globalThis.__slop.request({...base,id:'read-'+i,method:'get'});
            return timings.sort((a,b)=>a-b);
            """, arguments: ["path": first.packageURL.path], in: nil, contentWorld: .page) as! [Double]
        let pids = Set(
          windows.compactMap { window -> Int32? in
            let key = "_webProcessIdentifier"
            guard window.session.webView.responds(to: NSSelectorFromString(key)) else { return nil }
            return (window.session.webView.value(forKey: key) as? NSNumber)?.int32Value
          })
        let samples = ([getpid()] + Array(pids)).compactMap { footprint($0) }
        let total = samples.reduce(UInt64(0), +)
        let database = first.packageURL.appendingPathComponent("state/document.sqlite")
        let bytes =
          (try FileManager.default.attributesOfItem(atPath: database.path)[.size] as! NSNumber)
          .intValue
        for window in windows { try await window.session.finish(); window.window?.orderOut(nil) }
        windows.removeAll()
        try await Task.sleep(for: .milliseconds(500))
        records.append([
          "rows": rows, "windows": count, "open_ms": openMS, "durable_edit_p95_ms": times[94],
          "host_plus_content_footprint_mib": Double(total) / 1_048_576,
          "processes_measured": samples.count, "database_bytes_after_100_edits": bytes,
          "host_footprint_after_close_mib": Double(footprint(getpid()) ?? 0) / 1_048_576,
        ])
      }
    }
    let root = String(#filePath.components(separatedBy: "/apps/apple/")[0])
    let out = URL(fileURLWithPath: root + "/.hitslop/v1-evidence")
    try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
    try JSONSerialization.data(
      withJSONObject: [
        "runtime": "hitslop-v1", "loro": "1.16.1",
        "method":
          "Restored frameless window controllers with hover panels, in the Host test harness (not the catalog application). One sequential run per cell, fully rendered rows, host plus identified WebContent physical footprints; excludes GPU/network processes. Creation plus opening, warm machine. Not comparable to retired Mirror matrix.",
        "results": records,
      ], options: [.prettyPrinted, .sortedKeys]
    ).write(to: out.appendingPathComponent("restored-client-windows.json"))
  }
}

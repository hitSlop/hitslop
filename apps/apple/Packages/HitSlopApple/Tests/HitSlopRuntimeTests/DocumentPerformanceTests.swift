import Foundation
import Testing
import HitSlopCore
@testable import HitSlopRuntime

private let performanceSchema = try! SlopDocumentJSON(data: Data(#"{"type":"object","x-hitslop":{"version":1,"container":"map"},"properties":{"tasks":{"type":"array","x-hitslop":{"container":"movable-list","key":"id"},"items":{"type":"object","x-hitslop":{"container":"map"},"properties":{"id":{"type":"string"},"text":{"type":"string","x-hitslop":{"container":"text"}},"done":{"type":"boolean"}},"required":["id","text","done"]}}},"required":["tasks"]}"#.utf8))

struct DocumentPerformanceTests {
    // Opt in: HITSLOP_DOCUMENT_BENCHMARK=1 swift test --filter DocumentPerformanceTests
    @Test func editBaseline() async throws {
        guard ProcessInfo.processInfo.environment["HITSLOP_DOCUMENT_BENCHMARK"] == "1" else { return }
        let samples = Int(ProcessInfo.processInfo.environment["HITSLOP_BENCHMARK_SAMPLES"] ?? "1000") ?? 1000
        let onlyRows = ProcessInfo.processInfo.environment["HITSLOP_BENCHMARK_ROWS"].flatMap(Int.init)
        for (rows, textLength) in [(20, 32), (200, 32), (500, 32), (500, 360), (1000, 32), (10000, 32), (100000, 32)] {
            if let onlyRows, rows != onlyRows { continue }
            let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
            try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
            defer { try? FileManager.default.removeItem(at: root) }
            let initial: SlopDocumentJSON = .object(["tasks": .array((0..<rows).map {
                .object(["id": .string(String($0)), "text": .string(String(repeating: "x", count: textLength)), "done": .bool(false)])
            })])
            do { try SlopDocumentSchema(performanceSchema).validate(initial) }
            catch let error as SlopLimitError {
                print("[document performance] rows=\(rows) rejected=\(error.localizedDescription)")
                continue
            }
            let samples = rows >= 10000 ? min(samples, 3) : samples
            let document = try SlopLoroDocument(root: root, schema: performanceSchema, initial: initial)
            try await document.flush()
            var times: [Double] = []
            for index in 1...samples {
                let frame = try await document.frame()
                var items = frame.data["tasks"].array
                items[0]["done"] = .bool(index % 2 == 1)
                let start = ContinuousClock.now
                _ = try await document.apply(.init(session: "performance", sequence: index, base: frame.revision, after: .object(["tasks": .array(items)])))
                let elapsed = start.duration(to: .now).components
                times.append(Double(elapsed.seconds) * 1000 + Double(elapsed.attoseconds) / 1e15)
            }
            try await document.flush()
            times.sort()
            print("[document performance] rows=\(rows) bytes=\(try initial.encoded().count) samples=\(samples) medianMs=\(times[samples / 2]) p95Ms=\(times[Int(ceil(Double(samples) * 0.95)) - 1])")
            let work = await document.diagnostics()
            print("[document work] materializations=\(work.materializations) listSearches=\(work.listSearches) listMoves=\(work.listMoves) publications=\(work.publications) projectionWrites=\(work.projectionWrites)")
            try await document.close()
        }
    }
}

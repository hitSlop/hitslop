import AppKit
import Darwin
import Foundation
import HitSlopRuntime

private func cpuSeconds() -> Double {
  var usage = rusage()
  getrusage(RUSAGE_SELF, &usage)
  return Double(usage.ru_utime.tv_sec + usage.ru_stime.tv_sec)
    + Double(usage.ru_utime.tv_usec + usage.ru_stime.tv_usec) / 1_000_000
}

/// Actual production package/session/bridge/SQLite, with a minimal DOM consumer.
/// RSS and CPU cover the host process; WebContent processes are excluded.
@MainActor func productionBenchmark(packages: URL, output: URL) async throws {
  struct Row: Encodable {
    let documents: Int, trial: Int
    let residentBytes: UInt64
    let idleCPUSeconds: Double, idleWallSeconds: Double
    let openMs: [Double]
    let initializationMs: [Double], configurationMs: [Double]
    let largeSamplesMs: [Double], smallSamplesMs: [Double]
    let retainedOwners: Int
    let largeStages: [[String: Double]], smallStages: [[String: Double]]
  }
  final class Probe {
    weak var engine: StateEngine?
    init(_ engine: StateEngine?) { self.engine = engine }
  }
  // Match the original cold-engine gate: bundle + configure + initial validation.
  // Package I/O and utility initialization occur before the timed loop.
  let sample = packages.appendingPathComponent("small.slop")
  let envelope = try String(
    contentsOf: sample.appendingPathComponent("data.schema.json"), encoding: .utf8)
  let schema: String = try StateEngine.utility(.applicationSchema, [envelope])
  let initial = try String(
    contentsOf: sample.appendingPathComponent("assets/initial.json"), encoding: .utf8)
  struct Lifecycle: Encodable {
    var coldMs: [Double] = []
    var residentBytes: [UInt64] = []
  }
  var lifecycle = Lifecycle()
  for _ in 0..<40 {
    try autoreleasepool {
      let started = ContinuousClock.now
      let engine = try StateEngine()
      defer { engine.close() }
      try engine.configure(schema)
      let _: String = try engine.call("validateData", [initial])
      lifecycle.coldMs.append(milliseconds(started))
    }
    lifecycle.residentBytes.append(memoryBytes())
  }
  try Data(encode(lifecycle).utf8).write(
    to: output.deletingLastPathComponent().appendingPathComponent("lifecycle.json"),
    options: .atomic)
  var results: [Row] = []
  let activity = ProcessInfo.processInfo.beginActivity(
    options: [.userInitiatedAllowingIdleSystemSleep], reason: "Production state engine benchmark")
  defer { ProcessInfo.processInfo.endActivity(activity) }
  for trial in 0..<3 {
    for count in [1, 5, 10, 20] {
      progress("production trial=\(trial) documents=\(count)")
      var sessions: [SlopRuntimeSession] = []
      var probes: [Probe] = []
      var cold: [Double] = []
      var initializations: [Double] = []
      var configurations: [Double] = []
      for index in 0..<count {
        let destination = packages.appendingPathComponent(
          "document-\(trial)-\(count)-\(index).slop")
        try FileManager.default.copyItem(
          at: packages.appendingPathComponent(index == 0 ? "large.slop" : "small.slop"),
          to: destination)
        let started = ContinuousClock.now
        let session = try SlopRuntimeSession(packageURL: destination)
        session.load()
        try await session.waitUntilReady()
        cold.append(milliseconds(started))
        let metrics = try await session.document!.benchmarkMeasurements()
        initializations.append(metrics["initialization"] ?? 0)
        configurations.append(metrics["configuration"] ?? 0)
        sessions.append(session)
        probes.append(Probe(session.document?.engine))
      }
      let rss = memoryBytes()
      let idleStart = ContinuousClock.now
      let cpuStart = cpuSeconds()
      try await Task.sleep(for: .seconds(3))
      let idleCPU = cpuSeconds() - cpuStart
      let idleWall = milliseconds(idleStart) / 1000
      let completion = BenchmarkCompletion()
      var largeStages: [[String: Double]] = []
      var smallStages: [[String: Double]] = []
      func measure(_ session: SlopRuntimeSession, small: Bool) async throws -> [Double] {
        var values: [Double] = []
        var i = 0
        repeat {
          if small { try await Task.sleep(for: .milliseconds(100)) }
          let result = try await session.webView.callAsyncJavaScript(
            #"""
              const open = globalThis.benchOpen ??= await slop.document.open();
              const {data, revision, ...identity} = open.snapshot;
              const started = performance.now();
              const next = new Promise(resolve => {
                const stop = slop.document.subscribe(snapshot => {
                  if (snapshot.revision > globalThis.benchRevision) {
                    globalThis.benchRevision = snapshot.revision;
                    document.querySelector('#count').textContent = snapshot.data.tasks.filter(t => t.done).length;
                    document.body.getBoundingClientRect(); stop(); resolve(performance.now() - started);
                  }
                });
              });
              const result = await slop.document.send({...identity, leaseId:open.lease.id, requestId,
                ops:[{op:'toggle',path:[{key:'tasks'},{item:'0'},{key:'done'}]}]});
              if (!result.ok) throw new Error(JSON.stringify(result));
              return await next;
            """#, arguments: ["requestId": "sample-\(i)"], in: nil, contentWorld: .page)
          guard let sample = result as? Double else {
            throw SpikeError("Missing production sample")
          }
          if i >= 5 && i < 35 {
            values.append(sample)
            let stages = try await session.document!.benchmarkMeasurements()
            if small { smallStages.append(stages) } else { largeStages.append(stages) }
          }
          i += 1
        } while i < 35 || (!small && count > 1 && !completion.smallDone)
        if small { completion.smallDone = true }
        return values
      }
      var large: Task<[Double], Error>? = Task { [session = sessions[0]] in
        try await measure(session, small: false)
      }
      var small: Task<[Double], Error>? =
        count > 1
        ? Task { [session = sessions[1]] in try await measure(session, small: true) } : nil
      let largeSamples = try await large!.value
      let smallSamples = try await small?.value ?? []
      large = nil
      small = nil
      for session in sessions {
        try await session.finish()
        session.close()
      }
      sessions.removeAll()
      // close() cancels WebKit/FSEvents tasks; let their cleanup release owners.
      try await Task.sleep(for: .milliseconds(100))
      results.append(
        Row(
          documents: count, trial: trial, residentBytes: rss,
          idleCPUSeconds: idleCPU, idleWallSeconds: idleWall, openMs: cold,
          initializationMs: initializations, configurationMs: configurations,
          largeSamplesMs: largeSamples, smallSamplesMs: smallSamples,
          retainedOwners: probes.filter { $0.engine != nil }.count, largeStages: largeStages,
          smallStages: smallStages))
      try Data(encode(results).utf8).write(to: output, options: .atomic)
    }
  }
}

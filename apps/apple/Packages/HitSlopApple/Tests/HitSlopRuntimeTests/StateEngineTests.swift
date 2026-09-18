import Foundation
import HitSlopCore
import Testing

@testable import HitSlopRuntime
@testable import HitSlopDocumentEngine

struct StateEngineTests {
  @Test @MainActor func ownerThreadHasUserInitiatedQoSAndShutdownSuspendsTheUI() async throws {
    let lane = EngineLane()
    let gate = DispatchSemaphore(value: 0)
    let results = AsyncStream<Bool>.makeStream()
    lane.submit {
      results.continuation.yield(Thread.current.qualityOfService == .userInitiated)
      results.continuation.yield(gate.wait(timeout: .now() + 3) == .success)
      results.continuation.finish()
    }
    lane.requestStop()
    let releaseFromUI = Task { @MainActor in
      try await Task.sleep(for: .milliseconds(20))
      gate.signal()
    }
    await lane.waitUntilStoppedAsync()
    try await releaseFromUI.value
    for await succeeded in results.stream { #expect(succeeded) }
  }

  @Test func asynchronousCallsFinishWhenCloseRacesAdmission() async throws {
    let engine = try StateEngine()
    let completed = await withTaskGroup(of: Bool.self, returning: Int.self) { group in
      for index in 0..<100 {
        group.addTask {
          do {
            let value: String = try await engine.callAsync("canonical", [String(index)])
            return value == String(index)
          } catch let error as StateEngineError { return error.code == "closed" }
          catch { return false }
        }
      }
      for _ in 0..<8 { group.addTask { await engine.closeAsync(); return engine.lifetime.context == nil } }
      group.addTask { engine.close(); return engine.lifetime.context == nil }
      var count = 0
      for await success in group { if success { count += 1 } }
      return count
    }
    #expect(completed == 109)
    #expect(engine.lifetime.context == nil)
  }
  struct Fixture: Decodable {
    let name: String
    let schemaError: Bool
    let schemaJSON: String
    let envelopeJSON: String
    let stateJSON: String
    let requestJSON: String
    let expectedJSON: String?
    let code: String?
    let now: String
  }

  @Test func productionBundlePreservesJSONAndCommandSemantics() throws {
    let url = Bundle.module.url(
      forResource: "native-engine", withExtension: "json", subdirectory: "Fixtures")!
    let fixtures = try JSONDecoder().decode([Fixture].self, from: Data(contentsOf: url))
    for fixture in fixtures {
      let engine = try StateEngine()
      defer { engine.close() }
      if fixture.schemaError {
        #expect(throws: StateEngineError.self) { try engine.configure(fixture.schemaJSON) }
        continue
      }
      try engine.configure(fixture.schemaJSON)
      let request: StateRequest = try engine.call("request", [fixture.requestJSON])
      let result: StateEvaluation = try engine.call(
        "evaluate", [fixture.stateJSON, request.json, "digest", fixture.now])
      #expect(result.result.error?.code == fixture.code, "\(fixture.name)")
      if let expected = fixture.expectedJSON {
        let snapshot = try #require(result.snapshot)
        let actualJSON: String = try engine.call("canonical", [snapshot.data])
        let expectedJSON: String = try engine.call("canonical", [expected])
        // Swift String/Dictionary equality folds canonically equivalent keys.
        #expect(Array(actualJSON.utf8) == Array(expectedJSON.utf8), "\(fixture.name)")
        let bridge: StateBridgeRequest = try engine.call(
          "bridge", ["{\"method\":\"document.execute\",\"request\":\(request.json)}"])
        #expect(bridge.requestJSON?.utf8.elementsEqual(request.json.utf8) == true)
        let projection: String = try engine.call("projection", [snapshot.json])
        let lease = #"{"id":"lease","expiresAt":9999999999999}"#
        let replacement: String = try engine.call(
          "external", [projection, snapshot.json, lease, "external"])
        let roundTrip: StateEvaluation = try engine.call(
          "evaluate",
          ["{\"snapshot\":\(snapshot.json),\"lease\":\(lease)}", replacement, "replacement", "0"])
        #expect(roundTrip.snapshot?.data.utf8.elementsEqual(snapshot.data.utf8) == true)
        let seed: StateSnapshot = try engine.call(
          "seed",
          [
            "{\"protocol\":3,\"snapshot\":\(snapshot.json)}", snapshot.documentId,
            snapshot.schemaHash,
          ])
        #expect(seed.data.utf8.elementsEqual(snapshot.data.utf8))
      } else {
        #expect(result.snapshot == nil)
      }
    }
  }

  @Test func independentOwnersReleaseAndRejectCallsAfterClose() async throws {
    weak var released: StateEngine?
    for _ in 0..<10 {
      let engine = try StateEngine()
      released = engine
      let value: String = try engine.call("canonical", [#"{"b":2,"a":1}"#])
      #expect(value == #"{"a":1,"b":2}"#)
      engine.close()
      engine.close()
      #expect(engine.lifetime.context == nil)
      // JSC can finish VM cleanup asynchronously under concurrent engine load.
      // A bounded wait distinguishes that cleanup from a retained VM.
      let deadline = ContinuousClock.now.advanced(by: .seconds(2))
      while engine.lifetime.machine != nil && ContinuousClock.now < deadline {
        try await Task.sleep(for: .milliseconds(20))
      }
      #expect(engine.lifetime.machine == nil)
      #expect(throws: StateEngineError.self) {
        try engine.call("canonical", ["null"], as: String.self)
      }
    }
    #expect(released == nil)
    #expect(throws: StateEngineError.self) { try StateEngine.utf8(Data([0xff])) }
  }

  @Test func snapshotEqualityUsesExactJSONBytes() throws {
    let engine = try StateEngine()
    defer { engine.close() }
    let prefix = #"{"documentId":"d","schemaHash":"s","authority":"a","revision":0,"data":{"text":""#
    let a: StateSnapshot = try engine.call("frameSnapshot", [prefix + "é\"}}"])
    let b: StateSnapshot = try engine.call("frameSnapshot", [prefix + "e\u{0301}\"}}"])
    #expect(a != b)
  }

  @Test @MainActor func productionWebKitBridgePreservesUnicodeAndSurrogates() async throws {
    let url = Bundle.module.url(
      forResource: "native-engine", withExtension: "json", subdirectory: "Fixtures")!
    let fixtures = try JSONDecoder().decode([Fixture].self, from: Data(contentsOf: url))
    let fixture = try #require(fixtures.first { $0.name == "unicode-and-unknown-preservation" })
    let expected = try #require(fixture.expectedJSON)
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(
      "unicode-\(UUID()).slop")
    try FileManager.default.createDirectory(
      at: root.appendingPathComponent("assets"), withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: root) }
    try Data(fixture.envelopeJSON.utf8).write(to: root.appendingPathComponent("data.schema.json"))
    try Data(expected.utf8).write(to: root.appendingPathComponent("assets/initial.json"))
    try Data(
      #"{"$schema":"https://api.hitslop.com/schemas/v1/manifest.schema.json","slug":"unicode-test","title":"Unicode","description":"Boundary test","categories":["utilities"],"author":{"name":"Tests"},"presentation":{"width":320,"height":240}}"#
        .utf8
    ).write(to: root.appendingPathComponent("manifest.json"))
    try Data("<!doctype html><script>slop.ready()</script>".utf8).write(
      to: root.appendingPathComponent("app.html"))
    let session = try SlopRuntimeSession(packageURL: root)
    defer { session.close() }
    session.load()
    try await session.waitUntilReady()
    let preserved = try await session.webView.callAsyncJavaScript(
      #"""
        const open = await slop.document.open();
        const { data, revision, ...identity } = open.snapshot;
        if (JSON.stringify(data) !== expected) throw new Error('Open changed JSON');
        const changed = new Promise(resolve => {
          const stop = slop.document.subscribe(snapshot => {
            if (snapshot.revision > revision) { stop(); resolve(snapshot.data); }
          });
        });
          const request = {...identity, leaseId:open.lease.id, requestId:'\ud800',
            ops:[{op:'set',path:[{key:'record'},{key:'e\u0301'}],value:'\udfff'}]};
          const result = await slop.document.send(request);
          if (!result.ok) throw new Error(JSON.stringify(result));
          const after = await changed;
          if (JSON.stringify(await slop.document.send(request)) !== JSON.stringify(result)) throw new Error('Receipt replay changed');
        if (after['é'] !== 'composed' || after['e\u0301'] !== 'decomposed' || after.unknown !== '\ud800')
          throw new Error('Snapshot changed keys or surrogate');
        if (after.record['e\u0301'] !== '\udfff' || after.record.__proto__ !== 'ordinary') throw new Error('Record changed');
        return JSON.stringify(after);
      """#, arguments: ["expected": expected], in: nil, contentWorld: .page)
    let raw = try #require(preserved as? String)
    try await session.flush()
    let owner = try #require(session.document)
    let frame = try await owner.frame()
    #expect(raw.utf8.elementsEqual(frame.data.utf8))
    session.close()
    let reopened = try #require(try SlopCommandDocument.open(package: SlopPackage(rootURL: root)))
    #expect(try await reopened.frame().data.utf8.elementsEqual(raw.utf8))
    try await reopened.close()
  }
}

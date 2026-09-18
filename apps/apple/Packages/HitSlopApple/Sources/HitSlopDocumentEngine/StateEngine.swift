import Foundation
import JavaScriptCore

public struct StateEngineError: LocalizedError, Sendable {
  public let message: String
  public let code: String
  public init(_ message: String, code: String = "validation") {
    self.message = message
    self.code = code
  }
  public var errorDescription: String? { message }
}

// JSContext/JSValue never escape this owner thread. Its run loop gets a chance
// to service JSC deferred work even when no document has submitted a command.
final class EngineLane: @unchecked Sendable {
  private let condition = NSCondition()
  private var jobs: [@Sendable () -> Void] = []
  private var stopping = false
  private let finished = DispatchGroup()
  init() {
    finished.enter()
    let thread = Thread { [self] in
      autoreleasepool {
        let port = Port()
        RunLoop.current.add(port, forMode: .default)
        while true {
          let done = autoreleasepool {
            condition.lock()
            if jobs.isEmpty && !stopping {
              _ = condition.wait(until: Date(timeIntervalSinceNow: 0.25))
            }
            let job = jobs.isEmpty ? nil : jobs.removeFirst()
            let done = stopping && job == nil
            condition.unlock()
            job?()
            _ = RunLoop.current.run(mode: .default, before: Date())
            return done
          }
          if done { break }
        }
        RunLoop.current.remove(port, forMode: .default)
      }
      finished.leave()
    }
    thread.name = "com.hitslop.document-engine"
    thread.qualityOfService = .userInitiated
    thread.start()
  }
  func submit(_ job: @escaping @Sendable () -> Void) {
    condition.lock()
    jobs.append(job)
    condition.signal()
    condition.unlock()
  }
  private final class Box<T>: @unchecked Sendable { var result: Result<T, Error>? }
  func sync<T>(_ work: @escaping @Sendable () throws -> T) throws -> T {
    let box = Box<T>()
    let ready = DispatchSemaphore(value: 0)
    submit {
      box.result = Result { try work() }
      ready.signal()
    }
    ready.wait()
    guard let result = box.result else { throw StateEngineError("Missing lane result") }
    return try result.get()
  }
  func requestStop() {
    condition.lock()
    stopping = true
    condition.signal()
    condition.unlock()
  }
  func waitUntilStopped() { finished.wait() }
  func waitUntilStoppedAsync() async {
    await withCheckedContinuation { continuation in
      finished.notify(queue: .global(qos: .userInitiated)) { continuation.resume() }
    }
  }
  func stop() { requestStop(); waitUntilStopped() }
}

/// Trusted bundled code only. One owner per document; no application state cache.
public final class StateEngine: @unchecked Sendable {
  final class LifetimeProbe: @unchecked Sendable {
    weak var context: JSContext?
    weak var machine: JSVirtualMachine?
  }
  let lifetime = LifetimeProbe()
  private let lane = EngineLane()
  private final class Cell: @unchecked Sendable {
    var context: JSContext?
    var starts: [String: ContinuousClock.Instant] = [:]
    var stages: [String: Double] = [:]
  }
  private let cell = Cell()
  private let lock = NSLock()
  private var closed = false
  public init() throws {
    let began = ContinuousClock.now
    let instrumented = ProcessInfo.processInfo.environment["HITSLOP_ENGINE_BENCHMARK"] == "1"
    let cell = self.cell
    let lifetime = self.lifetime
    do {
      let url = Bundle.module.url(forResource: "document-engine", withExtension: "js")!
      let bundle = try String(contentsOf: url, encoding: .utf8)
      try lane.sync {
        guard let context = JSContext() else {
          throw StateEngineError("Cannot create document engine")
        }
        cell.context = context
        lifetime.context = context
        lifetime.machine = context.virtualMachine
        if instrumented {
          let trace: @convention(block) (String, Bool) -> Void = { stage, starting in
            if starting {
              if stage == "evaluation" {
                cell.stages = cell.stages.filter {
                  ["initialization", "configuration", "queue", "requestQueue"].contains($0.key)
                }
              }
              cell.starts[stage] = .now
            } else if let start = cell.starts.removeValue(forKey: stage) {
              let d = start.duration(to: .now).components
              cell.stages[stage, default: 0] +=
                Double(d.seconds) * 1000 + Double(d.attoseconds) / 1e15
            }
          }
          context.setObject(trace, forKeyedSubscript: "hitSlopTrace" as NSString)
        }
        context.evaluateScript(bundle)
        if let exception = context.exception {
          throw StateEngineError(exception.toString() ?? "Engine failed to load")
        }
        let d = began.duration(to: .now).components
        cell.stages["initialization"] = Double(d.seconds) * 1000 + Double(d.attoseconds) / 1e15
      }
    } catch {
      _ = try? lane.sync { cell.context = nil }
      lane.stop()
      closed = true
      throw error
    }
  }
  public enum UtilityMethod: String, Sendable {
    case manifest, applicationSchema, packageData, seed
  }
  private static let utilityOwner: Result<StateEngine, Error> = Result { try StateEngine() }
  public static func utility<T: Decodable & Sendable>(
    _ method: UtilityMethod, _ args: [String], as type: T.Type = T.self
  ) throws -> T {
    try utilityOwner.get().call(method.rawValue, args, as: type)
  }
  private struct WireError: Decodable {
    let code: String
    let message: String
  }
  private struct Response<T: Decodable>: Decodable {
    let value: T?
    let error: WireError?
  }
  private final class ResultBox<T>: @unchecked Sendable { var result: Result<T, Error>? }
  private static func invoke<T: Decodable>(
    _ cell: Cell, _ method: String, _ args: [String], as type: T.Type
  ) throws -> T {
    guard let context = cell.context else {
      throw StateEngineError("Document engine is closed", code: "closed")
    }
    context.exception = nil
    let value = context.objectForKeyedSubscript("hitSlopState")?.invokeMethod(
      "invoke", withArguments: [method, args])
    if let exception = context.exception {
      throw StateEngineError(exception.toString() ?? "Engine exception")
    }
    guard let value, !value.isUndefined, let json = value.toString() else {
      throw StateEngineError("Missing engine response")
    }
    let response = try JSONDecoder().decode(Response<T>.self, from: Data(json.utf8))
    if let error = response.error { throw StateEngineError(error.message, code: error.code) }
    guard let value = response.value else { throw StateEngineError("Missing engine value") }
    return value
  }
  private func enqueue(_ method: String? = nil, _ job: @escaping @Sendable () -> Void) throws {
    let enqueued = ContinuousClock.now
    lock.lock()
    defer { lock.unlock() }
    guard !closed else { throw StateEngineError("Document engine is closed", code: "closed") }
    let cell = self.cell
    lane.submit {
      let d = enqueued.duration(to: .now).components
      if method == "evaluate" || method == "request" {
        cell.stages[method == "evaluate" ? "queue" : "requestQueue"] =
          Double(d.seconds) * 1000 + Double(d.attoseconds) / 1e15
      }
      job()
    }
  }
  public func call<T: Decodable & Sendable>(
    _ method: String, _ args: [String] = [], as type: T.Type = T.self
  )
    throws -> T
  {
    let cell = self.cell
    let box = ResultBox<T>()
    let ready = DispatchSemaphore(value: 0)
    try enqueue(method) {
      box.result = Result { try Self.invoke(cell, method, args, as: T.self) }
      ready.signal()
    }
    ready.wait()
    return try box.result!.get()
  }
  public func callAsync<T: Decodable & Sendable>(
    _ method: String, _ args: [String] = [], as type: T.Type = T.self
  ) async throws -> T {
    let cell = self.cell
    return try await withCheckedThrowingContinuation { continuation in
      do {
        try enqueue(method) {
          continuation.resume(with: Result { try Self.invoke(cell, method, args, as: T.self) })
        }
      } catch { continuation.resume(throwing: error) }
    }
  }
  public static func utf8(_ bytes: Data) throws -> String {
    guard let json = String(data: bytes, encoding: .utf8) else {
      throw StateEngineError("JSON must be valid UTF-8")
    }
    return json
  }
  public func configure(_ schemaJSON: String) throws {
    let start = ContinuousClock.now
    let _: Bool = try call("configure", [schemaJSON])
    let d = start.duration(to: .now).components
    let ms = Double(d.seconds) * 1000 + Double(d.attoseconds) / 1e15
    let cell = self.cell
    try enqueue { cell.stages["configuration"] = ms }
  }
  public func benchmarkMeasurements() throws -> [String: Double] {
    lock.lock()
    defer { lock.unlock() }
    guard !closed else { throw StateEngineError("Document engine is closed", code: "closed") }
    let cell = self.cell
    return try lane.sync { cell.stages }
  }
  private func beginClose() {
    lock.lock()
    guard !closed else {
      lock.unlock()
      return
    }
    closed = true
    let cell = self.cell
    lane.submit {
      cell.context = nil
    }
    lane.requestStop()
    lock.unlock()
  }
  public func close() {
    beginClose()
    lane.waitUntilStopped()
  }
  public func closeAsync() async {
    beginClose()
    await lane.waitUntilStoppedAsync()
  }
  deinit { close() }
}

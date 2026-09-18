import AppKit
import Darwin
import Foundation
import HitSlopRuntime
import WebKit

struct SpikeError: Error, LocalizedError {
  let message: String
  init(_ message: String) { self.message = message }
  var errorDescription: String? { message }
}
func milliseconds(_ start: ContinuousClock.Instant) -> Double {
  let value = start.duration(to: .now).components
  return Double(value.seconds) * 1000 + Double(value.attoseconds) / 1e15
}
func encode<T: Encodable>(_ value: T) throws -> String {
  String(decoding: try JSONEncoder().encode(value), as: UTF8.self)
}
func decode<T: Decodable>(_ type: T.Type, _ value: String) throws -> T {
  try JSONDecoder().decode(type, from: Data(value.utf8))
}

func memoryBytes() -> UInt64 {
  var info = mach_task_basic_info()
  var count = mach_msg_type_number_t(
    MemoryLayout<mach_task_basic_info>.size / MemoryLayout<natural_t>.size)
  let result = withUnsafeMutablePointer(to: &info) {
    $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
      task_info(mach_task_self_, task_flavor_t(MACH_TASK_BASIC_INFO), $0, &count)
    }
  }
  return result == KERN_SUCCESS ? info.resident_size : 0
}
func progress(_ text: String) { FileHandle.standardError.write(Data((text + "\n").utf8)) }

@MainActor final class BenchmarkCompletion { var smallDone = false }

@main struct Spike {
  struct RPC: Decodable {
    let method: String
    let args: [String]
  }
  struct RPCReply: Encodable {
    var value: String?
    var error: String?
  }
  @MainActor static func main() async {
    do {
      let args = CommandLine.arguments
      if args.count >= 2 && args[1] == "production-rpc" {
        let engine = try StateEngine()
        defer { engine.close() }
        while let line = readLine() {
          do {
            let request = try decode(RPC.self, line)
            let value: String
            switch request.method {
            case "configure":
              value = try encode(engine.call(request.method, request.args, as: Bool.self))
            case "request":
              value = try encode(engine.call(request.method, request.args, as: StateRequest.self))
            case "evaluate":
              value = try encode(
                engine.call(request.method, request.args, as: StateEvaluation.self))
            default: throw SpikeError("Unsupported production fixture method")
            }
            print(try encode(RPCReply(value: value)))
          } catch { print(try encode(RPCReply(error: error.localizedDescription))) }
          fflush(stdout)
        }
        return
      }
      if args.count == 4 && args[1] == "production-benchmark" {
        _ = NSApplication.shared
        NSApp.setActivationPolicy(.prohibited)
        try await productionBenchmark(
          packages: URL(fileURLWithPath: args[2]), output: URL(fileURLWithPath: args[3]))
        return
      }
      throw SpikeError(
        "Usage: hitslop-javascriptcore-spike production-rpc|production-benchmark packages output.json"
      )
    } catch {
      progress("spike failed: \(error)")
      exit(1)
    }
  }
}

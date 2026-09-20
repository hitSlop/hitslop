import Foundation
import Darwin
#if DEBUG
public enum DebugStorageProbe {
  public static func run(_ args:[String]) throws {
    let index = -1
    let root = URL(fileURLWithPath: args[index + 1])
    let phase = args[index + 2]
    let marker = URL(fileURLWithPath: args[index + 3])
    let storage = try Storage(root: root)
    defer { storage.close() }
    let stop: (String) -> Void = { at in
      if at == phase {
        try! Data(at.utf8).write(to: marker)
        raise(SIGSTOP)
      }
    }
    storage.testingPhase = stop
    if phase == "hold" {
      stop("hold")
      return
    }
    let disk = try storage.call(["method": "load"])
    let generation = disk["generation"] as! String
    let bytes = try Data(contentsOf: URL(fileURLWithPath: args[index + 4])).base64EncodedString()
    if phase.hasPrefix("append:") {
      _ = try storage.call(["method": "append", "generation": generation, "updates": [bytes]])
    } else {
      _ = try storage.call([
        "method": "checkpoint", "generation": generation, "bytes": bytes,
        "schemaKey": disk["schemaKey"]!,
      ])
    }
  }
}
#endif

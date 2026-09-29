import AppKit
import ArgumentParser
import Darwin
import Foundation
import HitSlopCore
import HitSlopHost
import HitSlopRuntime
import HitSlopDocument

struct ImportJSON: AsyncParsableCommand {
  static let configuration = CommandConfiguration(commandName: "import", abstract: "Import complete JSON data into a new or existing document.")
  @Argument(transform: URL.init(fileURLWithPath:)) var document: URL
  @Option(transform: URL.init(fileURLWithPath:)) var file: URL
  @Option(name: .customLong("from"), transform: URL.init(fileURLWithPath:)) var source: URL?
  @Flag var replace = false
  @Option var ifVersion: String?

  mutating func validate() throws {
    guard (source != nil) != replace, replace ? ifVersion?.isEmpty == false : ifVersion == nil else {
      throw ValidationError("Use --from TEMPLATE or --replace --if-version TOKEN")
    }
  }

  @MainActor func run() async throws {
    throw ValidationError("unsupported_operation: JSON import is not supported in contract 4 yet. Create a document from the immutable template's initial values instead.")
  }
}

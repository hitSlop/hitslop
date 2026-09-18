import Foundation

struct Fixture: Decodable {
  let name: String
  let json: String
  let valid: Bool
}
struct Group: Decodable {
  let name: String
  let schema: String
  let formats: Bool
  let schemaValid: Bool
  let cases: [Fixture]
}
struct Input: Decodable { let groups: [Group] }
struct Observation: Encodable {
  let pass: Int
  var accepted = false
  var complete = true
  var phase = "parse"
  var parsedJSON: String?
  var outputJSON: String?
  var error: String?
}
struct Row: Encodable {
  let engine: String
  let group: String
  let name: String
  let observations: [Observation]
}
struct SchemaRow: Encodable {
  let engine: String
  let group: String
  let accepted: Bool
  let outputJSON: String?
  let error: String?
}
struct Report: Encodable {
  var schemas: [SchemaRow] = []
  var cases: [Row] = []
}

do {
  guard CommandLine.arguments.count == 3 else {
    throw SpikeError("Usage: json-schema-comparison INPUT OUTPUT")
  }
  let input = try JSONDecoder().decode(
    Input.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
  var report = Report()
  for engine in [Engine.cached, Engine.candidate] {
    for group in input.groups {
      let prepared: Prepared
      do {
        prepared = try engine.prepare(group.schema, formats: group.formats)
        report.schemas.append(
          .init(
            engine: engine.rawValue, group: group.name, accepted: true,
            outputJSON: String(decoding: try prepared.schemaJSON(), as: UTF8.self), error: nil))
      } catch {
        report.schemas.append(
          .init(
            engine: engine.rawValue, group: group.name, accepted: false, outputJSON: nil,
            error: String(describing: error)))
        continue
      }
      var observations = Array(repeating: [Observation](), count: group.cases.count)
      // Reuse the validator across the entire mixed valid/invalid sequence.
      for pass in 0..<3 {
        for (index, fixture) in group.cases.enumerated() {
          var row = Observation(pass: pass)
          do {
            let value = try engine.parse(Data(fixture.json.utf8))
            row.phase = "serialization"
            row.parsedJSON = String(decoding: try value.bytes(), as: UTF8.self)
            row.phase = "validation"
            let outcome = try prepared.validate(value)
            row.accepted = outcome.valid
            row.complete = outcome.complete
            if !outcome.valid { row.error = String(try prepared.diagnostics(value).prefix(1500)) }
            row.phase = "serialization"
            row.outputJSON = String(decoding: try value.bytes(), as: UTF8.self)
            row.phase = "validation"
          } catch {
            if row.phase != "parse" { row.complete = false }
            row.error = String(String(describing: error).prefix(1500))
          }
          observations[index].append(row)
        }
      }
      for (index, fixture) in group.cases.enumerated() {
        report.cases.append(
          .init(
            engine: engine.rawValue, group: group.name, name: fixture.name,
            observations: observations[index]))
      }
    }
  }
  let encoder = JSONEncoder()
  encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
  try encoder.encode(report).write(
    to: URL(fileURLWithPath: CommandLine.arguments[2]), options: .atomic)
  print(
    "Raw Swift comparison: \(report.cases.count) case rows; JavaScript oracle determines compatibility"
  )
} catch {
  FileHandle.standardError.write(Data("Spike infrastructure failure: \(error)\n".utf8))
  exit(2)
}

import Foundation

struct Case: Decodable { let name: String; let json: String; let valid: Bool }
struct Group: Decodable {
    let name: String; let schema: String; let formats: Bool; let schemaValid: Bool; let cases: [Case]
}
struct Workload: Decodable { let name: String; let group: String; let json: String; let valid: Bool }
struct Input: Decodable { let groups: [Group]; let benchmarks: [Workload] }
struct SchemaCheck: Encodable {
    let engine: Engine; let group: String; let expected: Bool; let accepted: Bool
    let preserved: Bool?; let matched: Bool; let error: String?
}
struct CaseCheck: Encodable {
    let engine: Engine; let group: String; let name: String; let expected: Bool
    let outcomes: [Bool]; let matched: Bool; let preserved: Bool?
    let phase: String; let diagnostics: String?
}
struct Timing: Encodable {
    let engine: Engine; let workload: String; let mode: String; let bytes: Int
    let batchMicroseconds: [Double]; let medianMicroseconds: Double
    let minimumMicroseconds: Double; let maximumMicroseconds: Double; let checksum: Int
}
struct BenchmarkError: Encodable { let engine: Engine; let workload: String; let mode: String; let error: String }
struct Report: Encodable {
    var schemas: [SchemaCheck] = []
    var cases: [CaseCheck] = []
    var timings: [Timing] = []
    var benchmarkErrors: [BenchmarkError] = []
    let warmupIterations = 20
    let batches = 5
    let iterationsPerBatch = 50
    let repeatedCorrectnessPasses = 3
    var discrepancyCount: Int {
        schemas.filter { !$0.matched }.count + cases.filter { !$0.matched }.count + benchmarkErrors.count
    }
}

func check(_ input: Input, report: inout Report) {
    for engine in Engine.allCases {
        for group in input.groups {
            let prepared: Prepared
            do {
                prepared = try engine.prepare(group.schema, formats: group.formats)
                let preserved = try canonical(prepared.schemaJSON()) == canonical(Data(group.schema.utf8))
                report.schemas.append(.init(engine: engine, group: group.name, expected: group.schemaValid,
                    accepted: true, preserved: preserved, matched: group.schemaValid && preserved, error: nil))
            } catch {
                report.schemas.append(.init(engine: engine, group: group.name, expected: group.schemaValid,
                    accepted: false, preserved: nil, matched: !group.schemaValid, error: String(describing: error)))
                continue
            }
            // Repeat all cases on the SAME prepared validator, including valid/invalid transitions.
            var rows: [[Bool]] = Array(repeating: [], count: group.cases.count)
            var preservation: [Bool?] = Array(repeating: nil, count: group.cases.count)
            var issues: [String?] = Array(repeating: nil, count: group.cases.count)
            var phases = Array(repeating: "validation", count: group.cases.count)
            var completed = Array(repeating: true, count: group.cases.count)
            for pass in 0..<3 {
                for (index, item) in group.cases.enumerated() {
                    let bytes = Data(item.json.utf8)
                    let value: Value
                    do { value = try engine.parse(bytes) }
                    catch {
                        rows[index].append(false)
                        phases[index] = "parse"
                        issues[index] = String(describing: error)
                        if (try? JSONSerialization.jsonObject(with: bytes, options: [.fragmentsAllowed])) != nil {
                            completed[index] = false
                        }
                        continue
                    }
                    do {
                        let original = try canonical(bytes)
                        let before = try canonical(value.bytes())
                        let outcome = try prepared.validate(value)
                        rows[index].append(outcome.valid)
                        completed[index] = completed[index] && outcome.complete
                        let preserved = try before == original && canonical(value.bytes()) == original
                        preservation[index] = (preservation[index] ?? true) && preserved
                        if pass == 0 && !outcome.valid {
                            issues[index] = String(try prepared.diagnostics(value).prefix(8000))
                        }
                    } catch {
                        rows[index].append(false)
                        completed[index] = false
                        phases[index] = "evaluation-error"
                        issues[index] = String(describing: error)
                    }
                }
            }
            for (index, item) in group.cases.enumerated() {
                report.cases.append(.init(engine: engine, group: group.name, name: item.name, expected: item.valid,
                    outcomes: rows[index], matched: rows[index].count == 3 && rows[index].allSatisfy { $0 == item.valid }
                        && completed[index] && preservation[index] != false,
                    preserved: preservation[index], phase: phases[index], diagnostics: issues[index]))
            }
        }
    }
}

func measure(engine: Engine, workload: String, mode: String, bytes: Int,
             operation: () throws -> Int) throws -> Timing {
    var checksum = 0
    for _ in 0..<20 { checksum &+= try operation() }
    var batches: [Double] = []
    for _ in 0..<5 {
        let start = DispatchTime.now().uptimeNanoseconds
        for _ in 0..<50 { checksum &+= try operation() }
        let elapsed = DispatchTime.now().uptimeNanoseconds - start
        batches.append(Double(elapsed) / 1000 / 50)
    }
    let sorted = batches.sorted()
    return Timing(engine: engine, workload: workload, mode: mode, bytes: bytes,
        batchMicroseconds: batches, medianMicroseconds: sorted[2], minimumMicroseconds: sorted[0],
        maximumMicroseconds: sorted[4], checksum: checksum)
}

func benchmark(_ input: Input, report: inout Report) {
    for name in ["manifest", "bridge", "checklist"] {
        guard let group = input.groups.first(where: { $0.name == name }) else { continue }
        for engine in Engine.allCases {
            do {
                let timing = try measure(engine: engine, workload: name, mode: "schema-prepare", bytes: group.schema.utf8.count) {
                    let prepared = try engine.prepare(group.schema, formats: group.formats)
                    return withExtendedLifetime(prepared) { 1 }
                }
                report.timings.append(timing)
            } catch {
                report.benchmarkErrors.append(.init(engine: engine, workload: name, mode: "schema-prepare", error: String(describing: error)))
            }
        }
    }
    for (offset, workload) in input.benchmarks.enumerated() {
        guard let group = input.groups.first(where: { $0.name == workload.group }) else { continue }
        print("Benchmark: \(workload.name)")
        fflush(stdout)
        let engines = Engine.allCases
        // Rotate order across workloads to reduce a systematic first/last advantage.
        for engine in (0..<engines.count).map({ engines[($0 + offset) % engines.count] }) {
            for mode in ["validate-parsed", "parse-and-validate"] {
                do {
                    let prepared = try engine.prepare(group.schema, formats: group.formats)
                    let bytes = Data(workload.json.utf8)
                    let parsed = try engine.parse(bytes)
                    let timing = try measure(engine: engine, workload: workload.name, mode: mode, bytes: bytes.count) {
                        let value = try mode == "validate-parsed" ? parsed : engine.parse(bytes)
                        let result = try prepared.validate(value)
                        guard result.complete, result.valid == workload.valid else {
                            throw SpikeError("Benchmark correctness failure: expected \(workload.valid), got \(result.valid), complete \(result.complete)")
                        }
                        return result.valid ? 1 : 2
                    }
                    report.timings.append(timing)
                } catch {
                    report.benchmarkErrors.append(.init(engine: engine, workload: workload.name, mode: mode, error: String(describing: error)))
                }
            }
        }
    }
}

do {
    guard CommandLine.arguments.count == 3 else { throw SpikeError("Usage: json-schema-comparison INPUT.json OUTPUT.json") }
    let input = try JSONDecoder().decode(Input.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
    var report = Report()
    check(input, report: &report)
    print("Correctness: \(report.cases.count) cases, \(report.schemas.count) schema checks, \(report.discrepancyCount) discrepancies")
    fflush(stdout)
    benchmark(input, report: &report)
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
    try encoder.encode(report).write(to: URL(fileURLWithPath: CommandLine.arguments[2]), options: .atomic)
    print("Completed: \(report.timings.count) timings, \(report.discrepancyCount) discrepancies")
    exit(report.discrepancyCount == 0 ? 0 : 1)
} catch {
    FileHandle.standardError.write(Data("Spike failed: \(error)\n".utf8))
    exit(2)
}

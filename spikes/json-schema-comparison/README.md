# Swift JSON Schema comparison

An isolated experiment comparing hitSlop's DynamicJSON 1.0.2 with
swift-json-schema 0.14.1. See [FINDINGS.md](FINDINGS.md) for measured results.
No production dependency, schema, or persistence changes are made by this runner.

## Run

From the repository root, with the repository's Bun dependencies installed and
Swift 6.2 or newer on macOS 14 or newer (measured with Swift 6.4):

```sh
bun spikes/json-schema-comparison/run.ts first
bun spikes/json-schema-comparison/run.ts second
```

The optional argument names the results file; it defaults to `latest`.
The runner resolves the pinned Swift packages, prepares fixtures under `.build/`,
runs a release executable, and writes `results/<label>.json`. The package lockfile
also pins transitive dependencies. Only the `JSONSchema` product is linked from
the candidate package; SwiftPM still resolves its package-level SwiftSyntax dependency.
The pinned Swift Collections 1.6.0 dependency requires Swift 6.2 even though the
candidate package itself declares Swift 6.1.

Exit codes: **0** means all comparison checks matched; **1** means differences
were recorded; **2** means the Swift runner failed before completing its report.
Build or fixture preparation failures also return nonzero. A library incompatibility
is a useful result, not a reason to weaken expectations. Reports are produced after
all cases and workloads have been attempted; timings with incorrect outcomes are omitted.

## Inputs and checks

`run.ts` reads the existing shared document conformance cases, generated native
manifest/bridge schemas, and actual Quick Checklist manifest. It imports the
checklist's TypeBox schema and initial data and exports the application schema
without building a `.slop` or changing generated production files. Source hashes
and the combined fixture hash are recorded in results.

Additional cases cover invalid manifests and bridge requests, malformed JSON and
schemas, missing/wrongly typed fields, unknown nested fields, and the bridge's
annotation-only format policy. All document/manifest format checks use each
library's built-ins with the same custom URI/URI-reference rules as hitSlop.
The candidate requires explicitly registering its built-in format validators.

Each prepared validator sees the full case sequence three times. The runner
checks expected validity, complete evaluation, JSON value preservation, and schema
round-trip preservation, including `x-hitslop`. Native diagnostics are collected
outside timed loops and capped at 8,000 characters per failing case.
JSON comparisons ignore whitespace and object key order using Foundation
canonicalization; this is not a test of exact numeric literal or byte preservation.

Schema checks use DynamicJSON's validating decoder and the candidate's explicit
`validateAgainstMetaSchema()`. Candidate `Schema.jsonValue` is deliberately tested
as its schema-export API; preserving the original source separately is a possible
migration adaptation, not silently substituted in this experiment.

The experiment does not exercise Loro, SQLite, native UI, concurrent validation,
remote schema fetching, or hitSlop's additional list-ID/container rules. It is a
focused compatibility corpus, not a complete JSON Schema conformance certification.

## Timing methodology

Three adapters run against identical input bytes:

| Adapter | Preparation | Per-validation work |
| --- | --- | --- |
| `dynamic-current` | Decode `JSONSchema` | Current convenience API, including fresh dialect/resource/registry/validator setup |
| `dynamic-reused` | Decode schema, retain registry/resource/validator | Reuse prepared validator |
| `jsonschema-reused` | Parse schema, register formats, validate against metaschema | Reuse prepared `Schema` |

`schema-prepare` measures the respective adapter's preparation, including schema
validation and destruction. It is not a claim that all three constructors do equal
work; DynamicJSON's current path defers work to validation. Dependency initialization
and disk-cold loading are excluded by warm-up.

`validate-parsed` reuses a library-native JSON value. `parse-and-validate` parses
identical in-memory UTF-8 bytes on every operation. Both include native validation
result construction and correctness checks, but exclude diagnostic rendering,
input/output file access, and setup. Host JSON encoding, Loro work, and bridge IPC
are outside these timings.

Workloads are valid/invalid manifest and bridge requests plus deterministic
10/100/1,000-task checklists, with the invalid field on the final task. Every
measurement uses 20 warm-ups, then five batches of 50 iterations. Reports contain
each batch's mean microseconds per operation, their median and range, and a consumed
checksum. These are batch statistics, not per-request percentiles. Engine order
rotates across workloads. Run sequentially without other heavy work and compare
the two recorded runs before drawing conclusions.

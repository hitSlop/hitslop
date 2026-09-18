# JSON compatibility spike

Compares the current TypeBox contract with cached DynamicJSON 1.0.2,
swift-json-schema 0.14.1, and hitSlop's actual native document adapter.
See [FINDINGS.md](FINDINGS.md) for results and proposed follow-up work.
The runner changes no production behavior or dependency versions. The boundary and
record fixes measured by the follow-up reports are implemented in production code.

## Run

Use macOS 14+, Swift 6.2+, and the repository's installed Bun dependencies.
The pinned Swift Collections dependency requires Swift 6.2 even though the
candidate library declares Swift 6.1. From the repository root, run sequentially:

```sh
bun test ./spikes/json-schema-comparison/oracle.test.ts ./spikes/json-schema-comparison/fixtures.test.ts
bun spikes/json-schema-comparison/run.ts boundaries-fixed-first
bun spikes/json-schema-comparison/run.ts boundaries-fixed-second
bun spikes/json-schema-comparison/compare-runs.ts boundaries-fixed-first boundaries-fixed-second boundaries-fixed-stability
```

Run both comparisons even when the first exits **1**: that means a completed
report contains compatibility differences. Exit **0** means every expectation
matched; **2** means the driver encountered an infrastructure failure.
The stability command separately returns 0 when both runs agree. Its optional third
argument names the stability output so earlier reports remain intact. It does not
claim the adapters are compatible.

The optional label defaults to `compatibility-latest`. Historical labels `first`
and `second` are protected. The runner writes fixtures and raw Swift observations
under ignored `.build/`, then writes `results/<label>.json`. It builds the standalone
Swift comparison in release mode and invokes an opt-in test in the Apple package
in debug mode. This is a correctness comparison, not a performance comparison.

`JSONCompatibilitySpikeTests.swift` lives in the existing runtime test target so
it can exercise internal production APIs without exposing new public APIs or
copying implementation into the spike. It is skipped unless
`HITSLOP_JSON_SPIKE_INPUT` is set; the driver also sets
`HITSLOP_JSON_SPIKE_OUTPUT`. Its assertions check successful report generation;
the TypeScript driver applies the compatibility gate to the observations.

## Corpus and adapters

The driver reads shared data conformance fixtures and the current generated bridge
schema. It imports Quick Checklist's authored schema and initial data directly.
Current bridge cases use `document.execute` and content-addressed `media.open`.
Additional authored document schemas cover Unicode values and keys, recursive
references, formats, malformed JSON, nonmutation, numeric representation, and
record keys containing control characters.

Each prepared validator sees the entire mixed valid/invalid sequence three times:

| Adapter | Path exercised |
| --- | --- |
| `typebox-compiled` | Installed workspace TypeBox `Compile` |
| `typebox-interpreted` | Installed workspace TypeBox `Check` |
| `dynamic-reused` | Standalone DynamicJSON with retained validator |
| `jsonschema-reused` | Standalone candidate with explicit metaschema and format setup |
| `native-document` | Production `SlopDocumentJSON` → `SlopDocumentSchema.prepare` |

The native adapter runs authored document groups; generic shared schemas remain
unwrapped so their reference scopes do not change. Native bridge dispatch is not
executed. Document formats are asserted. The current bridge schema contains no
format keywords, so this corpus does not test its annotation-only format policy.
The candidate uses its built-in format validators plus the host's URI rules.
Invalid schemas are explicitly checked during preparation.

Raw JSON strings are kept until each adapter parses them. The JavaScript oracle
compares exact strings and property names, ignores object order and whitespace,
and preserves array order. It intentionally uses guest IEEE-754 number semantics:
`-0` equals `0`, and large literals are compared after JavaScript parsing, not for
exact decimal spelling. Foundation canonicalization is not used as an oracle.
Tests demonstrate that combining Unicode keys and unpaired surrogates cannot
silently disappear or normalize in the comparison.

`application-schema` cases assert the intended authored contract: every record
value must match its value schema. A validator can correctly follow a defective
emitted schema and still fail that expectation. `portability` cases expose a
cross-runtime policy mismatch, rather than asserting universal JSON validity.
The overflow literal `1e400` must be rejected for hitSlop's finite-number contract;
it is exempt from preservation because it has no finite guest value to preserve.

Before/after serialized values detect loss on accepted and rejected inputs. The
report distinguishes schema export, parsing, validation, and serialization phases.
`parse-or-initial-serialization` deliberately does not claim which of those two
steps lost data; source inspection can narrow it further. Diagnostics are capped
at 1,500 characters per observation. Final reports retain input/output hashes
instead of full serialized payloads.

## Native boundaries

Depths 60–65 and encoded byte sizes immediately below, at, and above 1 MiB run
through production document preparation and SQLite command storage. Plain and
escaped strings have identical intended encoded sizes. Checks include bridge
request limits, validation, reopening through a fresh storage connection, retry
receipts, disk projection envelopes, room snapshot and ready frames, and rollback on rejection.

Twenty map levels followed by an atomic subtree allow a small command to create
a deep candidate. This reaches document limits without first exceeding command
nesting limits. Near-1-MiB full replacement requests exceed the separate 1-MiB
bridge budget because of request overhead; authority validation is exercised
separately. Disk and room checks encode/decode the production envelope shapes;
they do not run WebKit, network transport, a Durable Object, or the full projection
coordinator. SQLite persistence and receipt handling use production code.

## Repeatability and historical measurements

Reports record fixture hashes, relevant source and lockfile hashes, installed
TypeBox version, toolchain, OS, and Git commit. Source hashes matter because a
working tree may differ from its commit. `compare-runs.ts` checks identical inputs,
sources, semantic outcomes, and stable repeated sequences. It ignores diagnostic
wording and raw serialization hashes, since object order is immaterial.

Fresh timings are deferred while correctness differences remain. The original
[first report](results/first.json) and [second report](results/second.json) are
preserved as historical microbenchmarks. They used the older protocol/corpus and
Foundation-based comparison, and do not establish current end-to-end behavior.
Their methodology and conclusions remain in the historical section of FINDINGS.

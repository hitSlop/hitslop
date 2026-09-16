# Document editing performance

This pass keeps native Loro for private and shared documents, the existing bridge
messages, SQLite durability, and historical-base external JSON merges. It removes
recursive generic-JSON checks from bridge envelopes, caches schema mappings and
native projections, skips list reconciliation when identity/order is unchanged,
shares equal frozen guest subtrees, and separates Svelte data from status updates.
Projection file writes now coalesce; accepted edits still commit synchronously to
SQLite, including their recoverable pending projection.

## Reproduce

```sh
bun run --cwd packages/schema build
bun run --cwd packages/runtime build
bun scripts/document-benchmark.ts 100
HITSLOP_DOCUMENT_BENCHMARK=1 HITSLOP_BENCHMARK_SAMPLES=20 swift test --package-path apps/apple/Packages/HitSlopApple --filter DocumentPerformanceTests
```

The Swift benchmark defaults to 1,000 edits per fixture. Set
`HITSLOP_BENCHMARK_ROWS=500` to select a row count. Both benchmarks cap the
10,000-row case at three edits and report rejected fixtures separately. Fixtures
include 20, 200, 500, 1,000, 10,000, and 100,000 rows, plus a roughly 200 KB
500-row document. They toggle one field without changing list order.

## Observed results, September 16, 2026

macOS arm64, Swift debug builds. These are native apply timings, not production
UI latency. Baselines used 20 edits per fixture (three for 1,000 rows); the
optimized run used 20 (three for 10,000), with no other test/build commands running.
Short runs and machine load affect timings. There are no hardware-dependent
wall-clock assertions in the test suite.

| Rows | JSON bytes | Baseline median ms | Optimized median ms | Optimized p95 ms |
| ---: | ---: | ---: | ---: | ---: |
| 20 | 1,341 | 14.61 | 9.06 | 16.02 |
| 200 | 13,501 | 362.14 | 56.21 | 74.00 |
| 500 | 33,901 | 2,333.51 | 136.03 | 165.27 |
| 500, longer text | 197,901 | 2,305.64 | 166.22 | 214.03 |
| 1,000 | 67,901 | 10,883.73 | 241.46 | 340.50 |
| 10,000 | 688,901 | Not measured | 2,556.13 | 2,754.41 |
| 100,000 | 6,988,901 | Not measured | Rejected: 1 MiB limit | — |

The 10,000-row result remains too slow for interactive editing. Full document
validation, snapshot bridge payloads, historical forks, and pending-projection
serialization remain. This pass does not establish a need to replace Loro.

In Bun 1.3.13, the four bridge envelope schema checks on 500 rows dropped from
39.34 ms median to 0.025 ms. This isolates schema-envelope work; it excludes the
remaining plain-JSON guards and WebKit transport. The controller's mocked-host
edit benchmark dropped from 17.42 ms to 5.80 ms. The baseline used 30 measured
iterations and the optimized run 100, after warmup.

## Deterministic regression checks

- A single-row edit with unchanged IDs/order performs zero list searches or moves.
- A head-based edit materializes Loro twice; subsequent frame/projection reads
  reuse the validated cached value. Stale-base edits retain their historical path.
- Repeated unchanged frames preserve object identity and do not notify consumers.
- Status-only notifications do not rerun Svelte document-data consumers.
- A five-edit burst can remain unprojected while all five edits survive abrupt
  owner shutdown and reopen; flush materializes the final state once.
- Failed merges and transactions leave the last valid state intact. Deferred
  writes preserve external changes and refresh commits from other owners.
- Compiled Quick Checklist exercises twenty rapid input events in a 500-row list,
  checks the final visible text, and verifies the saved row and its neighbor.

The repository-wide `test:local` wrapper requires Bun 1.4.0. These measurements
and package checks were run individually with the installed Bun 1.3.13.

## Architecture decision: retain Loro

Keep the production optimizations above and Loro's automatic merging of offline
text, list, and external JSON edits. SQLite remains the durable committed state;
`stores/data.json` remains the editable revision-envelope projection. Archiving
the experiment does not change storage authority, validation, or sharing.

Use the existing 20–1,000-row fixtures for routine performance measurement and
10,000 rows as a stress case, subject to current byte limits. Million-row support
is not an acceptance requirement. Row count alone is insufficient: text length,
nesting, edit type, and schema constraints also affect cost.

## Archived experiment: findings

The September 16, 2026 experiment compared the production path with incremental
Loro commands and a resident plain-JSON control. It ran on an Apple M1 with 16 GB
RAM using release Swift builds and a minimal WebKit harness. These measurements
are separate from the debug-build production results above.

At 10,000 compact rows, median native field-edit time was 1,222.88 ms for the
production path and 6.13 ms for incremental Loro. However, the incremental path
used fixture-specific validation and kept edits in memory until a snapshot save;
it did not provide production SQLite durability on each acknowledgement. These
figures demonstrate potential, not equivalent behavior or a shipping speedup.

The plain control handled one million compact rows but had no automatic merge
engine. The Loro experiment exceeded its 2 GiB native memory budget during the
first million-row edit. This describes that representation and fork strategy,
not a general Loro limit. Neither result justifies replacing the merge engine.

The experimental executable, scripts, raw results, and full report are retained
locally in `archive/document-sync-spike/`, with restoration instructions. That
directory is ignored by Git and excluded from releases. Active builds and tests
do not depend on the archive; the production benchmarks remain available above.

Future performance work should measure and reduce repeated whole-document
validation, bridge serialization, candidate forks, and pending-projection
serialization. Incremental commands and publications are candidates for a
separate change with equivalent durability, schema enforcement, and merge
correctness. Pagination and large-collection partitioning are deferred until
real slops require them.

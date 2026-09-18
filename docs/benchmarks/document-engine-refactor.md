# Document engine refactor

The shared evaluator is now `@hitslop/document-engine`; Apple's target is
`HitSlopDocumentEngine`. The JSC adapter is private. Each document retains its own
VM and a stateless utility VM handles cold package/schema/seed operations.

## Changes and boundaries

- Ordinary commands no longer load the undo snapshot. SQLite still copies it into
  the singleton undo row atomically when an edit commits.
- Operations copy affected containers, including list arrays, and preserve the
  previous snapshot on failure. Prepared data/snapshot JSON is reused.
- Document UTF-8 sizing counts bytes without allocating an encoded byte array.
  Unicode fixtures cover pairs, lone surrogates and normalization-distinct text.
- A shared closed-schema checker replaces application meta-validation and tooling
  Ajv. The URL polyfill is removed. TypeBox still validates data, including complete
  documents after edits. The supported language is documented in
  [the schema package](../../packages/schema/README.md).
- Async JSC calls enqueue continuations. Synchronous calls remain inside SQLite
  transactions. Request inspection and receipt lookup still precede evaluation.
- Bridge errors carry code/message fields. Validator diagnostics distinguish
  accelerated, interpreted and exception-fallback checks.
- The experimental evaluator, storage adapter and old comparison driver are gone.
  The remaining harness exercises production code.

External JSON editing, conflict proposals, sharing, media, receipts, undo and
batches remain supported. There is no mutable JSC document cache, partial
validation, bytecode cache or new guest/room protocol.

## Evidence

[Raw before/copies-only/final stress results](document-engine-refactor-results.json)
retain every sample and hashes of the copied artifacts actually executed. The
Apple bundle decreased from **249,503 to 151,047 bytes** (39.5%), below the 180 KB
generation gate. Generation also checks the emitted bundle for nondeterministic
APIs; the separate web adapter intentionally supplies clocks and Web Crypto.

The synthetic 14,000-row run includes 630 measured commands across three trials
with 1, 5, 10 and 20 open documents. A 100-row neighbour remains active; other
windows are idle. All twelve trials release their document-engine owners.
Twenty-document host RSS was **106.8–147.4 MiB**, below the approximate 235 MiB
budget. RSS excludes WebContent and is affected by allocator history and memory
pressure; it is not isolated per-VM memory.

These stress runs overlapped compilation and desktop activity. Large-document
median trial p95s were 499/698/456 ms before, 376/275/170 ms after copy removal,
and 443/534/461 ms in the final loaded run for 1/5/10 documents. This is evidence
of substantial variance, not a repeatable speedup claim. Sub-stage timings show
path copying itself is small; validation, serialization, native transport and
SQLite remain visible. Stage timings overlap and must not be summed blindly.

Engine allocation and schema configuration are reported separately from complete
session opening. The loaded stress run's allocation p95 was about 52 ms, while
allocation plus configuration p95 was 132 ms. This does **not** establish the
original cold-engine gate, which also includes first document validation. The
current harness explicitly measures that complete sequence over forty fresh VMs
in `lifecycle.json`.

## Compiled Quick Checklist

The [matched 100-task profile](document-engine-checklist-results.json) uses identical
compiled guest files with the preserved pre-refactor binary and the final binary.
Values are medians of three trial p95s in milliseconds. An active neighbour is
measured while the first checklist stays busy; remaining documents are idle.

| Open documents | First checklist before / after | Neighbour before / after |
| --- | ---: | ---: |
| 1 | 7 / 5 | — |
| 5 | 7 / 6 | 9 / 7 |
| 10 | 7 / 8 | 8 / 7 |
| 20 | — / 6 | — / 8 |

Small-document latency remains comparable; millisecond differences are not a
precise speedup claim. With twenty documents, final host RSS was **131–159 MiB**.
All twelve final trials released their engine owners. The complete cold sequence
was **20.9 ms p95** across forty fresh VMs, below the 100 ms target. Lifecycle RSS
was 38.8 MiB after the first close and 39.0 MiB after the fortieth.

The final harness includes sub-stage instrumentation and the forty-engine cold
loop; the preserved baseline does not. No before/after cold-time or isolated
per-VM memory claim is made. The raw files retain this distinction.

These typical-document results support keeping full validation and full snapshots.
Subtree validation, a mutable document cache and bytecode caching remain deferred.

## Correctness and reproduction

The shared corpus has 27 cases, including two archive-shaped document cases;
unsupported reference schemas are now explicit definition rejections. It runs in
Bun, the emitted Apple bundle, native JSC and workerd/V8. Independent tests cover
atomic failure, input immutability, exact byte/depth boundaries, Unicode transport,
SQLite receipts and rollback, undo and cross-connection serialization.

Validation completed for all six TypeScript packages, Cloudflare, 162 native
tests with compiled Quick Checklist, real HTTP/WebSocket recovery, acknowledged
edit recovery after process termination, fresh npm consumers, counter persistence,
PNG/PDF export and the relocated signed helper. Ad-hoc hardened signing does not
replace Developer ID/notarization or an actual macOS 14 release run.

```sh
bun scripts/benchmarks/javascriptcore/production.ts
bun scripts/benchmarks/javascriptcore/production.ts --checklist
bun scripts/benchmarks/javascriptcore/summarize.ts <run-directory> [<other-run-directory>]
bun scripts/native-runtime-check.ts
HITSLOP_NATIVE_SYNC=1 HITSLOP_NATIVE_CLI="$PWD/apps/apple/Packages/HitSlopApple/.build/debug/hitslop-native" bun run release:npm:check
HITSLOP_NATIVE_CONFIGURATION=debug bun scripts/native-helper-check.ts
```

The checklist profile loads the compiled 100-task application and adds a minimal
subscriber for identical timing across native binaries. Its timer ends after
snapshot delivery and a layout read; it does not promise a completed Svelte paint.
Raw output stays under `.hitslop/spikes/javascriptcore/`. The executable uses
hardened ad-hoc signing with no entitlements and `JSC_useJIT=false`.

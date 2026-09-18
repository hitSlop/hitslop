# JavaScriptCore engine measurements

The native runtime now uses `@hitslop/document-engine` through the trusted bundled
JavaScriptCore adapter, with an independent VM per document. Cloudflare and
previews import the same evaluator. Swift retains SQLite, files and networking.

The latest copy/schema cleanup and its evidence are recorded in
[Document engine refactor](document-engine-refactor.md).

## Production integration checks

```sh
bun scripts/benchmarks/javascriptcore/production.ts
bun scripts/native-runtime-check.ts
HITSLOP_NATIVE_SYNC=1 bun run --cwd apps/cloudflare test
```

The production driver compares the shipped string ABI against local workerd/V8,
then measures actual `SlopRuntimeSession` openings and the generated WebKit
bridge through SQLite and snapshot delivery. It now uses 1, 5, 10 and 20 open documents,
with one 14,000-row document and a 100-row active neighbour. The remaining
documents are idle. A minimal DOM subscriber isolates host/transport cost; the
separate native suite covers compiled Quick Checklist, capture and persistence.
Host RSS and idle CPU exclude separate WebContent processes. The copied executable
is signed ad hoc with hardened runtime, without entitlements, and JIT disabled.

The completed run `production-2026-09-18T04-35-08.384Z` passed **25/25 JSC/V8
parity cases** and collected **450 measured edits** over three trials. Each
active document had five warmups and thirty measured edits; the small document
paused 100 ms between commands while the large document remained busy. The
[production results JSON](javascriptcore-production-results.json) preserves all
samples, environment details, and bundle/executable hashes.

| Open documents | Large document p95 | Small neighbour p95 | Host RSS across trials | Idle host CPU |
| --- | ---: | ---: | ---: | ---: |
| 1 | 306 ms | — | 147–234 MiB | 0.26–0.66% |
| 5 | 507 ms | 13 ms | 154–212 MiB | 0.47–0.76% |
| 10 | 315 ms | 6 ms | 187–208 MiB | 0.79–1.03% |

Latency cells are medians of three trial p95s. Large-document trial p95s were
306/314/265 ms, 274/1125/507 ms, and 333/315/296 ms respectively. The five-document
outlier shows why these desktop-load measurements establish isolation rather
than a precise scaling curve. RSS covers the whole native process, with trials
sharing allocator history; it is neither per-VM memory nor total app memory.
Idle CPU is measured over three seconds, with 100% representing one core.

All nine trials released their document-engine owners after close. Native tests
also check that actual contexts and VMs are released, allowing up to two seconds
for asynchronous JSC VM cleanup. Full session opening for the large document
took 1.57–3.08 seconds; this includes package validation and WebKit readiness and
must not be confused with the historical engine-only cold initialization below.
The near-1-MiB document still needs typing drafts and batched commands.

Production validation also passed the full native runtime suite, compiled Quick
Checklist and counter persistence, acknowledged-edit recovery after process
termination, local HTTP/WebSocket room recovery, fresh npm tarball consumers,
and the relocated embedded helper with its bundled engine.
Developer ID/notarization and an actual macOS 14 run remain separate release gates.

## Historical isolation experiment

The following results describe the pre-cutover experiment and its removed Swift
evaluator. Preserve them as the original baseline; do not compare the current
production adapter to these numbers as a controlled before/after test.

The experimental evaluator, SQLite adapter and old driver have been removed.
The historical results below remain evidence for the VM isolation decision.
For current regression work use `production.ts` above; `--checklist` loads the
compiled 100-task Quick Checklist. Both profiles retain raw stage timings and
still publish full snapshots. The timer ends at the benchmark subscriber's layout
read; it does not measure a completed Svelte paint.

## Measurement method

The three historical configurations were the Swift evaluator, one shared JSC VM,
and independent per-document JSC VMs. Each JSC VM has a dedicated background
thread, run loop, and autorelease pools. Per-document queues preserve ordering;
all evaluation completes inside the SQLite transaction before publishing.

Each workload has three trials, ten warmups and fifty measured edits. Mode
order rotates between trials. Single-document cases contain 100, 1,000, 5,000,
10,000, and 14,000 rows (6.5–946.2 KiB of application JSON). The last remains
below the current 1 MiB limit. Concurrency cases exercise five 5,000-row documents
at once and twenty open documents with one 14,000-row and one 100-row active
document. Active documents finish warming up before any measured edits begin.
In the mixed case the small document pauses 300 ms between edits, matching the
existing text-draft debounce interval. The large document stays busy until all
fifty small-document samples finish; any extra large-document edits maintain
load but are excluded from its fifty reported samples.

The UI is a synthetic checkbox list in a real hidden WKWebView, not Svelte or
Quick Checklist. Timing begins in JavaScript before posting a command and ends
after parsing the full snapshot, updating the list, and forcing layout. Swift
separately records document-queue wait, authority time and, for JSC, engine-queue
wait, SQLite stages and evaluator time. A fresh native invocation wakes WebKit
for each edit, avoiding suspension of a single long-running background promise.
Engine queue time includes both request inspection and evaluation. The existing
Swift baseline exposes total authority time only; its zero-valued sub-stage
fields mean uninstrumented, not free work. Evaluator time includes validation
and preparation/serialization of the candidate snapshot.

The reported p95 is the median of three trial p95s, not a pooled percentile.
Browser/JS sub-stage timers have millisecond resolution. Swift timers use
`ContinuousClock`. Resident memory covers the native process, excluding the
separate WebKit content processes. Lifecycle tests also use weak references to
detect surviving `JSContext` and `JSVirtualMachine` objects after teardown.

Bare JSC lacks `TextEncoder` and `structuredClone`. This experiment supplies a
JSON-only cloning adapter and a JavaScript UTF-8 encoder, whose costs are
included. These shims are part of the measured candidate, not native Web APIs.

## Results

**Proceed toward a per-document JSC integration; reject one app-wide VM.** The
shared TypeScript implementation passed the tested correctness boundaries, and
independent VMs met the aggregate latency thresholds. The shared VM caused
substantial delays between documents. The production integration is now covered
above; the historical comparison is not a controlled production speedup claim.

The complete run, `2026-09-18T02-53-02.567Z`, contains **5,400 measured edits**:
108 document/trial rows, each with fifty samples. It ran on an Apple M1 with
16 GiB RAM, macOS 26.6.2 (25G83), Swift 6.4, and Bun 1.4.2. The local V8 oracle
used Wrangler 4.132.0/workerd 1.20260915.1. The bundled engine was 172,862 bytes.
The [results JSON](javascriptcore-results.json) preserves individual trial p95s,
aggregate measurements, correctness cases, environment, and binary/bundle hashes.
Its base commit identifies the existing code under test; the spike was an
uncommitted addition to that checkout.

All values below are command-to-layout p95 in milliseconds, rounded to the
nearest millisecond. Each cell is the median of three trial p95s.

| Single document | Application JSON | Historical Swift | Shared JSC | Independent JSC |
| --- | ---: | ---: | ---: | ---: |
| 100 rows | 6,701 bytes | 8 | 6 | 6 |
| 1,000 rows | 67,901 bytes | 49 | 26 | 32 |
| 5,000 rows | 343,901 bytes | 283 | 112 | 126 |
| 10,000 rows | 688,901 bytes | 869 | 252 | 224 |
| 14,000 rows | 968,901 bytes | 582 | 378 | 338 |

| Concurrent workload | Historical Swift | Shared JSC | Independent JSC |
| --- | ---: | ---: | ---: |
| Five active 5,000-row documents, range across documents | 526–537 | 732–805 | 313–355 |
| Twenty open: active 14,000-row document | 658 | 432 | 390 |
| Twenty open: active 100-row document | 8 | **263** | **7** |

The small document spent **257.5 ms p95 waiting for the shared engine**, compared
with **0.093 ms** for its independent engine. Its individual trial p95s were
314/248/263 ms with the shared VM and 7/7/29 ms with independent VMs. The shared
queue, rather than that document's own computation, dominates its latency.

There was substantial desktop-load variance. For example, Swift's 10,000-row
trial p95s were 869/391/987 ms, explaining why its aggregate exceeds the larger
document's result. The third independent-VM five-document trial also rose to
872–1,054 ms. These observations support the isolation decision, but they do
not establish a repeatable production speedup of the precise ratios shown here.

| Acceptance check | Observed result |
| --- | --- |
| Correctness | **31/31 passed**, including explicit expectations and JSC/V8 agreement |
| Context/VM teardown | **0 retained contexts, 0 retained VMs** after forty independent cycles |
| Lifecycle memory | Independent RSS 125.3 → 125.0 MiB; shared register/release RSS flat at 126.8 MiB |
| Cold initialization p95 <100 ms | **61.7 ms**, including bundle load, schema registration, and initial validation |
| Independent warm p95 ≤1.10× Swift | **Pass on aggregate** in all twelve document/workload cases; worst ratio 0.875× |
| Shared warm/concurrent thresholds | **Fail**: five-document burst and small-document latency exceed the thresholds |

With twenty documents open, median native-process RSS immediately after opening
was 120.6 MiB for Swift, 151.5 MiB for shared JSC, and 234.8 MiB for independent
JSC. These are process snapshots, not isolated per-VM allocations or peak total
app memory; allocator history and separate WebKit processes limit comparisons.

## Implementation decision

Use the existing TypeScript command semantics behind a private string ABI, with
one context and independent VM per open document on a confined executor. Cache
schema validation, retain SQLite as the durable authority, and load committed
state inside the transaction. Preserve receipts, undo, and commit-before-ack
ordering. Close the engine with its document. The experiment does not justify
adding a mutable JSC state cache or changing the public operation language.

Keep JSON text intact across the native boundary, including JSON string tokens
for identifiers used as database keys. Correctness fixtures must follow the
integration: equivalent-looking Unicode keys and lone surrogates are cases a
Swift value-tree conversion can change.

Near the current 1 MiB limit, independent JSC still took 338 ms p95 for a single
document. Retain local typing drafts and command batching, and profile complete
validation, UTF-8 sizing, JSON serialization, and native transport before claiming
per-keystroke performance. Do not extrapolate these measurements to larger
documents or increase the size limit based on this spike.

The opt-in executable and local Worker harness stay outside the shipping app.
The production cutover preserves bridge/room protocol 3 and projection format 2;
its native database format is 4 and rejects pre-release databases without migration.

## Limits and acceptance criteria

The agreed spike thresholds are zero correctness failures, no surviving contexts
or steadily growing lifecycle memory, cold initialization p95 below 100 ms,
and warm command-to-layout p95 no more than 10% above Swift. A shared VM also
needs concurrent-workload p95 within 10% of independent VMs.

This is a single-machine benchmark under normal desktop load. Close differences
around that 10% boundary need confirmation, and the observed trial variance
requires a controlled rerun before treating aggregate passes as a release gate.
Ad-hoc hardened-runtime signing does not cover Developer ID notarization or
macOS 14. Those distribution/platform checks still require their actual signing
identity and machine. No JIT entitlement was added. The production checks above
cover Svelte and local HTTP/WebSocket sharing separately from the historical
experiment; they do not certify live Firebase authentication or a hosted deployment.

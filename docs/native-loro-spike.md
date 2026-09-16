# Native Loro decision spike

**Latest experiment:** [spike 4: durable incremental sharing](native-loro-incremental-spike.md).
The measurements below archive spike 2. [Spike 3](native-loro-bridge-spike.md)
established text ancestry and durable confirmation; spike 4 adds an immutable
outbox, incremental relay protocol, and seed-plus-log bootstrap.

**Status: spike 2 implemented; native Loro plus an opaque Cloudflare relay works
end to end. The pending-text failure from spike 1 is resolved.**

Swift owns one Loro replica per local document. The Svelte app holds confirmed JSON
and temporary input drafts; it loads no CRDT engine. Generated JSON Schema still
controls validation and container mapping at runtime. A Durable Object stores and
relays Loro bytes between native hosts. Local editing, file updates, and recovery
work while the network is disconnected.

This is an opt-in experiment, not a new production runtime release. The normal app,
CLI, catalog, and browser preview continue using the existing runtime. The production
targets do not depend on the experimental Loro target. SwiftPM does resolve/download
the pinned dependency for the package.

## Run it

From the repository root on macOS:

```sh
# Build fixtures and the optimized harness, run tests, verify both UIs,
# and collect three runs at 1, 5, and 10 windows for both engines.
bun run spike:native-loro

# Add local and already-deployed hosted two-process network checks.
bun run spike:native-loro --e2e --hosted

# Local correctness checks, without benchmarks.
bun run spike:native-loro --e2e --verify-only

# Two separate native host processes sharing one disposable document.
bun run spike:native-loro --open-pair
bun run spike:native-loro --open-pair --hosted

# Explicitly deploy/update the isolated Worker and test it.
bun scripts/native-loro/hosted.ts --deploy

# Interactively use disposable Quick Checklist copies.
bun run spike:native-loro --open
bun run spike:native-loro --open --js
```

The runner builds the optimized native harness, then runs correctness checks and
three benchmark runs for each engine/window count. Use `--verify-only` to skip the
benchmarks. Any failed gate makes the command fail; native UI verification uses exit
2 to distinguish a completed failing check from an execution error. Hosted checks
use `.hitslop/native-loro/hosted.json`; they do not deploy implicitly.

Generated projects, packages, logs, screenshots, credentials, and measurements live
under ignored `.hitslop/native-loro/`. Ordinary interactive windows use temporary
copies removed on close. Two-process runs retain disposable `a.slop` / `b.slop`
copies for inspection and delete room credentials and server rooms on exit. No
Desktop document or catalog master is modified. Interrupt `--open-pair` with Ctrl-C.

Evidence is archived separately:

- [Spike 1 results](experiments/native-loro/results.json), including its failing trace.
- [Spike 2 results](experiments/native-loro/results-v2.json), including the fixed
  trace, relay checks, two-process tests, and repeated benchmarks.

New runs update local artifacts, not these committed evidence files.

## Implementation boundaries

The Apple package adds three isolated targets:

- `HitSlopLoroSpike`: generic JSON/schema adapter, Loro replica, native document actor,
  private webview bridge, and native WebSocket connection.
- `HitSlopLoroSpikeCLI`: AppKit harness using the existing `SlopRuntimeSession` shell.
- `HitSlopLoroSpikeTests`: native validation, merge, protocol, and recovery tests.

`loro-swift` is pinned to **1.13.3**. Its native implementation is Rust through
UniFFI. No source is imported from the reference checkout under `_docs/`.

The existing byte journal gets package-level visibility so the spike can reuse it.
Its transaction/recovery behavior is unchanged. The pilot's initial data moves to
`initial.ts`, shared by its ordinary UI and the spike fixture generator.

`scripts/native-loro/prepare.ts` copies the pilot, adapts only the native copy's
document-store import and asynchronous handlers, and builds both variants through
the ordinary slop builder. The native input action holds local drafts. Both copies
contain identical authored initial JSON under `assets/initial.json`.

The standard host bootstrap remains installed because the harness reuses the host
shell. Its lazy engine resource is never fetched in the native variant. The private
bridge instruments WASM compilation/instantiation entry points, and verification
checks both the counter and resource requests. Recorded result: **zero calls and
zero engine-script requests**.

## Schemas remain dynamic

```text
TypeBox schema.ts ── build ── data.schema.json
                                  │
                         generic Swift adapter
                                  │
                              LoroDoc
```

There are no generated `Checklist` or `Notes` Swift models. The native interpreter
reads the existing `x-hitslop` annotations:

| Annotation | Native representation |
| --- | --- |
| `map` | Loro map with independently mapped fields |
| `record` | Loro map with a common mapping for dynamic keys |
| `movable-list` | Loro movable list, matched by its declared application ID |
| `text` | Loro text container |
| `atomic` | Plain JSON value replaced as a unit |

Ordinary scalar fields are atomic. Unknown application fields survive as atomic
JSON. Nested containers keep their identities when edited. The adapter rejects
duplicate/empty list IDs and validates both proposed and merged projections before
changing live state. Validation does not coerce, add defaults, or strip fields.

Fixtures are generated from TypeBox, including expected validity results. They
cover the pilot and a different schema with nested records, atomic arrays/unions,
numbers, booleans, string constraints, and Unicode. This is a conformance sample,
not certification of every possible JSON Schema feature.

## Document ownership and persistence

`SpikeDocument` owns its replica on a Swift actor. Loro operations and synchronous
journal work execute without actor suspension inside a transaction. Only immutable
JSON frames or byte buffers cross its boundary. The spike uses its own state
identity marker, `native-loro-spike-1`; its state files are not a release format.

Native construction receives schema and initial JSON before a webview exists.
Each document has independent state and history, while all native documents use
the same linked engine code.

Edits are staged on a historical fork and validated before import. Incoming native
peer updates are also staged and validated. Tests exchange incremental Loro updates;
the private UI stress control injects edits from a separate native replica. There
is no Firebase connection in this experiment.

Saving retains the existing 250 ms debounce and one-second maximum wait. `flush()`
uses the production journal to commit identity, checkpoint, materialization
metadata, and the JSON projection. Interrupted transactions recover through that
same journal. Malformed external JSON is preserved while checkpoint-only commits
save UI changes. Valid stale external JSON is applied against its historical base.
External review-sheet integration is outside the spike.

Snapshot and independent-state creation require no webview. The harness combines
the existing immutable package duplicator with native state creation to verify a
complete independent copy after detaching the bridge.

## Experimental UI protocol

The private `hitslopNativeSpike` handler accepts `open`, `apply`, `flush`, and
`releaseDraft`.
`remote` and `delay` are harness-only stress controls.

An edit carries:

```ts
{ session: string, sequence: number, base: string, after: JSON,
  draft?: string, parent?: number }
```

A publication/acknowledgement carries:

```ts
{ publication: number, revision: string, data: JSON,
  dirty: boolean, error: string | null, projectionError: string | null,
  /* Spike 2 also returned authoredRevision; spike 3 keeps that frontier native. */ }
```

- The SDK queues `change(mutator)` calls and returns a promise. Each mutator runs
  exactly once against the latest confirmed projection when it reaches the head.
  Text draft callbacks instead run once at input time against the retained local
  draft. Both send JSON; a callback never crosses the bridge or gets replayed.
- One request per view is in flight. Native enforces sequential request numbers,
  deduplicates an identical retry, and rejects reuse with different content.
- Native publishes merged state with a monotonically increasing publication
  number. Older replies cannot replace newer publications.
- Acknowledgement means accepted in native memory. `flush()` means earlier queued
  edits reached durable storage. Unsent drafts are outside that guarantee.
- Delete/undo handlers await their mutations. Textareas hold local drafts while
  edits are pending and during composition. Actual values are reactive Svelte
  action inputs, ensuring they refresh after renderer reload.

The native owner survives reload; the new renderer opens the existing owner and
receives current state. A new renderer has a new session/sequence stream. The spike
retains the last reply for each view session until document close.

### Fix: draft ancestry is distinct from merged state

The first spike lost a remote `R` in this trace: `abc` → local `abcX` → remote
`RabcX` → local draft `abcXZ`. Applying the second draft against the latest merged
revision interpreted the unseen `R` as an intentional deletion.

The text action now captures the **frame actually displayed** when a draft begins.
It retains that frame, local JSON, a draft ID, and the preceding accepted sequence
while input is pending or composition is active:

1. First edit: send the displayed `base`, `draft`, and desired `after` JSON.
2. Native applies the edit on that historical fork. It records the resulting
   **authored frontier before merging** into current state.
3. Later edits in that draft send the same original `base` and a `parent` pointing
   to the preceding accepted local edit. Native checks the chain and forks from
   the stored authored frontier. Remote publications never silently become its base.
4. Native merges each authored branch and publishes confirmed JSON separately.
5. When the input queue settles and composition ends, reconcile the DOM with
   confirmed state and release the draft. A rejected edit poisons the chain;
   later edits cannot skip it or silently claim success. Failed input remains visible.

The trace now produces **`RabcXZ`**. Concurrent remote deletion/replacement and list
moves use the same historical context. A remote item deletion does not resurrect
that item when its pending local text draft arrives.

This retains an asynchronous, host-acknowledged API and requires no JS replica.
The input field is immediately responsive because it owns its temporary DOM draft.
Other views observe native-confirmed publications. A renderer killed before sending
or durably flushing an edit can still lose that edit; this is not a durable browser
outbox. Rich-text cursor/selection rebasing is also outside this adapter.

## Sharing behind the native owner

```text
Svelte / WKWebView
   │ JSON edits + draft ancestry             generated data.schema.json
   ▼                                                   │
Swift document actor ◄─────────────────────────────────┘
   │ one native Loro replica
   ├── journal → checkpoint + replay cursor + editable stores/data.json
   └── native WebSocket → Durable Object / SQLite → another Swift document actor
```

`SpikeConnection` belongs to the host, not the renderer. It can receive, validate,
merge, save, and export after the bridge detaches. Local save is independent of
whether a socket exists. A shared seed copies document identity and CRDT history;
an independent copy creates a new identity and history from the current projection.

The server is [a small isolated Worker](../Prototypes/native-loro-relay/README.md),
with one SQLite Durable Object per document and no Loro dependency. Each room binds
a document ID to its immutable schema fingerprint. It stores opaque full snapshots
in an append-only sequence, deduplicated by SHA-256. It waits for durable storage
before acknowledgement and fanout. Replay permits only one unacknowledged snapshot
per socket.

Native reconnect sends the last **durable replay cursor**. On receipt it verifies
identity/schema/hash, stages and validates the Loro merge, then journals the new
checkpoint and cursor together. Only then does it acknowledge delivery. A failed
commit cannot advance the durable cursor past an unsaved update. Journal recovery
and replay handle an uncertain commit; reimporting the same Loro history is safe.

After replay catches up, the client offers its current durable checkpoint, including
unsent offline edits. A lost upload ACK triggers reconnect/replay and a deduplicated
retry. Per-connection in-flight work is bounded. There is no network heartbeat or
polling while connected and idle. WebSocket attachments retain delivery state across
Durable Object hibernation; the test records boot IDs and socket counts.

The host keeps polling local files in this spike (200 ms), separately from network
sync. That can later use the production file observation mechanism. Valid external
JSON edits retain their historical base token and enter the same native merge path.
Malformed JSON stays untouched while checkpoints continue saving. Repairing that
file rematerializes the latest checkpoint, including edits made during the error.
Repeated snapshot exports with the same malformed file neither rewrite the journal
nor republish unchanged state. This prevents a save-notification loop when sharing
is active; both the unit and network suites cover this case.

### Credentials, limits, and deployment

The harness issues one-hour, room-scoped signed tokens outside `.slop` packages.
Native sends them as authorization headers; they never enter Svelte. SQLite stores
membership, and revocation closes existing sockets and rejects reconnect. This is
a test issuer, not production accounts/invitations.

The isolated deployment is
`https://hitslop-native-loro-spike.internal-slide.workers.dev`. Test rooms are removed
after runs; the Worker remains deployed for reruns. Production Firebase resources
and routes are unchanged. Owner-only test controls inject lost ACKs, quotas, and
object restarts. They are intentionally enabled on this test service.

Limits are 512 KiB per snapshot, 1 MiB per frame, 64 MiB of checkpoint payload and
10,000 unique snapshots per room, with 20 members. Quota/revocation stop sharing
while native local edits continue saving. Payload counters exclude metadata/index
storage and do not estimate billing or establish that hosting is free.

Full snapshots are a deliberate spike simplification. **Do not discard all but the
last snapshot:** it may lack another offline branch. A production relay needs an
incremental-update/compaction protocol, operational limits, real authentication,
and a policy for invalid authorized-peer data. An opaque relay cannot validate the
application schema or Loro contents itself; native clients do that before import.

## Correctness results

Native unit tests cover two generated schemas, TypeBox/native validity fixtures,
concurrent text and structural edits, draft-parent validation, invalid input,
request retries, stale/malformed JSON, shared cursor durability, and five journal
interruption boundaries. The final run records **16 passing test declarations**.

Native WKWebView verification covers actual pilot controls, renderer reload,
bridge-free snapshot/copy, and the original pending-text trace. Its new matrix
combines remote insertion, deletion, replacement, Unicode, synthetic composition,
and reorder with **0, 120, and 500 ms** acknowledgement delays. Remote item deletion
is tested separately. The JS/WASM baseline retains its corresponding UI checks.
All **40 native UI checks** and **11 JS baseline checks** pass.

The relay protocol suite uses synthetic opaque bytes to check authentication,
membership, schema/size limits, deduplication, backpressure, lost ACKs, quota,
revocation, and forced object restart. The separate native end-to-end suite uses
**two actual AppKit processes and real Loro state**:

- Edit in both directions over local and deployed WebSockets.
- Disconnect both; edit and flush; force-quit both processes; reopen offline;
  edit again; reconnect and converge both UIs and both JSON files.
- Merge external JSON edits and preserve malformed files while native state saves.
- Retry after lost ACK; reconnect after object restart; receive without a renderer.
- Continue local saving despite quota or revoked membership; reload the renderer.
- Confirm zero WASM calls and zero engine resource loads in native webviews.

Hosted tests also observe a 16-second idle interval and confirm delivery afterward.
A changed boot ID with both sockets retained is recorded as observed hibernation;
the test does not assume every idle interval forces it.
The final run passes **15 relay protocol checks per environment**, **17 local
native end-to-end checks**, and **19 hosted native end-to-end checks**, including
the hosted idle observation.

Composition tests dispatch browser events. Actual system IME testing, larger
schemas/histories, adversarial concurrency traces, production error/review UI, and
full schema-validator conformance remain release work. Passing this decision spike
does not establish those properties.

## Measurements

Apple Silicon, macOS 26.6.2, Swift 6.3.3, optimized builds. Each table cell is the
median of three fresh-process runs; each run uses 100 edit samples and ten flush
samples. Engine order alternates. These are small, identical checklist documents.
Networking is disabled during the window benchmarks; network checks finish first.

### Spike 2: repeated window benchmark

| Windows | Engine | Open all windows | Summed host + WebKit RSS | Edit p95 | Flush p95 |
| ---: | --- | ---: | ---: | ---: | ---: |
| 1 | JS/WASM | 994 ms | 279 MiB | 5 ms | 154 ms |
| 1 | Native | 738 ms | 205 MiB | 7 ms | 7 ms |
| 5 | JS/WASM | 2,523 ms | 646 MiB | 6 ms | 167 ms |
| 5 | Native | 1,542 ms | 445 MiB | 6 ms | 14 ms |
| 10 | JS/WASM | 4,683 ms | 1,163 MiB | 5 ms | 172 ms |
| 10 | Native | 2,746 ms | 724 MiB | 7 ms | 7 ms |

At ten windows, native uses about **38% less summed RSS** and opens all windows
about **41% faster** in this run. Native meets the proposed 50 ms p95 acknowledgement
target at every window count. Two-animation-frame paint estimates were about 34 ms
at p95 for native and 100–110 ms for JS.

The [spike 1 archive](experiments/native-loro/results.json) recorded lower absolute
opening times for both variants (ten windows: 1,315 ms native / 2,603 ms JS) and
similar relative memory savings. These are separate sessions on a working machine;
there is no controlled thermal/background-load experiment that explains the change.
Compare the paired engines within each run, not these numbers as a release SLA.

The prepared native package contains **333,700 bytes** before capture/state; the
JS baseline contains **335,062 bytes**. Both benefit from the existing host-runtime
packaging split. Native ownership's additional benefit is avoiding engine loading
in each renderer, not another multi-megabyte reduction in the already-small file.

### Network observations

One end-to-end edit sample took **85 ms locally** and **182 ms over the hosted
relay**, measured from the initiating harness action to the other native owner's
confirmed state. This includes the initiating flush and polling by the harness;
it is not a p95 network or remote-paint benchmark. Raw upload ACK samples are also
archived, but their small count does not establish a latency guarantee.

The hosted scenario stored 12 unique snapshots totaling 19,834 checkpoint bytes.
During its 16-second idle observation, the object boot ID changed while both sockets
remained attached; head/byte counters stayed unchanged. Subsequent delivery passed.
This demonstrates the tested hibernation path, not a hosting-cost estimate.

Measurement limits:

- JS acknowledgement means local JS replica acceptance; native acknowledgement
  crosses the process bridge. Durability is measured separately through `flush()`.
- The harness reuses the existing native close/flush shell. Flush differences
  include that architecture, not just CRDT serialization speed.
- Memory includes the host and directly identified WebContent processes, plus
  newly observed WebKit GPU/network processes. Private PID inspection is confined
  to the spike executable. Raw PIDs and process rows are saved for audit.
- Summed RSS can double-count shared pages and is not physical memory footprint.
  Memory is sampled after 500 ms idle, without forced garbage collection; this
  does not establish long-lived steady-state memory use.
- Runs reuse filesystem/build caches. They are not cold-boot or first-install tests.
- Paint uses animation-frame timing, not display instrumentation. Timing values
  have browser timer granularity. Large documents, long histories, and real networks
  are outside the window benchmark; the network suite records separate small-document samples.
- Both variants run in the same harness binary. These results do not measure the
  final application's distribution size.

## Decision

**Native Loro plus an opaque WebSocket relay is a viable direction for hitSlop.**
It gives the local document one owner, preserves dynamic authored schemas and
editable JSON, survives renderer loss, and merges offline branches without putting
a network service between the file and its UI. Yorkie is not required for any layer
in this implementation.

The specific pending-text gate from spike 1 is resolved. The next project can be a
production native document service, with explicit work for the schema vocabulary,
error/review integration, edit acknowledgement/durability semantics, bridge/runtime
versioning, auth/invitations, and long-lived relay history. Browser preview behavior
must be chosen explicitly; this spike does not solve native/browser engine parity.

The functioning JS host-runtime remains the baseline until that migration is
implemented and release-tested. No production runtime version bump, checkpoint
compatibility promise, or production sharing migration is part of this experiment.

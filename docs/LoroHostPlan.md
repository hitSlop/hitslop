# Loro in the host: plan and proving spikes

Status: proposal, 2026-09-28. It supersedes the JSON-ops/JSC direction in
[NextPhasePlan.md](NextPhasePlan.md). None of this is an active contract yet.
When a phase lands, its rules move into `AGENTS.md`,
`docs/engineering-contract.md`, `docs/versioning.md` and the test ledger.

Decision, 2026-09-29: **commit to the host-owned Rust core.** The second
`spikes/hitslop-core` iteration is the fastest candidate in every matrix cell
(5k checkbox/move 3/3 ms vs 8–10/9–10 Swift native and 13–14/32–36 WASM) and
passes all latency gates; see `spikes/hitslop-core/NATIVE-OWNER.md`.

Status, 2026-09-29 (third iteration): **S3 passes** (9/9 CLI race and kill
scenarios; 1k-row cold apply 20 ms p95 against 150 ms). **S4 passes** (a per-writer
integer counter converges exactly where Loro Counter fails). Publication hardening
fixed two review-found bugs (other Loro roots, plain lists) and added chaos-peer,
nested-list and post-rejection coverage. The memory gate miss is attributed to
WebContent (the host is smaller). **Open: S2 system IME** (manual gate), then the
production cutover (§7).

Review update, 2026-09-28: **start the isolated Rust semantic-core spike**.
This authorizes experiments, not a production cutover, another runtime reset,
descriptor removal or template retirement. Existing contracts remain authoritative.
Progress and actual evidence live in [the binding report](../spikes/hitslop-core/REPORT.md)
and [the native-owner integration report](../spikes/hitslop-core/NATIVE-OWNER.md).
The integration milestone uses a Rust-only executable and a renderer that refuses
WASM assets. It does not put a second CRDT replica in the native application's view.
The separate WASM build is for browser/Bun portability. S1–S5 remain evidence gates;
passing the checklist integration alone does not authorize production cutover.

### Native-owner milestone result (2026-09-28)

The isolated Rust/UniFFI owner now drives a real WKWebView with no renderer Loro
or WASM. Automated draft ancestry, UTF-16 caret, composition simulation, AppKit
keyboard/undo/redo, save retry and normal/forced renderer remount checks pass.
A 100,000-step publication test and both-direction native/WASM byte replay pass.

The measured Rust implementation **misses the performance gates**: at 5k rows and
one window, median checkbox/move acceptance p95s are 39/45 ms versus 5/5 ms for the
Swift-native control; one move run reaches 82 ms p95. Native publication construction
alone is 30.61 ms p95, over the complete 2 ms budget. All three exploratory 40k Rust
cells fail periodic autosave cadence. Ordinary memory and typing-drain gates pass.
Full numbers, failed cells, hashes and methodology are in the
[native-owner report](../spikes/hitslop-core/NATIVE-OWNER.md).

Continue with direct Loro-diff publication and incremental issue/index maintenance
before adding production integration. Keep UniFFI; a new binding generator does not
address the measured full-value publication work. S1/S5 stay open, as do full
semantic parity and the real Japanese/Chinese IME gate. Five fresh trials cover each
ordinary-size candidate/cell; 40k remains a separate one-run-per-candidate stress
probe. No production ownership, ABI or storage change is authorized by these results.

## 1. Decision in one paragraph

Keep Loro. Move document ownership out of the WebView and into the host,
behind a **hitSlop-owned Rust crate** (`hitslop-core` = the `loro` crate plus
hitSlop's document semantics). The crate has a coarse API of JSON and bytes:

- Swift and the Cloudflare Durable Object handle only opaque bytes and JSON
  strings.
- The WebView becomes a view that sends **typed intents** and receives
  **patches**.
- The CLI and agents send the same intents to the same owner.
- There is one edit path, no optimistic replica in the view, and no JSON
  mirror.
- The same crate builds as a native library for macOS/iOS (UniFFI) and Tauri,
  and as WASM for `slop dev`, Bun tests and the Durable Object.

## 2. Why

### 2.1 The problem we actually have

The CLI has two edit paths:

- With the document open, edits go over the socket into the WebView's Loro.
- With it closed, `HitSlopWasm/DocumentCommand.swift` boots an invisible
  WebKit session (`WasmSession(headless: true)`, `headless.js`) just to run
  the engine.

Both paths already share the same semantic engine. Their different boot/lifecycle
paths exist because **the engine lives inside the view**. Native ownership removes
the headless WebKit dependency and separates engine lifetime from renderer lifetime;
it does not eliminate two independent semantic implementations that exist today.

### 2.2 The options we measured

| Direction | Evidence | Verdict |
|---|---|---|
| Loro-WASM in each WebView (today) | Current runtime; `spikes/engine-placement` baseline | Two CLI paths; ~50 MiB WASM per window; the engine dies with the renderer |
| JSON ops + TS reducer in host JavaScriptCore | `spikes/document-authority/REPORT.md` | Fine at ≤1k rows; **fails its gates at 5k** (27.6 ms apply vs. a 5 ms target; 51–54 ms render); unsuitable at 40k (233 ms, 818 MiB peak). No JavaScriptCore on Windows/Linux. Text OT, rebase and offline editing are left for us to build. |
| Native Loro owned by the host | `spikes/engine-placement/REPORT.md`; `_docs/hitslop-sync` spikes 2–4 | Partial Swift interpreter: 2–6 ms checkbox/move up to 5k rows; 29/33 ms at 40k in the single-window cell. Stress tails failed some every-run gates. Earlier native experiments proved hosted relay feasibility with different semantics/storage. |

The native result includes indexing and smaller publications, not placement alone.
All candidates retain atomic staging. The renderer displays 40 rows, and timing is
acceptance/render opportunity, not physical paint or durability. Re-measure after
semantic coverage grows; never substitute the archived relay timings for UI latency.

### 2.3 Against the long-term goals

| Goal | Host-owned Loro | JSON ops + JavaScriptCore |
|---|---|---|
| One UI/CLI edit path | Yes | Yes |
| Real-time collaboration | Merge is built in; the relay stores and forwards bytes | Server ordering, client rebase and text OT must all be built |
| iOS (flaky network) | CRDT merge supports offline branches; delivery still needs a protocol | Offline shared editing requires an additional ordering/rebase design |
| Windows/Linux (Tauri) | Rust core runs natively in Tauri | No JavaScriptCore; would need QuickJS/V8 or a hidden WebView |
| Undo/history (deferred) | Largely available from Loro's op log | Must be built |
| Agent op contract | Same `$id` intents | Same `$id` intents |
| Server validation/permissions | Room-level access is easy; field-level checks decode with the same core in WASM | Easy |

"Host and Cloudflare just move bytes" holds, with three honest exceptions:

1. **Late-joiner snapshots and compaction.** The Worker runs the core (or
   `loro-crdt`) as WASM.
2. **The durable outbox and ack protocol.** This must be designed either way;
   spike 4 already did most of it.
3. **Field-level permissions.** These require decoding. Room-level access
   control does not.

## 3. Learning from the first version (`_docs/hitslop-sync`)

The first version already had a native Swift actor owning Loro via loro-swift
1.13.3, the webview holding confirmed JSON, and a Durable Object relay. See
`docs/native-loro-spike.md`, `native-loro-bridge-spike.md` and
`native-loro-incremental-spike.md` in that folder.

| First version | What went wrong | v2 |
|---|---|---|
| `change(draft => …)` mutated a JSON clone; Swift **diffed JSON** into Loro ops | Intent was lost (a move became delete+insert, text became a guessed diff); it needed schema-aware reconciliation on a fork | The SDK sends **typed intents**. There is no diffing. |
| Editable `stores/data.json` mirror, a byte journal across files, external-edit review sheets and recovery | The largest source of complexity | **No mirror.** Agents use the CLI. Storage stays SQLite with opaque Loro bytes. |
| Semantics written in Swift on loro-swift | loro-swift already wraps Rust through UniFFI. The Swift semantic interpreter is not shared with Tauri or the Worker; fine-grained access also crosses FFI repeatedly. | Semantics live in **our Rust crate**, behind coarse calls. We own the binding/toolchain; lower call overhead is measured, not assumed. |
| One relay entry per edit, one replay entry per ack | ~6 minutes to clear 1,000 hosted edits | Bounded batching of the outbox and replay |

Carried forward because they were proven:

- The text draft and edit ancestry, not host-frame replacement. Spike 3
  showed that replacing a focused field with every host frame turns `abcXYZ`
  into `abcXYZXYX`.
- The accepted-vs-durable confirmation policies.
- Immutable outbox batch IDs and hashes.
- Separate server-ack and client-applied receipts.
- An incoming cursor that advances only after a durable import.
- A relay that is an opaque ordered byte log.

## 4. Target architecture

### 4.1 Components

| Component | Owns |
|---|---|
| `hitslop-core` (Rust) | One `LoroDoc`, descriptor interpretation, `$id` resolution, validation, intents→Loro ops, atomic batches, projection and patches, preserve-and-flag issues, text splices at a base version, export/import |
| Swift `DocumentOwner` (actor) | `writer.lock`, one core handle, SQLite persistence (format unchanged: checkpoint + appended updates), save coalescing and `flush`, broadcasting patches to attached views, the socket server, and later the sync outbox and connection |
| WebView SDK (`@hitslop/document`) | Typed intent builders, the frozen snapshot store with structural sharing, text drafts and ancestry, local previews, and promises for acceptance and durability |
| CLI (`hitslop-native`, `@hitslop/cli`) | Forwards to the lock holder, or becomes the owner in-process |
| Durable Object (later) | Room auth, an ordered opaque byte log, idempotency keys, and compaction via the WASM core |

### 4.2 The core's API (JSON in, JSON/bytes out)

```rust
Document::create(schema_json, initial_json, id_seed) -> Document
Document::open(schema_json, checkpoint: Bytes, updates: Vec<Bytes>) -> Document
doc.snapshot() -> Json            // { version, value, issues }
doc.apply(batch_json) -> Json     // { ok: { version, ids, patch } } | { error: { code, opIndex, message } }
doc.export_since(version) -> Bytes    // SQLite append + sync outbox
doc.checkpoint() -> Bytes
doc.import(bytes) -> Json         // { version, patch, issues }
doc.version() -> Json             // opaque frontiers token
```

- Each call crosses FFI once. The placement spike showed that per-row crossings
  were the slow design; a container-ID index and confirmed move patches fixed
  it.
- The same crate compiles to a UniFFI xcframework (macOS/iOS), a native crate
  (Tauri), and wasm-bindgen (browser dev preview, Bun conformance tests,
  Workers).

### 4.3 Flow

```
 WebView (Svelte SDK)            Swift DocumentOwner (actor)            CLI / agent
 ─────────────────────           ─────────────────────────────          ───────────
 doc.fields.tasks.insert(v) ─┐   holds writer.lock + hitslop-core   ┌── slop apply --op …
 bindText → splice{base}  ───┼─▶ core.apply(batch) → patch ──┬───────┘   (socket if the app owns;
 doc.change(tx => …)      ───┘        │                      │           in-process if closed)
                                      │                      ▼
 snapshot store ◀── patch ────────────┼──── broadcast to every attached view
                                      ├──▶ SQLite append (export_since), coalesced; flush() = barrier
                                      └──▶ outbox → Durable Object relay (later; opaque bytes)
```

### 4.4 One edit path

- **The document is open:** the app holds `writer.lock` and the
  `DocumentOwner`. `hitslop-native` forwards `get`/`apply`/`batch`/`import`
  over the existing Unix socket.
- **The document is closed:** `hitslop-native` takes `writer.lock`, links the
  same Rust library, constructs a `DocumentOwner`, applies, saves and exits.
  **No WebKit.**
- Never bypass a busy lock or unlink `writer.lock` (unchanged).
- Export and the Finder icon still render the authored view in a WebView, fed
  the owner's snapshot. Rendering is the only thing WebViews do.

### 4.5 Intents (a single wire shape for the SDK, socket and CLI)

```ts
type Seg = string | { id: string };              // key, or list row by $id
type Path = Seg[];
type Anchor = { before: string } | { after: string } | {};   // {} = end

type Intent =
  | { type: "set";       path: Path; value: unknown }
  | { type: "increment"; path: Path; by: number }
  | { type: "insert";    path: Path; value: object; at?: Anchor; id?: string }
  | { type: "remove";    path: Path; id: string }
  | { type: "move";      path: Path; id: string; to: Anchor }
  | { type: "splice";    path: Path; base: string; index: number; delete: number; insert: string };

type Batch = { intents: Intent[]; message?: string; origin: "view" | "cli" | "import" };
```

- **A batch is atomic.** Start with fork/stage isolation and publish only a
  completed candidate. Validation observes earlier operations in the same batch,
  including inserted and removed rows. Rejection leaves state, version and emitted
  publications unchanged. Loro transactions do not roll back applied operations.
  Removing staging is a separate optimization requiring equivalent proof.
- **Paths never use indices.** Intents based on an old snapshot still target
  the right row. Intents on removed rows reject with `path_not_found`; they
  are never retargeted.
- **The host mints `$id`s.** `insert` may carry a caller-chosen `id` when
  later intents in the same batch need to reference the new row.
- **Splice indices are UTF-16**, applied through Loro's `*_utf16` APIs.
- **Stable error codes:** `path_not_found`, `type_mismatch`, `out_of_range`,
  `duplicate_id`, `stale_base`, `too_large`, `unknown_intent`.

### 4.6 Host → view

- On mount: `{ type: "state", version, value, issues, status }`.
- After every accepted local batch, CLI batch or remote import:
  `{ type: "patch", version, ops, origin, batchId? }`. `ops` are path
  operations keyed by `$id`, derived from Loro diff events.
- The SDK applies patches to a deeply frozen, **structurally shared**
  snapshot. Unchanged rows keep object identity, so Svelte keyed `{#each}`
  skips them.
- `status` events: `pending` / `saved` / `save-failed`, and later `synced`.
- Add an owner-session identity and monotonically increasing publication sequence,
  plus the preceding sequence on patches. A gap or new owner session requests a
  fresh state; old replies cannot overwrite a newer publication. CRDT versions
  describe history and are not transport sequence numbers.
- Requests need an identity and content hash before automatic retries are enabled.
  Cache identical accepted retries within the owner session; reject changed content
  under the same ID. Durable retry receipts and owner-restart outcomes belong to S3.
  Without a durable receipt, report an unknown outcome and require `get`, never
  silently resubmit an increment/insert.
- Patches must carry changes to `issues`, not just document values. Full-state
  recovery is explicit; it is not a persistent JSON mirror.

### 4.7 No optimistic updates

| Kind of edit | Behavior |
|---|---|
| Structural (checkbox, insert, move, remove, set) | Send the intent; the view updates when the patch arrives. The Swift-native control demonstrated low latency, but the Rust prototype currently misses the gates above and needs cheaper publication. Authors write no rollback code. |
| Text (`bindText`) | The DOM owns the draft while edits are pending. Serialize submissions per binding and retain the draft's authored frontier/parent edit separately from the current merged publication. Recompute queued splices against acknowledged authored ancestry; never apply coordinates calculated after an unacknowledged insertion to an older confirmed string. Historical edits may use `fork_at` plus merge, subject to S2. Composition sends only committed text. Reconcile selection after pending edits settle. |
| Previews (slider drag, color scrub) | Local SDK overlay; nothing is sent until commit. |
| Read-after-write | `doc.current` is stale until the patch lands, so intents return `Promise<{ version, ids }>`. Example: `const [id] = (await tasks.insert(v)).ids;` then focus the new row. |

If measurement at large sizes ever demands it, the SDK can add a
pending-intent overlay rebased on each patch. That is safe because the host
stays authoritative. Do not build it now.

### 4.8 Storage

- Keep the SQLite format-2 envelope for the experiment. Engine placement alone
  does not require changing tables or the envelope format. Loro layout changes
  require a separate storage-revision decision; async SDK behavior requires an ABI
  decision. Neither automatically implies a SQLite format bump.
- The owner appends `export_since(lastSaved)` on each coalesced save. It
  writes a checkpoint on close and at a size threshold.
- A failed save retains the in-memory edits and the lock, and shows the
  native retry. Close and export wait for a successful save (unchanged).
- Attachments are unchanged: host-owned immutable blobs.

### 4.9 Sync (design only; built after launch)

- Commit local updates and their immutable outbox IDs/bytes/hashes in the same
  SQLite transaction. Only committed entries may be sent. Batch transport without
  changing an already assigned retry ID or its bytes.
- The Durable Object appends to an ordered log keyed by idempotency ID and
  broadcasts.
- A client imports remote updates → patch broadcast. Persist imported bytes and
  the incoming cursor atomically before acknowledging application. A server upload
  ACK does not advance that cursor. Missing dependencies and poisoned-log recovery
  need explicit S6 policies; the archived reject-and-pause behavior is not complete
  production recovery or preserve-and-flag semantic parity.
- For late joiners, the Durable Object serves the last compacted snapshot
  (produced by the WASM core) plus the log tail.
- Local → shared: upload a checkpoint as the room seed. Peer IDs are never
  persisted (unchanged).
- CLI and agent edits are ordinary local batches, so they sync like any
  other edit.

## 5. SDK and DSL: what stays, what changes

**Stays:**

- `defineDocument` / `s` descriptors as **pure data**. The Rust core
  interprets `state.schema.json`.
- `useDocument(schema)`, `doc.current` (immutable snapshot), `doc.fields.*`,
  `doc.at(row)`, `bindText`, `bindValue`, `<Slop>` with its `icon` and
  `exportView` snippets.
- `ctx`: `capture`, `attachments`, `theme`, `window`, `reportError`.
- `$id` application identity (host-minted, never a Loro container ID).
- `issues` (preserve-and-flag). It is needed once merges happen and is
  computed in the core.

**Changes:**

- **Handles are intent builders** that return `Promise<Accepted>`.
  `doc.change(tx => …)` stays a synchronous callback. It collects intents
  into one atomic batch and returns a promise. Reads come from the snapshot;
  `tx` is write-only (already today's rule).
- **Status:** `doc.status` is `pending` | `saved` | `save-failed` (later
  `synced`), and `flush()` means durable locally. `full` becomes host UI only.
- **Counters:** retain a distinct counter concept while S4 evaluates alternatives.
  A per-writer contribution map is a hypothesis, not a fix. Specify arithmetic,
  overflow, concurrent set/increment behavior and growth with fresh session peers
  before choosing its representation. Do not replace `s.counter()` with a number
  register as part of the placement experiment.
- **Spike schema subset:** `text`, `string`, `boolean`,
  `number({int?, min?, max?})`, `enum`, `optional`, `object`,
  `list(object)`. S1 begins smaller as specified below. This is a coverage limit,
  not permission to remove records, scalar lists, trees or rich text from production.
- **JSON import:** retain destination-version checking, identity preservation and
  staged translation until the core proves equivalent behavior. Calling replacement
  one batch does not remove the translation work or authorize replacing collections.
- **Compatibility gate:** asynchronous handles change observable ABI behavior.
  Production cutover needs a separate explicit decision about supported documents
  and authored apps. No reset, old-package refusal, fixture replacement or template
  retirement is authorized by this plan's spike phase. Preserve all sealed bytes.

## 6. Spikes

Each spike lives in `spikes/<name>/`, is disposable, and ends with a
`REPORT.md` covering the question, method, results, verdict, and what changes
in this plan. Evidence goes under `.hitslop/v1-evidence/<name>/`, following
the existing conventions: five fresh processes per cell, rotated candidate
order, frozen executable and asset hashes, and medians of per-process p95s.
Reuse the engine-placement harness (`spikes/engine-placement/run.ts`, `web/`,
`Sources/Harness`) and the document-authority harness
(`spikes/document-authority/Sources/Harness`) wherever possible.

S1 is the first go/no-go and includes patch correctness and a minimal text-ancestry
screen. Complete S2, S3, S4, S5 and the compatibility/coverage decision before a
production cutover. S6/S7 remain later work. Initial implementation is deliberately
incremental: report completed gates and gaps rather than claiming S1 passed after
the crate merely compiles.

### S1: `hitslop-core` in Rust, native and WASM (go/no-go)

- **Question:** Can one Rust crate on `loro` 1.16.2 own hitSlop semantics
  behind a coarse API, run natively in the Mac app and as WASM in Bun, and
  beat or match the native-Loro candidate?
- **Build:**
  - Crate `spikes/hitslop-core/core` implementing the checklist subset
    (`text`, `boolean`, `object`, `list(object)`), with `set`, `insert`,
    `remove`, `move`, `splice`; `$id` minting; atomic batch; patches from
    Loro diff events; `export_since`, `checkpoint`, `import`.
  - A UniFFI xcframework (arm64 macOS) consumed from a SwiftPM target.
  - A wasm-bindgen package consumed from Bun.
  - A conformance fixture table `fixtures/*.json`
    (`{schema, before, batch, after | error, patch}`), run by **both** Bun
    (WASM) and Swift (native). Expected values/errors come from independent literal
    scenarios and applicable current semantic fixtures. Agreement between two
    bindings to the same buggy core is insufficient proof.
  - Patch application must reproduce both a fresh snapshot and its issues after
    local edits and imports. Include stable row identity, sequential batch paths,
    Unicode, rejection, malformed imports and checkpoint/update reopening.
  - A minimal inherited `abc` → `abcXYZ` pending-input/remote-edit screen with
    explicit ancestry; full system-IME/selection coverage remains S2.
  - A headless native edit/reopen without WebKit and a renderer destruction/remount
    check. Process startup, writer routing and crash durability remain S3.
  - A new `rust-core` candidate in the engine-placement matrix, using the
    same Svelte view and workloads.
- **Measure:**
  - checkbox, move, splice and paste acceptance
  - render opportunity
  - sustained typing drain
  - open time
  - memory at 100/1k/5k/40k rows × 1/5/10 windows
  - FFI call cost
  - xcframework size and app-size delta
  - WASM size
- **Pass:**
  - In ordinary 1k/5k × 1/5/10-window cells, every-run checkbox/move acceptance
    p95 ≤ 50 ms; render-opportunity median p95 ≤ matched WASM + 16.7 ms;
    every-run sustained typing drain < 50 ms.
  - Relative to the freshly measured Swift-native control, median acceptance p95
    regression ≤ max(2 ms, 20% of control), memory regression ≤ 10%. Exceeding a
    comparative budget triggers profiling and an explicit decision, not weakened
    correctness. Report 40k stress tails separately; they do not veto the ordinary
    product envelope or get hidden in pooled medians.
  - Every fixture passes identically in Bun and Swift.
  - The xcframework builds from a script under the pinned Xcode/XcodeGen and
    signs with the hardened runtime and the current entitlements.
  - **Atomicity:** reject a later operation after earlier operations have executed
    on the stage, proving unchanged live state/version and no publication. In a
    disposable source copy, bypass staging and verify the same owner test fails
    for partial mutation. Never run a sensitivity script against production source.
- **Kill or adjust:**
  - If the UniFFI/xcframework toolchain can't be made reproducible in CI,
    evaluate `swift-bridge` or a C ABI with cbindgen before abandoning the
    Rust core.
  - If performance loses to native Loro, profile the patch derivation first.

### S2: Text ancestry and IME on `splice{base}`

- **Question:** Does the host-owned text binding stay correct under
  latency, remote edits and IME, using base-version splices?
- **Method:** Port the spike-3 matrix from
  `_docs/hitslop-sync/docs/native-loro-bridge-spike.md`:
  - three inputs before acknowledgement at 0/20/100/500 ms injected delay
  - remote edits around acceptance and during composition
  - Unicode (emoji, combining marks, CJK)
  - paste, selection replacement, backspace
  - native AppKit keyboard events through `WKWebView`, including the focused
    responder's undo/redo
  - CLI `splice`/`set` on the focused field
  - CLI `remove` of the row whose text field is focused
  - renderer reload with pending drafts
- **Pass:**
  - The final text is exact in every trace (e.g. `abc` → `abcXYZ`, never
    `abcXYZXYX`).
  - The caret never jumps.
  - Nothing is sent mid-composition.
  - A focused-row removal blurs cleanly without resurrecting the row.
  - A failed save keeps the DOM draft.
  - A system IME (Japanese/Chinese) manual gate is recorded with the enabled
    input sources.
- **Output:** the `bindText` contract, plus SDK-boundary Bun tests with a
  fake host for the non-IME cases.

### S3: Single edit path, locks and CLI cold start

- **Question:** Is "forward vs. own" race-free, and is headless CLI editing
  fast without WebKit?
- **Method:** A scripted harness that interleaves:
  - CLI `batch` while the app is opening the document
  - CLI `batch` during the close/save barrier
  - two CLIs at once on a closed document
  - the app opening while the helper owns it
  - the helper killed mid-batch and mid-save (`SIGKILL`)

  Time helper launch → lock → open → apply → save → exit at 100/1k/5k rows,
  and compare with today's headless WebKit path.
- **Pass:**
  - Within an owner session, identical request retries return the recorded result
    without applying again. Across owner restart, a durable receipt proves the
    outcome or the helper reports an unknown outcome requiring `get`; no blind
    replay. Do not claim exactly-once retry across restart without durable receipts.
    No lock is bypassed and no loss is silently reported as success.
  - With the window open, a CLI edit reaches the view in one patch.
  - Reopening after a kill yields the old or the new state, never a torn one.
  - Helper cold-start apply ≤ 150 ms at 1k rows.
- **Output:** the socket method set, retry codes, and the app's behavior when
  the helper holds the lock (proposed: short wait, then "being edited" with
  retry; never steal the lock).

### S4: Counters, merges and preserve-and-flag in the core

- **Question:** Does the proposed per-writer counter converge where Loro
  Counter doesn't, and do merged anomalies surface as issues rather than
  corruption?
- **Method:**
  - First specify numeric domain (exact bounded integers, decimal or float),
    overflow, deterministic summation, set/reset versus increment, contribution
    ownership and growth after many reopen sessions. Do not claim exact arbitrary
    floating-point sums without a representation that provides that property.
  - Two and three replicas with concurrent increments, including large
    values near the safe-integer boundary and cancellations.
  - Export/import regrouping (reproduce `spikes/engine-placement/counter-probe.ts`
    against both designs).
  - Restoring an old checkpoint on one replica, then merging.
  - Finder-copy duplication (two packages with a shared history) editing and
    merging.
  - Concurrent `$id` duplication and move+remove; valid concurrent enum sets stay
    in the enum, while an explicitly malformed imported enum value is preserved
    and flagged. Two valid last-writer-wins enum writes alone cannot create a new
    invalid enum member.
- **Pass:**
  - Counter replicas converge to the independently specified arithmetic result;
    exactness and overflow behavior match the chosen numeric domain.
  - The counter-probe failure reproduces against Loro Counter but not against
    the new design.
  - Anomalies are preserved and reported in `issues`, never repaired on read.
  - Local writes stay strict.

### S5: Patch publication and snapshot structural sharing

The correctness subset is part of S1; this phase expands randomized coverage and
proves rendering cost. It is a cutover gate, not optional follow-up work.

- **Question:** Are `$id`-keyed patches derived from Loro diff events correct
  and cheap, and does the SDK's structural sharing keep Svelte re-renders
  proportional to the change?
- **Method:**
  - Property test: random intent batches (and random remote imports) →
    apply the core's patches to the previous snapshot → compare with a fresh
    `snapshot()`.
  - Count re-rendered rows per edit in the Svelte view at 1k/5k rows.
- **Pass:**
  - Zero divergence across ≥100k random steps.
  - A single-row edit re-renders O(1) rows.
  - Patch build + transfer + SDK apply p95 ≤ 2 ms at 5k rows.

### S6: Sync protocol on the core (design check before building collaboration)

- **Question:** Does spike 4's outbox/relay protocol carry over to the Rust
  core with batching, and does the Worker compaction path work?
- **Method:**
  - Port `_docs/hitslop-sync/Prototypes/native-loro-relay` and the
    `SpikeDocument`/`SpikeBatch`/`SpikeConnection` logic onto
    `DocumentOwner` + `hitslop-core`.
  - Add bounded upload and replay batching.
  - Run the core's WASM build in the Durable Object to produce compacted
    snapshots.
  - Two Mac clients plus one CLI agent in one room.
  - Rerun spike 4's failure table: force quit offline, crash before send,
    dropped ack, crash after ack, relay restart, invalid peer bytes,
    quota/revocation.
- **Measure:** backlog clear time for 1,000 edits (spike 4: ~6 min hosted),
  late-join bootstrap time and bytes, Worker CPU per batch, WASM bundle size
  against Worker limits.
- **Pass:**
  - Every failure case recovers as spike 4 required.
  - The 1,000-edit hosted backlog clears in ≤ 10 s.
  - Late join at a ~1.4 MB document completes in ≤ 3 s.
  - Compaction runs within Worker CPU and memory limits.

### S7: iOS and Tauri smoke (portability check; not blocking launch)

- **Question:** Does the same crate and API really drop into iOS and Tauri?
- **Method:**
  - Build the xcframework for iOS arm64 and simulator. Open a Quick
    Checklist document in a minimal SwiftUI + `WKWebView` host with the same
    SDK.
  - Build a minimal Tauri app that links the crate natively, with the same
    SDK over Tauri IPC, on Windows (WebView2) and Linux (WebKitGTK).
  - Run the S1 fixture table on each platform.
- **Pass:**
  - Fixtures are identical on every platform.
  - Checklist edit, save and reopen work.
  - The platform-specific code is limited to lock, path, lifecycle and IPC
    adapters.

## 7. Conditional production phases (not authorized by starting the spike)

Before these phases, review complete semantics/identity/issues coverage, S1–S5
evidence and compatibility. The async ABI requires a deliberate product decision:
preserve supported consumers through a proved design, or explicitly authorize a
prelaunch reset. The current contract remains in force until then. Do not infer a
reset from this proposal or weaken tests to make the smaller interpreter pass.

1. **Core**
   - Promote `hitslop-core` into the repo (e.g. `crates/hitslop-core`), with
     reproducible xcframework and WASM build scripts wired into
     `bun run build`.
   - The fixture table becomes the semantics contract, run in Bun and Swift.
   - TypeBox owns the intent, patch, state and descriptor contracts; run
     `bun run schema:generate`.
2. **Swift owner**
   - `DocumentOwner` replaces the engine half of `HitSlopWasm/WasmSession.swift`.
   - `Storage.swift` keeps its SQLite role but stores core-exported bytes.
   - `SocketServer.swift` gets the new method set.
   - `DocumentCommand.swift` / `NativeCLI.swift` implement forward-or-own.
   - Delete `headless.js`, the headless page in `SchemeHandler.swift`, and the
     Loro resources in `RuntimeCatalog.swift`. Rename the module to
     `HitSlopDocument`.
3. **SDK**
   - Rewrite `packages/document/src` (`document.ts`, `operations.ts`,
     `handles.ts`, `projection.ts`, `session.ts`, `json-import.ts`,
     `storage.ts`, `boot.ts`) around intent builders, the patch-driven
     snapshot store, `bindText` per S2, and previews.
   - `slop dev` hosts the WASM core in the page.
   - Introduce the approved ABI change with new fixtures; never rewrite sealed ones.
4. **CLI** (`packages/cli`)
   - `get`/`apply`/`batch`/`import`/`schema` use the intent shape.
   - Remove `compact` unless S1 shows a checkpoint command is still useful.
   - Apply the separately approved runtime compatibility policy.
5. **Slops**
   - Port Quick Checklist, then Small Expenses as the second black-box
     fixture. Preserve the active template inventory; a smaller product catalog
     requires a separate product decision and is not a placement optimization.
   - Update the `init` starter and the embedded `hitslop-document` skill.
   - Update README examples only for the API actually selected and proved.
6. **Contracts and docs**
   - Rewrite the affected lines of `AGENTS.md` and
     `docs/engineering-contract.md`:
     - "Loro in the WebView owns live state" becomes host ownership via
       `hitslop-core`.
     - "no second engine" stays true (one core).
     - The collaboration-readiness line is updated.
   - Update `docs/versioning.md`, `docs/testing.md` and the five-column test
     ledger.
   - Keep sealed runtime bytes and release records as history.
7. **Later:** sync (S6 → production), iOS and Tauri (S7 → production),
   additional descriptors as slops return.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Rust/UniFFI toolchain adds build and CI complexity | S1 requires a reproducible scripted build; `swift-bridge`/cbindgen fallback; a prebuilt xcframework cached in CI |
| Rust panics crash or invalidate the owner | Use unwind-capable native builds and boundary containment; never keep using a potentially mutated owner after a panic. Recovery reloads durable state under the lock. Catching panics does not catch OOM/abort; document platform-specific limits and fuzz bounded imports. |
| Decoding untrusted bytes in the host's crash boundary | Allocation limits, size caps before import, and fuzzing `open`/`import` in S1 and S6 |
| Full history growth | Capacity checks stay; history pruning remains deferred to the sync design |
| Peer-ID reuse | Peer IDs are never persisted (unchanged); fresh per session |
| Loro version pins | Pin in `Cargo.lock`; record the storage-revision decision per pin (unchanged rule) |
| Two languages (Rust core, TS SDK) | Clean split: semantics in Rust only; the TS SDK is presentation (intent builders, snapshot store, bindings) with no document rules |

## 9. Open questions

- Should undo (deferred) use Loro's `UndoManager` in the core, scoped per
  origin so a CLI edit isn't undone by Cmd-Z in the window? Decide before
  freezing the batch `origin` field.
- Should accepted confirmation (fast) or durable confirmation (spike 3's
  recommendation) be the default for `await intent`? Proposed: resolve on
  accepted, with `flush()` for durability; S2 and S3 decide.
- How is the patch granularity for text (full string vs. delta) chosen per
  field? Proposed: delta for fields with an active `bindText`, full string
  otherwise.
- Does the Durable Object validate schema on append, or is that deferred
  until abuse appears? Proposed: room-level auth only at first; the core can
  validate later without a protocol change.

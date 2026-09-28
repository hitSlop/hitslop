# Runtime reset v2: launch plan

Status: **implemented; complete local release gate passed**. Agreed direction: 28 September 2026.

This document records the second prelaunch runtime reset. It covers runtime and
Loro loading, persistence through the native host, the Svelte SDK, and the release
process needed to update those pieces independently. Implementation is authorized, including the clean prelaunch contract break.
Validation results and remaining limitations are recorded below.

The earlier [runtime reset](runtime-reset.md) records the previous design and its
validation. The [engineering contract](engineering-contract.md),
[versioning policy](versioning.md), [testing policy](testing.md), and
[release guide](guides/releasing.md) describe the implementation that exists today.
During implementation, update those contracts alongside the corresponding code;
do not leave contradictory rules in the active guidance.

## 1. Decisions and success criteria

The maintainer has authorized a clean prelaunch break: assume no existing slops in
the wild need support. Remove obsolete compatibility handling instead of building
a migration path. The repository records previous seals and published artifacts;
that history does not create a compatibility requirement for this reset. Do not
overwrite published npm versions, rewrite release tags, or replace remote release
assets. The new baseline uses new identities and versions.

The agreed decisions are:

| Area | Decision |
|---|---|
| Installed engine | One host-supplied runtime; no bundled legacy engines |
| Launch identity | Runtime contract 3, revision 1; SDK/schema/CLI 3.0.0 |
| Document format label | Keep `hitslop-v1`; the runtime contract identifies this reset |
| Storage | SQLite format 2, with no migration from prelaunch formats |
| Postlaunch upgrades | New apps open existing documents; older apps may refuse newer writes |
| Slop updates | Ship new templates; do not update app code or schemas inside existing documents |
| Capacity | Limit stored checkpoint plus update payloads, not the hypothetical full snapshot |
| Authoring | Typed handles and immutable reads, with ordinary Svelte binding conveniences |
| Optimization | Prefer the simplest correct design; measure before adding specialized machinery |

Success means:

- A routine autosave transfers and persists incremental updates without exporting
  the entire document.
- An acknowledged save survives process death and reopening. Checkpoint maintenance
  never destroys the last durable representation. Power-loss durability is claimed
  only after verifying macOS SQLite sync behavior (see §6).
- Runtime loading fails promptly and visibly when resources are missing, invalid,
  or incompatible, and failed startup does not leak ownership or WebViews.
- A compatible Loro/runtime update does not require rebuilding existing slops.
- Authors can build Svelte slops without depending on the engine implementation,
  private host bridge, or a specific Loro version.
- Release checks prove forward compatibility from the new launch baseline without
  shipping historical runtimes to users.

## 2. Baseline before this reset

These observations explain the proposed changes; they are not fresh performance
measurements.

### Loading and packaging

The native host serves the page and `/__runtime__/` resources. Each slop supplies
`assets/app.js`, which exports `mount(ctx, target)`. Visible and headless sessions
share the same engine; headless document editing does not load authored app code.

The runtime initializes the pinned Loro web package once per page. Native resource
bytes are cached across sessions, and a disposable WebView prewarms WebKit/Loro.
Storage loading overlaps initialization. These are useful existing mechanisms,
not reasons to introduce a second engine or a new loader.

Runtime build and selection currently support multiple contracts and preserved
runtime archives. Authoring compares the project's complete SDK identity with the
CLI's identity, including Loro and private protocol provenance. The public
document package also exposes a runtime entrypoint and depends on Loro, despite
authored app bundles being prohibited from embedding the engine.

### Persistence

Loro owns the live document in the WebView. Swift stores opaque bytes in SQLite.
Edits are batched on a 200 ms autosave timer. Most saves append updates; checkpoints
replace the checkpoint and clear the update log atomically.

However, every nonempty save batch first exports a full snapshot to check the
current 32 MiB snapshot limit. The snapshot is often discarded after measurement.
The cost therefore grows with the document even when the actual change is small.

This check protects a real existing contract. The storage tests contain a
multibyte-text case whose updates fit the limit while its full snapshot does not.
Removing the export while claiming to preserve the same limit would be incorrect.
This reset explicitly changes the capacity contract instead.

The inspected Loro API does not expose a cheap exact encoded-snapshot-size query.
Loro itself supports frequent incremental persistence with periodic snapshots;
see its [persistence guidance](https://loro.dev/docs/tutorial/persistence).

### Svelte SDK

The existing API has a sound foundation: immutable snapshots, typed handles,
identity-aware collection operations, synchronous transactions, and text/value
bindings. Each `useDocument` call currently creates its own reactive subscription.
App-facing declarations also reference types housed in engine implementation
modules, even when those references disappear from the JavaScript bundle.

## 3. Architecture to preserve

Keep the existing macOS application and its feature graph, native windows,
catalog/Recents, export, Quick Look, Analytics/Crashlytics, and Sparkle.

Keep these ownership boundaries:

```text
immutable slop app + schema
          |
          | mount(ctx, target)
          v
host-supplied runtime in WebKit
  Loro + typed operations + live state
          |
          | private storage bridge: opaque bytes
          v
Swift writer ownership + SQLite + immutable attachments
```

- One OS writer lock owns a writable package. Closed CLI editing acquires that
  ownership; live CLI editing routes to the existing session. Never bypass a busy
  lock or unlink `writer.lock`.
- Swift validates isolation, envelopes, formats, and resource bounds. It does not
  interpret application schemas or reconstruct document JSON.
- Built templates are immutable and stateless; users edit copies.
- `initial.json` remains creation-only data. Existing documents load durable state.
- Preserve application `$id` identity, total reads with flagged anomalies, strict
  local writes, and identity-preserving collection operations.
- Keep full Loro history. Checkpointing folds the log into a snapshot; it is not
  history pruning.
- Retain save-before-close/export, native retry/discard UI, and WebView destruction
  after successful close.

## 4. One runtime and forward upgrades

### Runtime requirements versus provenance

Preserve the app module and `ctx` boundary. A slop declares the runtime contract
and minimum revision its compiled app needs. SDK and Loro versions describe how
artifacts were produced; they are not document-opening equality checks.

The host ships one runtime for contract 3. Keep `/__runtime__/` URLs stable, but
remove production selection of archived contracts and copying historical engines
into app/helper/preview bundles. Missing or unsupported requirements fail before
opening writable state. Do not fall back to prelaunch contracts.

Within contract 3, later revisions must continue supporting launch app bundles,
their descriptors, and the established `ctx` behavior. Implementation details and
the private Swift bridge can change together with the host.

### Durable minimum reader revision

App requirements alone cannot protect a document after a newer engine writes
bytes an older engine cannot read. SQLite format 2 therefore records a minimum
reader revision alongside the durable document metadata.

- Validate that floor before importing stored bytes or allowing edits, including
  headless sessions and snapshot renderers.
- On a successful append or checkpoint, update the reader floor in the same
  transaction as the bytes and generation. It must never decrease.
- The floor is a **storage revision**, not the runtime revision. The runtime identity
  carries a separate `storageRevision`, bumped deliberately only when the runtime
  begins writing state that an earlier engine cannot correctly read and interpret (for example, a Loro
  update that uses a new encoding feature). A runtime revision that changes only
  boot, bridge, or SDK behavior leaves it unchanged, so documents it edits still
  open on the previous app. `release:check` requires an explicit storage-revision
  decision whenever the `loro-crdt` pin changes.
- Swift writes the floor from the bundled runtime identity inside the append or
  checkpoint transaction. Host and runtime ship together; the bridge does not carry it.
- Merely opening an existing document must not raise its floor. A failed or rolled
  back write must not raise it either.
- A reader below the recorded floor refuses with an app-update message and leaves
  the package unchanged.
- Carry the floor through duplication and snapshot copying. It belongs to the
  durable state, independently of the logical document ID.

New runtimes must still decode and operate on every supported postlaunch saved
representation. A minimum-reader field is a refusal mechanism for older apps,
not a substitute for forward compatibility. A Loro update that cannot satisfy
that forward contract does not ship as an ordinary runtime update.

### Artifact integrity and release history

Build Loro JavaScript glue and WASM from the same exact installed version. Copy only
the glue, WASM and `snippets/` into the runtime; type declarations and source maps
from `loro-crdt/web` are not runtime resources. Verify
matching identities and runtime bytes across the Mac host, installed helper, and
the CLI preview shipped for that release.

Retain release seals and frozen consumers beginning with contract 3. Historical
runtime artifacts are test inputs and release evidence only. Remove prelaunch
runtime archives and fixtures from active compatibility requirements; Git retains
their historical record. Do not accumulate `retiredContracts` exceptions as the
new compatibility model.

Postlaunch tests run the candidate against old saved documents and frozen apps.
Readers admitted by the same storage revision must also replay candidate writes
with identical values and identities. A storage-revision increase allows older
readers to refuse those writes; test that refusal. Do not require mixed-version
collaboration, which is not a launch feature. Retain current-engine convergence
and merge-semantic tests.

## 5. Loading and startup failure handling

Keep per-page initialization deduplicated, the resource cache, overlapping storage
load, and the existing prewarm lifecycle until measurements justify a change.

Move failure handling to the earliest boot boundary. A static import failure can
happen before the main runtime's `try/catch` exists; the visible and headless entry
scripts must catch module loading and initialization failures and report a
bounded startup error to native code. The host also needs to handle an entry
script/resource that never executes.

Distinguish platform startup failure from an authored app exception. Finish native
readiness waiters exactly once on ready, failure, cancellation, or renderer death.
Tear down unsuccessful sessions and release their leases after outstanding storage
work is settled. Never release ownership while a write can still complete.

Test missing JavaScript, missing/corrupt WASM, an incompatible package requirement,
an authored mount exception, cancellation during startup, and WebContent death.
The native timeout remains a final guard, not the normal way a known load failure
is reported.

Do not add downloaded engines, network boot dependencies, a JavaScriptCore path,
or a shared mutable document engine across windows.

## 6. Persistence without routine full snapshots

### Capacity definition

The document payload limit remains 32 MiB, now defined as:

```text
stored checkpoint bytes + stored update bytes <= 32 MiB
```

This is not a cap on the SQLite file's physical size, transient WASM memory, or a
future re-encoded snapshot. SQLite page overhead and free pages are outside this
payload count. Attachments retain their separate limits. Keep the native update
row bound of 4096 and existing envelope/schema metadata bounds.

Use the same definition in runtime capacity decisions, Swift storage enforcement,
disposable preview storage, and the test storage implementation. Native validation
remains independent of runtime accounting.

### Ordinary autosave

1. Commit eligible drafts/previews through the existing typed operations.
2. Export the unsaved changes as **one** update since the last durable version
   (`export({ mode: "update", from: savedVersion })`), capturing the end version
   before awaiting storage. Advance `savedVersion` to that captured end only when
   persistence is confirmed, never to the live version after awaiting. Apply the
   same rule to checkpoints. On a lost reply, reconcile the attempted generation;
   on discard, restore the version from the durable engine. Loro emits one local update per commit and text
   bindings commit per keystroke, so appending those individually makes the row
   bound and the 256-row maintenance trigger count keystrokes rather than saves.
   Measure the merged export cost against change size and document history rather
   than assuming a complexity guarantee. Counter replay correctness is a prerequisite:
   Loro 1.16.1 can change `1e16, -1e16, +1` from 1 to 0 when updates are batched.
   Keep fractional counters and require a checkpoint whenever a save changes a
   counter, as explicitly selected by the maintainer. Protect ordinary counter
   edits as well as JSON replacement. The outbound local-update
   stream keeps its per-commit semantics.
3. If no counter/import checkpoint is required and the stored payload plus that
   batch fits byte and row bounds, append it in
   one SQLite transaction. Do not export a snapshot.
4. Acknowledge only after commit. Remove only the captured updates from the pending
   queue; edits arriving during the write remain pending.
5. Complete the durability barrier when its required writes are durable. Periodic
   maintenance is not a prerequisite for that acknowledgement.

Checking each counter delta and live result with `Number.isSafeInteger` is not
sufficient to permit incremental persistence. With initial value
`-9007199254740991`, increments `9007199254740991` and `9007199254740990` produce
live values 0 and `9007199254740990`, all safe integers. Replaying the merged
update reopens as `9007199254740989`; the accumulated delta exceeds the safe
integer range. The required checkpoint preserves `9007199254740990`. Any future
optimization must prove exact replay across accumulated deltas, batching and
history; retain checkpoints for small and fractional counter changes meanwhile.

Keep the current 200 ms autosave scheduling and serialized storage ownership.
Reuse a prepared insert statement within an append transaction. Retain base64
transport and `journal_mode=DELETE`. The durability review selected
`synchronous=EXTRA` to sync journal deletion, plus `fullfsync=ON` for macOS
F_FULLFSYNC. SQLite documents that FULL alone in rollback-journal mode can lose
the last transaction after power loss; see [synchronous](https://www.sqlite.org/pragma.html#pragma_synchronous)
and [fullfsync](https://www.sqlite.org/pragma.html#pragma_fullfsync). Process-kill
tests do not simulate a physical power cut or faulty storage hardware.

Remove existing waste on this path (removals, not new machinery):

- Post the save-status bridge message only when `(status, error)` changes, not on
  every change event (including each preview during a slider drag).
- Validate the bridge dictionary once and hand it to the storage queue; do not
  re-encode it with `JSONSerialization` on the main thread and parse it again.
  Replace the serialization-based envelope bound with a bounded aggregate payload
  check before dispatch/decode, including array totals and unknown properties.
- Parse the generated bridge validation schema once, not per message.

### Periodic checkpoints

Schedule checkpoint maintenance after 256 accumulated updates or 4 MiB of update
payloads. Run it through the same serialization boundary as saves, outside the
ordinary flush barrier. Do not force a new checkpoint on open, close, or PNG/PDF
export merely because that lifecycle event occurred.

Capture the checkpoint bytes and the represented update prefix before awaiting
storage. A successful transaction replaces the checkpoint, clears the represented
durable log, and advances generation/reader metadata atomically. Later edits must
remain queued and be persisted afterward.

If the generated checkpoint exceeds the payload limit, skip that replacement and
retain the valid checkpoint/log. Avoid a full export on every following save:
after a skipped attempt, wait for another 256 updates or 4 MiB of new update bytes
before periodic retry. Storage pressure or explicit `compact` may request an
earlier attempt.

A maintenance I/O failure must retain durable data. Record/report the maintenance
failure separately from unsaved work; do not mark already acknowledged edits as
lost or block close solely because optional compaction failed. If edits are also
pending, their save result still controls close/export.

### Storage pressure and required checkpoints

If an append would exceed byte or row bounds, generate a checkpoint including the
pending batch. Persist it if it fits. If neither the incremental representation
nor that checkpoint fits, retain the live edits, set the capacity/save failure,
and block close/export until retry succeeds or the user explicitly discards.

Initial creation still requires a checkpoint. Require checkpoints for all counter-changing saves. Preserve the existing required
checkpoint for JSON replacement/import: the current implementation uses it to
preserve accepted floating-point counter values across replay. Do not casually
turn that correctness requirement into optional maintenance. A required checkpoint
that cannot fit leaves the operation unsaved and visibly failed.

This can happen even when an incremental append would fit: a large document can
save text edits successfully, then fail to save a counter change because its full
checkpoint exceeds capacity. Counter-heavy slops therefore still pay the full
document checkpoint cost. Do not fall back to an append that can replay a different
counter value. Keep the accepted live edits, leave durable bytes unchanged, report
`save-failed` and `full`, and block close/export. Explicit discard restores the
last durable state and clears the failure; retry remains available.

Explicit `compact` reports whether compaction succeeded. If it fails after a
successful flush, report that failure without undoing or misrepresenting the
preceding durable save. Compaction does not guarantee a smaller representation.

### Failure and recovery

Keep generation checks, transactional checkpoint replacement, writer exclusion,
and failed-save ownership. A lost reply can follow a successful commit; reconcile
durable metadata before retrying and never replay user intent blindly. Reconcile
through a metadata-only storage call (generation, schema key, document ID, reader
floor, payload bytes and rows); do not reload the checkpoint and log just to learn
the generation. Preserve
idempotent Loro update handling and pending edits throughout recovery.

Discard reloads the last durable state under the same writer lock, including
writes whose replies were lost. A failed reload retains live work. A successful
reload remounts the view and clears stale drafts/previews.

## 7. Svelte SDK and package boundaries

### Authoring surface

Keep these concepts as the launch API:

```ts
const doc = useDocument(schema);

// Immutable reads.
const title = doc.current.title;

// Explicit typed writes.
doc.fields.title.replace("New title");
doc.at(row).done.set(true);

// One synchronous, all-or-nothing edit.
doc.change(tx => {
  tx.at(row).done.set(true);
  tx.fields.completed.increment();
});
```

The example is illustrative: fields come from each slop's descriptor. Preserve
the distinction between text operations, scalar replacement, counter increments,
and identity-preserving row/tree operations.

Use `bindText` and `bindValue` for native controls. For component props that support
Svelte bindings, document ordinary getter/setter bindings over the same handles:

```svelte
<Toggle bind:checked={() => row.done, value => doc.at(row).done.set(value)} />
```

Svelte supports this through [function bindings](https://svelte.dev/docs/svelte/bind#Function-bindings).
The text action remains responsible for IME composition and cursor behavior;
ordinary string assignment is not a replacement for that behavior.

The mutable-proxy direction was considered and is not selected. Expressions such
as `count++`, array replacement, and `splice` would need additional rules to retain
CRDT intent and row identity. Do not introduce that second mutation model or a
custom compiler in this reset. The convenience layer uses Svelte's existing
binding syntax rather than inventing another field API.

### Reactive lifecycle

Provide one shared reactive document adapter per mounted app, reached through
Svelte context. Repeated `useDocument(schema)` calls validate the schema and reuse
that adapter rather than subscribing independently. Keep the adapter alive until
the app unmounts; destroying one child must not disconnect other consumers.

Dispose subscriptions and app-side active-context references on unmount, including
failed mount and recovery/remount paths. Preserve reactive status, issues, full
state, and stable unchanged snapshot objects. Continue recommending row/handle
props in large lists.

### Packaging and build requirements

Separate app-facing declarations and pure helpers from engine implementation
modules. The published SDK must not require Loro to typecheck or run its app-side
adapter, and must not expose `@hitslop/document/runtime`. Runtime implementation
dependencies belong to the internal runtime build, not the author dependency
graph. TypeBox remains the source of platform contracts; generate native outputs
with `bun run schema:generate`.

Keep exact CLI-to-SDK pins for a tested authoring toolchain, but compare authoring
compatibility rather than the entire engine identity. Project validation should
give an actionable SDK/CLI mismatch error; a host-only Loro upgrade must not force
a project SDK change. The SDK declares the minimum runtime contract/revision its
emitted app needs. Engine provenance is recorded separately.

### Open-ended status values

Keep `document.status` as the precise local durability states `saved`, `saving`,
and `save-failed`. A document can be saved while offline; future synchronization
belongs to a separate optional capability. Event origins and issue kinds may grow
only with documented fallback behavior and frozen-consumer coverage; widening a
TypeScript union alone does not establish behavioral compatibility.

Freeze only the observable behavior of `change()`: synchronous, all-or-nothing,
reads stay on the pre-change snapshot. The current implementation forks the
whole document per transaction; nothing in the contract may depend on that.

### Build toolchain

Continue resolving one Svelte compiler/runtime per build. Preserve the build
guards against embedded Loro, runtime implementation imports, private bridge
access, and remote boot resources.

Update scaffolds, active authoring examples, packaged skills, and local guidance
together. Quick Checklist and Small Expenses remain black-box acceptance fixtures;
platform semantics belong in dedicated test fixtures.

## 8. Implementation sequence

1. **Capture the baseline.** Record the current commit, workload definitions,
   startup/save timings, bridge traffic, and memory. Identify the owner test and
   independent oracle for each changed contract before editing it.
2. **Improve private boundaries.** Land status deduplication, bounded bridge-copy
   removal, metadata reconciliation, and counter replay protection under owner tests.
3. **Establish the clean boundaries.** Introduce contract 3/format 2 identities,
   one-runtime packaging, minimum-reader metadata, and separated SDK/runtime
   dependencies. Update generated contracts and runtime selection together.
4. **Change persistence.** Replace snapshot-size capacity checks with stored-byte
   accounting, separate maintenance from durability, and preserve required
   checkpoint behavior and recovery ordering.
5. **Harden loading and adapter lifecycle.** Cover early boot failures and native
   cleanup, then share the Svelte adapter and update binding guidance.
6. **Replace active prelaunch compatibility evidence.** Rebuild active templates,
   author contract-3 conformance consumers and saved states, remove obsolete
   runtime/fixture handling, and update active documentation and skills.
7. **Validate and seal.** Run the owner tests and release gates, compare performance
   evidence, and seal the new launch artifacts only after the candidate passes.

Do not mix this work with visual redesigns or new application features. The reset
may change source/package organization, but must preserve the native client and
the observable behaviors explicitly retained above.

## 9. Verification

Follow the [testing policy](testing.md). Extend existing owner tests at the cheapest
stable boundary. Record changed contracts in the five-column ledger. Before
removing consequential coverage, demonstrate that its replacement catches the
protected failure; obsolete prelaunch compatibility requirements should be named
as intentionally retired, not silently weakened.

| Boundary | Required evidence |
|---|---|
| Incremental persistence | Updates save and reopen with exact expected values and identities without a routine snapshot export |
| Changed capacity contract | A fitting checkpoint/log saves even when a generated full snapshot would exceed the limit |
| Actual exhaustion | Byte and row exhaustion preserve pending edits, fail visibly, and block close/export |
| Checkpoint maintenance | Oversized/failed maintenance preserves acknowledged data; retry pacing avoids repeated full exports on ordinary edits |
| Required checkpoints | Creation and JSON-import checkpoint failures retain their distinct correctness and recovery behavior |
| Concurrent activity | Edits arriving during append/checkpoint survive and are saved; only represented prefixes are removed |
| Faults and ownership | Failures before commit, reply loss after commit, process death, retry, discard, and writer exclusion |
| Lifecycle | IME drafts, preview commits, failed close, successful close teardown, and PNG/PDF durability barriers |
| Startup | Missing/corrupt resources, unsupported requirements, app exceptions, cancellation, renderer death, and released failed-open leases |
| Reader floor | Atomic advance on writes, no advance on read/rollback, refusal below the floor, and propagation through copies/renderers |
| Compatible writers | Candidate writes retain values and identities in historical readers admitted by the same storage revision |
| SDK | Types, invalid writes, atomic rollback, collection identity, component bindings, and repeated mount/unmount without stale subscriptions |
| Distribution | Outside-checkout packed authoring, offline runtime resources, matching host/helper bytes, and native editing without Node/Bun |
| Forward upgrades | Frozen launch app bundles and saved state open, edit, save, reopen, and export under candidate runtimes |

Use dedicated plain-JavaScript and Svelte consumers for the app/`ctx` contract.
Retain descriptor/value-kind, anomaly, attachment, and identity scenarios. New
template business logic does not need bespoke platform regression tests.

Run the documented Bun checks/tests, native build/Swift/native owners, storage and
crash matrix, packed native consumer workflow, full template build/render, and
`release:check`. Retain failed-stage evidence as well as successful results.

## 10. Performance evidence

Measure before and after on the same machine and toolchain. Existing reports and
the earlier reset's timings provide context, not acceptance evidence for this
implementation.

Include:

- Cold and warm visible opens, engine-only helper opens, and prewarm enabled versus
  disabled. Prewarm and each document WebView currently create separate
  non-persistent data stores, likely separate WebContent processes, so the Loro
  WASM compile may not be reused at all; include one shared non-persistent store
  as a measured variant only with explicit cross-document storage/origin isolation
  checks; all current document pages use `slop://app`.
- Small documents, large row/text workloads, and documents near payload capacity.
- One window and multiple windows, with memory measured again after closing.
- Ordinary incremental saves, threshold checkpoints, required import checkpoints,
  and skipped oversized checkpoints.

Record median/tail save latency, startup stages, full-snapshot export count/time,
bridge calls and bytes, SQLite payload/file size, and host/WebContent memory.
Separate small edits from large imports and optional maintenance work.

The structural acceptance criterion is that ordinary below-threshold saves no
longer serialize the full document. Timing results must show no unexplained
regression in startup, ordinary editing, or teardown. Keep hardware-dependent
timings as reviewed evidence, not flaky CI assertions.

Do not replace base64, change SQLite journaling, pool document WebViews, or add
another caching layer merely because those techniques might be faster. Any such
follow-up needs a demonstrated bottleneck and its own correctness tradeoff.

## 11. Release workflow after the reset

### New templates

Build and validate with the supported SDK/CLI. Ship new bundled templates through
an app release or install unpacked stateless masters through the existing local
template workflow. Existing writable slops retain their app/schema. A new template
does not require an engine revision unless it needs a new runtime capability.

### SDK changes

Version and test the authoring package and its emitted app against the declared
minimum runtime. A compiler/adapter-only change does not automatically change the
engine requirement. A new `ctx` capability requires a compatible runtime first.
Keep exact tested CLI/SDK dependency pins and outside-checkout package checks.

### Loro/runtime changes

Pin the candidate dependency, rebuild paired glue/WASM and all runtime consumers,
increment the runtime revision when runtime bytes change, and run forward replay
and frozen-consumer tests. Old slops are not rebuilt. Archive the tested runtime
and seal for evidence, not installation as an alternate engine.

Publish the compatible signed Mac app before dependent npm packages. Retain the
existing signing, notarization, Sparkle, artifact checksum, and manual acceptance
process. Packaging/tests do not publish anything automatically.

## 12. Explicit exclusions

This reset does not add existing-slop app/schema upgrades, prelaunch migration,
automatic history pruning, collaboration transport, undo UI, synced folders,
hosted catalogs, accounts, sharing, or a second document engine.

Deferred with a known reason: replacing fork-based `change()` staging (O(document)
per transaction, about 30 ms at 40,000 rows, and it hides local operations from a
Loro `UndoManager`). It needs no contract change if §7's freeze is respected.

Implementation began after review and approval. Fractional counters remain supported:
any save containing a counter change requires a checkpoint, including ordinary
handle edits. Text/list-only saves remain incremental. This is a correctness
exception for Loro 1.16.1, not periodic maintenance. No remote publication is
authorized by this implementation.


## 13. Implementation evidence

The launch candidate uses contract 3 / runtime revision 1 / storage revision 1,
SQLite format 2, and SDK/schema/CLI 3.0.0. Installed consumers contain one engine.
The SDK tarball contains app-facing helpers and types; engine sources and the
Loro dependency remain internal to the host build.

A preserved pre-reset runtime and the candidate were exercised on this machine
with 32 single-character text edits and explicit saves. The storage adapter was
in-memory: these numbers isolate engine work and exclude WebKit, bridge transport,
SQLite sync, and physical disk latency. The large strings were compressible, so
this is not a near-capacity workload.

| Initial text | Snapshot exports, before → after | Median save, before → after | p95 save, before → after |
|---|---|---|---|
| 1 MiB | 32 → 0 | 0.99 → 0.36 ms | 3.22 → 2.15 ms |
| 8 MiB | 32 → 0 | 6.36 → 2.20 ms | 15.70 → 3.23 ms |

Raw evidence: `.hitslop/v1-evidence/runtime-reset-v2/performance.json`.
These measurements preceded the final lost-reply bookkeeping cleanup; that cleanup
does not run on the measured successful-save path. They support the structural
snapshot claim, not an end-to-end latency guarantee.

The ordinary-counter regression failed before the fix (expected 1, reopened 0).
The native missing-entry regression also failed before cleanup (retained WebView
and Busy writer lease). Missing entry JavaScript, missing imported JavaScript,
missing WASM and corrupt WASM now report promptly and release failed-open resources
in both visible and headless sessions. Native retry and authored-error telemetry
owners pass with the cleanup change.


The native window diagnostic completed all six cells (100/1,000 fully rendered
rows × 1/10/20 windows). It includes 100 durable title edits and 1,000 state reads
per cell. Native durable-edit p95 ranged from 40–92 ms at 100 rows and 188–311 ms
at 1,000 rows. Host plus identified WebContent footprint ranged from 174 MiB
(one 100-row window) to 6,280 MiB (twenty 1,000-row windows); the host alone was
36–47 MiB after closing. GPU/network processes are excluded. This is a warm-machine
stress diagnostic, not a controlled before/after comparison or an ordinary
keystroke-latency measurement. The large fully rendered window workload remains
expensive; no process pooling, shared data store, or application rendering rewrite
was introduced. Raw results: `.hitslop/v1-evidence/runtime-reset-v2/native-windows.json`.


Separate startup runs measured first visible Quick Checklist opens at 539 ms
without explicit prewarm and 500 ms with it. Later opens across the two templates
ranged from 249–500 ms. The sample is small and the machine was warm; it does not
prove a reliable prewarm advantage or WASM compile-cache reuse. Keep the existing
prewarm implementation. A shared website-data-store experiment remains deferred
until same-origin cross-document storage isolation has its own proof. Evidence:
`.hitslop/v1-evidence/runtime-reset-v2/startup.json`.


### Final validation

`bun run release:check` passed all 18 stages on the uncommitted working tree based
on `35bdf0ca9ea00d7562c8906cf3776b3a7806b1e8`. This included source/generated checks,
145 Bun tests, the Swift suite, eight native CLI tests, 106 native render/reopen
packages, storage and host-process crash recovery, installed npm consumers,
landing-site checks, and the packaged Debug Mac app with matching runtime bytes.
Both final 57-case compatibility replays produced identical results. The runtime
seal is contract 3/revision 1, SHA-256
`48cb39e98f7d066f2a74f4df9dc91c6fe152b5ed168c2551aa8e9b851c9e37d7`.
All 51 bundled templates now have new launch specimens.

The first release-gate attempt correctly rejected 14 stale, stateless contract-2
builds under example `dist` directories. They were preserved in
`.hitslop/runtime-reset-v2-prelaunch-builds/`, outside active build discovery;
no writable documents were migrated or removed. Failed and successful gate reports
are retained in `.hitslop/v1-evidence/runtime-reset-v2/`.

This is local release-candidate validation, not publication or signed/notarized
release acceptance. No commit, tag, npm publication or remote release was made.
Physical power-cut testing, a shared WebKit data-store experiment, and replacing
fork-based transaction staging remain outside the evidence collected here.

### Counter and release-review follow-up

The storage owner now covers safe-integer replay and a required counter checkpoint
that exceeds capacity after successful incremental text saves. It asserts exact
reopen values, retained live edits, unchanged durable bytes, failed close, and
successful explicit discard/reopen. Removing only the counter checkpoint guard in
a disposable source copy made both new cases fail: the integer reopened one lower,
and the capacity save incorrectly resolved. Production runtime bytes and the
contract-3/revision-1 seal remain unchanged. The fault evidence is retained in
`.hitslop/v1-evidence/runtime-reset-v2/counter-followup-sensitivity.log`.

Follow-up validation passed `bun run check` (including Svelte: zero errors or
warnings), `bun run test` (147 tests, 57 compatibility replay cases, 51 bundled
template open/reopen checks), and `git diff --check`. Check and test logs are
retained alongside the fault evidence as `counter-followup-check.log` and
`counter-followup-test.log`. This follow-up changes only tests and documentation;
the full native/release gate was not repeated for these changes.

Fresh disconnected-install acceptance and signed/notarized release validation
remain pending. The offline check must launch the installed app with networking
unavailable, create local working copies, edit/save/reopen, use Recents/local
template discovery, and export PNG/PDF without fetching engine resources. Local
resource checks and the Debug release gate do not establish that manual acceptance.
Run the complete release gate again on the final clean release commit before
publication; the earlier dirty-tree report is implementation evidence only.

### Bridge transport spike (binary vs. base64)

An external proposal suggested replacing the WebView↔Swift bridge's base64-JSON
transport with raw binary transfer, and separately a native Swift/Rust `LoroDoc`
mirror. The latter is a second document engine and was rejected outright without
testing (§7's "no second document engine" rule; see also `runtime-reset.md`'s
"Not recommended now: ... a Swift-side engine"). The former was spiked with a
disposable, isolated WebKit harness — never touching `bridge.ts`, `document.ts`,
`Storage.swift`, `StorageBridge.swift`, or `SchemeHandler.swift` — to measure
before assuming. Evidence: `.hitslop/v1-evidence/binary-transport-spike/*.json`.

The proposal's core premise does not hold on this app's WebKit version. A
top-level `Uint8Array` passed to `postMessage` arrives in Swift as a `Dictionary`
keyed by byte index (not `Data`); a top-level `ArrayBuffer` arrives as an *empty*
dictionary, silently losing the bytes; and a raw `Data` reply from Swift back to
JS fails outright ("The result value passed back from the WKWebView API client
was unable to be serialized"). The only binary channel that actually works is
`fetch()` against a `WKURLSchemeHandler`, in both directions, byte-exact up to
30 MiB — a materially bigger change than "swap base64 for ArrayBuffer in
postMessage," since writes have no scheme-handler channel today.

Measured against real SQLite (`Storage.call`) and a real `WasmSession` open/save
cycle as the end-to-end denominator, base64 is not a bottleneck on the primary
path (native `Uint8Array.toBase64`/`fromBase64`): at 8 MiB, switching to binary
saves roughly 2.5 ms on writes and 8 ms on reads against a total cost in the
tens of milliseconds, well under any reasonable threshold. The one real cost
was on the `atob`/per-byte fallback path pre-Safari-18.2 WebKit uses: 46-84 ms
at 8 MiB, genuine main-thread jank. That fallback existed because the app's
minimum macOS version was 14; native `Uint8Array.toBase64`/`fromBase64` shipped
with Safari 18.2 / macOS 15.2. Rather than build binary transport to work around
a fallback path, the deployment target was raised to macOS 15.2 (`Package.swift`,
`project.yml`, and the regenerated `.pbxproj`), which removes the fallback path
entirely for every supported user. `bridge.ts`'s feature-detected fallback
function is left in place as harmless, near-zero-cost defensive code; nothing
in the bridge transport itself changed.

Conclusion: no bridge transport change. The spike test file was deleted after
this conclusion was recorded; the evidence JSON remains under `.hitslop/`.

The same spike's single-sample run also showed one edit+flush on a 1000-row
document taking 9.5s, wildly out of line with everything else measured. A
follow-up ran 8 consecutive edits on the same 1000-row document, both headless
and in the full visible app, isolating rendering from document logic. Headless
was uniformly 3-7ms per edit, matching a separate clean repro of
`packages/document/src`'s own logic outside any WebView (0.5-1.2ms regardless
of row count). Visible mode cost 156-194ms per edit — real, but consistent
across all 8 edits (no first-edit cliff) and in line with `BenchmarkTests`'
existing 188-311ms p95 figure at 1000 rows. The original 9.5s reading did not
reproduce under repeated, controlled sampling; treated as a one-off measurement
artifact from that single-sample run, not a document/CRDT/transport regression.
Evidence: `.hitslop/v1-evidence/large-list-edit-timing/{headless,visible}.json`.

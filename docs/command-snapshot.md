# Command/snapshot implementation

The implementation uses explicit commands and one authority per document.
`@hitslop/document-engine` evaluates commands in every runtime. A local
Swift actor owns SQLite and one document-scoped JavaScriptCore VM; a shared room Durable Object owns JSON state, with Swift
as the WebView's gateway. The production bridge uses protocol 3 commands and
snapshots. There is no commands-to-`after` shim.

## Contract

- Commands carry document ID, schema hash, authority epoch, lease ID and request ID.
  A batch applies atomically to a private candidate and validates before commit.
- Revisions order snapshots only within an authority. A confirmed handoff may
  replace the epoch and reset the revision; delayed foreign frames cannot do so.
- Authorities issue fixed seven-day retry leases. A retry uses the original,
  immutable request. Successes and deterministic state rejections are receipted.
  Receipts contain a SHA-256 request digest and outcome, not the request payload.
  Transport, authentication and storage failures are not deterministic receipts.
  Local receipts also resolve external-file imports interrupted after commit but
  before projection bookkeeping; their persisted lease and file hash identify retries.
- Expired or unknown leases cannot execute. This permits receipt pruning without
  turning an old increment into a new increment. An expired unknown outcome is
  reported, never silently resubmitted under another ID. Unexpired leases are not
  evicted by a count limit: doing so would break the promised retry window.
- Paths contain object-key or list-item identity steps. Lists retain their
  author-named key. Arrays are atomic. Explicit verbs retain arithmetic and
  membership intent; no writable proxies or inferred diffs are involved.
- Portable conformance data lives in
  `packages/schema/fixtures/document-ops.json`. TypeScript consumes it directly;
  schema generation copies it byte-for-byte into the Swift test resources, and
  `schema:check` verifies that copy. This remains a permanent CI contract.

## Durability and files

SQLite transactions reload committed state under the write lock, then commit the
new JSON, revision and receipt together. `stores/data.json` is a coalesced editable
projection: 250 ms quiet time, with a two-second maximum delay. Normal close forces
projection. A projection I/O failure blocks close without rejecting an already
committed command. Projection replacement stays under the cross-process write lock
so a stale projector cannot overwrite another window's newer revision. Metadata-only
changes update only metadata; they do not rewrite the snapshot.

A resolved command rejection is not a close barrier. Dirty text, unknown outcomes,
queued work and actual flush failures are. Every adapter is awaited before reporting
collected failures. Duplicate text bindings share a draft with separate attachment,
focus and composition ownership.

The projection envelope carries format 2, document ID, schema hash, authority and
base revision. External edits are conditional full replacements. Invalid or stale
proposals are preserved in `state/proposals/` and remain in the editable file;
projection pauses over them while ordinary document commands remain usable.
Closing is allowed once both the authoritative document and preserved proposal
are durable. Discard authorizes replacing only the exact reviewed bytes.

Shared mode persists locally. Disconnection, sign-out or revocation cannot turn it
into a writable local document. Attempts admitted while connected are persisted
before sending and resolved after reconnection; this is not an offline edit queue.
Promotion records its seed and freezes writes until its outcome is known.

## Historical performance checkpoint

The isolated native test is `CommandPerformanceTests.webKitCheckpoint`, enabled
with `HITSLOP_COMMAND_BENCHMARK=1`. It exercises WebKit → Swift → SQLite → full
snapshot, at 1k/5k/10k rows, with both a minimal consumer and actual plain DOM rows.
It is not a Svelte benchmark or the final production bridge measurement.

Raw measurements are under `docs/benchmarks/command-snapshot/`. The first debug run
found roughly one second at 10k rows. The first release run was approximately
650 ms, mostly authority work. Removing repeated typed decoding and JSON reparsing
brought warmed release samples to approximately 285–325 ms at 10k rows. This
justified profiling JSON decoding and validation before cutting over production. These observations are not a promised
latency target. The pre-refactor debug baseline is also recorded in the report;
its narrower measurement scope prevents a direct speedup ratio.

The cleanup release checkpoint recorded 251 ms median command-to-layout at 10k
rendered plain DOM rows, versus 313 ms in the earlier prepared-JSON report.
The TS cleanup runs varied substantially: 66 ms and 29 ms medians at 10k rows
on Bun 1.4.0. Both runs are retained with scope and toolchain details in the
benchmark directory. These are observations rather than a controlled speedup claim.

Prepared TypeBox validators are cached with a tested fallback when runtime code
generation is prohibited. The native host uses those same validators in its
document-scoped JavaScriptCore engine; the earlier DynamicJSON implementation
and dependency have been removed. JSON parsing and serialization are measured separately from schema
validation. Confirmed guest snapshots use structural sharing keyed by list
identity and do not repeat authoritative application-schema validation. Candidate
JSON is encoded once and reused for persistence and snapshot framing; request
hashing, editable-file projection and WebKit transport are separate costs. Preview
commits update only their new receipt instead of copying or freezing receipt history.
CI checks validator reuse, candidate preparation, row identity and constant preview
freezing work; machine-specific timing observations remain manual.

Current engine measurements and their scope are in the
[JavaScriptCore report](benchmarks/javascriptcore.md). Historical Swift numbers
above describe the removed implementation.

## Production integration

The generated bridge, native session, runtime controller, disposable preview and
room use protocol 3 commands. Active Loro code and dependencies are removed.
Svelte `createDocument` owns readiness and cleanup; Quick Checklist and the counter
remain single-file apps using store-owned `fields`, explicit verbs, `transaction`,
and text attachments. `<Slop document={store}>` unifies host error reporting, context,
loading semantics, and optional capture snippets without another data owner.

The room persists JSON state and receipts, retains ACLs and immutable app bundles,
and supports conditional full replacement for external edits. Native recovery,
captures, independent copies, authoring guidance and generated resources use the
same identity and durability contract.

## Rendered-row findings

`browser-before-index.json` and `browser-rendered.json` measure actual Quick
Checklist Svelte rows in Chrome, with a disposable in-memory authority. They
include full serialized snapshots, guest reconciliation and two animation frames;
they exclude native disk and network. These are development builds with five
measured samples, not a release latency guarantee.

The first run exposed repeated linear list searches by text bindings: approximately
4 seconds at 10k rows. Indexing immutable confirmed lists once per snapshot brought
that run to a 443 ms median / 459 ms p95 at 10k, and 33 ms median at 1k. Structural
sharing remains in place. Large fully rendered documents still have measurable
validation, reconciliation and rendering costs; this refactor does not establish
a 6 ms end-to-end budget.

The compiled Quick Checklist is approximately 361 kB raw / 107 kB gzip. Prepared
TypeBox validation adds code to the guest bundle; the budget explicitly accounts
for it. The production TS benchmark can be repeated with
`bun scripts/document-benchmark.ts 30` after building the schema package.

## Verification on 17 September 2026

Passed locally:

- Workspace type checks and tests; the added offscreen-readiness tests also pass
  with animation frames and timers unavailable.
- Schema generation/drift, formatting, repository hygiene and whitespace checks.
- Clean-room SDK tarball installation, fresh counter init/check/build/validate,
  and Quick Checklist built from installed packages.
- Full serial Swift suite with compiled checklist and counter enabled, including
  forced process termination, reopened receipts, pending shared-attempt recovery,
  multi-window commits, external proposal preservation, IME and undo/list edits.
- Real local Wrangler room tests with native HTTP/WebSocket integration enabled,
  including persisted room restart, reconnect, invitations and revocation.
- Native preview/icon/PNG/PDF captures and a relocated Debug helper rendered after
  its SwiftPM build directory was removed. Desktop and narrow captures inspected.
- Landing production build.

The complete `bun run test:local` gate passed on pinned Bun 1.4.0. Evidence is in
`.hitslop/local-tests/2026-09-17T19-40-49.798Z/`. No hosted deployment, publishing or
signed release was performed.


### Collaboration and media cleanup verification

The 17 September cleanup passed workspace/package checks, packed-SDK smoke tests,
real Wrangler/D1/R2 tests, and native cross-account photo transfer in both directions.
The complete serial Swift rerun passed, including media hash validation, failed-upload
recovery, Checklist input/undo/reopen, and native captures. A stale named-media test
fixture was corrected. The 500-row startup test timed out once during concurrent
builds and passed unchanged in 1.6 seconds on the serial rerun; its timeout was not raised.

Evidence: `.hitslop/local-tests/2026-09-17T21-04-29.491Z/results.json` retains the
initial run, and `completion.json` records the successful native rerun and remaining
helper, landing and drift checks. The development-signed Debug macOS app built and
passed signature verification. Quick Checklist was rebuilt with native preview/icon
captures and replaced the local template catalog. Cloudflare changes remain local.

## Latest-action undo

`undo: { requestId, revision }` is a command envelope alternative to `ops` or
`replace`, using the original command's lease and authority and a new attempt ID.
The authority stores one prior snapshot, checks its owner and current revision,
then restores only its data at a new revision. Undo has normal durable receipts,
so a lost reply reuses the same attempt. It never creates redo. Later commands
expire earlier actions, even when they touch unrelated fields. The SDK exposes
`MutationResult.undo` and `canUndo`; functions never cross the wire.

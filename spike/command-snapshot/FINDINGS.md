# Findings — 17 September 2026

**Graduate the command/path contract, with a measured performance gate before deleting the production engine.** Keeping the `documentStore` name works. Its new responsibilities are confirmed snapshots, explicit commands, pending/error state, and text drafts; the draft-diff/overlay machinery is unnecessary for this API.

## What the spike establishes

- Two independent checklist views converge through one authority without guest-side document replay. Add, complete, move, remove/undo, file/undo, restore, title editing, and row text editing use explicit commands.
- Atomic batches validate their final state and publish one revision. Concurrent increments survive. Full replacement rejects a stale base revision. Unknown fields survive unrelated commands.
- Request IDs matter for local as well as shared transport failures. A lost acknowledgement preserves the original request until resolution; it must not become a new toggle, insert, or text write. A regression test proves text-ack resolution does not overwrite a newer remote edit.
- Local text drafts remain useful even without a document replica. Rejections, IME composition, focused-field remote updates, and deletion of the edited row require explicit lifecycle handling. Pending composers clear only after acceptance.
- Branded schema nodes can provide `.item(id | row)` for lists and `.at(key)` for records without exposing either on atomic arrays. Strict type tests reject the proposed gotchas. Literal dotted record keys and `__proto__` remain ordinary safe keys.
- The TypeBox runtime schema/validator is reused, not forked. The spike's wrapper adds type-only list/record brands.

## Changes to the proposal

**Use `fields`, not `$`, in Svelte.** Svelte rejects `$` as an imported/local binding. `store.set(fields.tasks.item(task).done, true)` compiles and reads naturally. Plain TypeScript can use `$`, but teaching two spellings buys little.

**Paths do not make every operation safe under concurrency.** `increment` preserves additive intent; `set` is last-write-wins, including an explicitly replaced subtree. Setting a whole list can still overwrite concurrent list edits. Use `insert/remove/move` for membership and ordering, and `patch` for a shallow atomic field update. Addressed row identities are immutable. Whole-document file replacement requires a current revision.

**Zero artificial latency is not zero work.** The current canonical validator walks the JSON, checks encoded size, validates the schema, and checks list identities. The authority also clones/freezes state. The guest validates/freezes received snapshots. None becomes constant-time merely because the upward message is small.

## Measurements

Apple M1, macOS arm64, Bun 1.3.13; Chrome 153.0.8010.48. Thirty measured samples per size, with warmup. Synthetic documents remain below the existing 1 MiB cap. One field of the last row changes. These are single-machine exploratory runs, not stable performance budgets.

| Rows | JSON bytes | Authority median / p95 | Validation median | Browser command → DOM median / p95 |
| ---: | ---: | ---: | ---: | ---: |
| 1,000 | 74,822 | 22.9 / 65.3 ms | 15.5 ms | 25.2 / 27.4 ms |
| 5,000 | 382,822 | 58.4 / 124.3 ms | 37.4 ms | 121.2 / 127.0 ms |
| 10,000 | 767,822 | 158.0 / 325.2 ms | 106.8 ms | 238.8 / 258.1 ms |

The authority run includes clone/interpreter, full validation, serialization, freezing, and receipts. Component medians are not additive. The browser run uses the development build, serialized boundaries, guest validation, and Svelte `tick` with a revision/count consumer. It does **not** render 10,000 checklist rows or measure paint. Bun and Chrome are different runtimes; their totals cannot be subtracted to infer bridge cost. Raw reports and scope labels are in `results/`.

These measurements do not establish an improvement over the old ~2.5 s native path or reproduce the archived ~6 ms experiment. Native disk, Swift validation, bridge encoding, WebKit, and real network costs remain unmeasured. The result argues for profiling validation and snapshot consumption before raising the cap or promising instantaneous local controls; it does not yet justify compression or subtree sync.

## Verification

- 47 engine/controller/draft tests pass, including unknown-outcome resolution, batch rollback, concurrent increments, stale snapshots, disconnects, IME, and retained drafts.
- 29 portable JSON fixture scenarios with explicit expected state/revision/errors are generated for the future Swift implementation.
- Strict Svelte/TypeScript check passes with zero errors/warnings, including negative type cases.
- Five Chrome integration tests cover checklist operations across views, rejected/lost-ack insertions, reconnect/concurrent counters, draft retention, and desktop/mobile layout. Production Vite build succeeds.

## Graduation boundary

1. Move brands/paths and the command schema into canonical packages, preserving `S.List(item, key)`. Keep `documentStore`; add `<Slop>` when the production store lifecycle is settled. This spike does not implement the wrapper.
2. Implement Swift ops against the portable fixtures. TS and Swift share semantics and fixtures, not executable interpreter code. Measure the real WebKit → Swift → persistence → snapshot loop before removing Loro.
3. Define and test one crash-safe local authority: lock the read/revision-check/apply/write transaction, retain recoverable bytes, and persist dedup receipts with state. An in-memory synchronous commit proves none of this. Multi-window ownership, stale/invalid external files, and close/flush recovery need native tests.
4. Only then replace the room's opaque byte log with JSON state/revision and durable request receipts. Online-only shared writes can reuse the command API; ACLs, reconnect sequencing, schema identity, limits, and receipt retention still need production treatment.

The mock uses unbounded receipts and synchronous in-memory state. It has no file watcher, persistent database, Durable Object, managed edit session, native recovery UI, or offline shared queue. The checklist styles are copied only to exercise existing authoring, not to create a second maintained template. Delete or graduate this directory once those decisions are made.

# Runtime versioning

## The promise

After any hitSlop update, supported documents keep opening, editing and exporting
correctly. That promise is kept by preserving three contracts and testing them with
frozen artifacts. It is not a promise that arbitrary JavaScript runs forever on every
future WebKit or macOS release; platform or security exceptions need an explicit
product decision.

## Launch baseline

The second prelaunch reset retires contracts 1 and 2 and their fixtures; no documents
from that era need to open. [Runtime reset v2](runtime-reset-v2.md) records the decisions.
The launch baseline is **runtime contract 3, revision 1, storage revision 1** with
SDK 3.0.0 and SQLite format 2. The tested launch candidate is already sealed in
`runtimes/releases.json`; sealing freezes bytes and ledger records before
publication. A local seal does not mean the app has shipped. Publication archives
those same bytes with the release (see [releasing](guides/releasing.md)). Sealed
records remain immutable; later runtime byte changes require a new revision.

## What a slop contains and what the app supplies

A `.slop` owns its compiled app, schema and state. The app supplies the engine and the
page. `assets/runtime.json` declares `runtimeContract` and `minRuntimeRevision`; SDK,
Loro and protocol versions are provenance only. Missing or invalid requirements are
refused before storage opens; unsupported contracts and insufficient revisions ask for
an app update.

| Immutable app content | Mutable document content | Ancillary |
|---|---|---|
| `manifest.json`, `assets/runtime.json` | `state/document.sqlite` (Loro log, checkpoint, `doc_id`) | `QuickLook/` |
| `state.schema.json`, creation-only `initial.json` | `state/theme.json` overrides | `.agents/` guidance |
| `assets/app.js`, `assets/app.css`, fonts, local assets, `assets/theme.json` | `state/attachments/<sha256>` | |

Missing or stale ancillary files never make saved work unreadable.

## The three contracts

Everything a frozen slop depends on falls in one of these. Each has a named gate.

1. **App module.** The runtime serves the page (packages have no `app.html`), opens the
   document, imports `/assets/app.js` and calls `default.mount(ctx, target)`. Also
   covered: `/assets/*` resolution, the mount target and CSP, `--slop-*` theme variables,
   capture behavior and package validation. Apps import nothing from `/__runtime__/`;
   the build rejects engine imports, bridge access and remote boot resources.
2. **The `ctx` interface** ([abi.ts](../packages/document/src/abi.ts)). Behavioral:
   arguments, results, timing and errors, not only names. It only grows; new
   capabilities are optional and listed in `ctx.capabilities`.
3. **Data.** Descriptor format 1 and its frozen schema-key canonicalization (sorted keys,
   array order kept, no whitespace, JavaScript JSON numbers); the Loro layout (`data`
   root, `$id` registers, mergeable containers only for shared fields); SQLite format 2;
   theme override and attachment reference formats.

| Contract | Gate |
|---|---|
| App module + `ctx` | Sealed consumers `3-1` (hand-written plain JS) and `3-1-svelte` (the real adapter) run their self-tests in WebKit: `test:render --fixtures`, `RuntimeCompatibilityTests` |
| Data | Bun replay of every sealed fixture, exact `issues.json`, scenarios, checkpoint/update phases, same-storage historical readers, older-reader refusal and current-engine convergence |
| Package history | `compatibility-history.ts` rejects changed ledger records or fixture bytes against the base commit |
| Shipped templates | `check:sealed-templates` in `release:check` |

## May change freely

The Swift↔JS bridge and `globalThis.__slop` are private between the runtime and the
host, which always ship together. Boot internals, the runtime's `index.js` exports
(beyond the harness contract in `compatibility-worker.ts`), CLI internals, and Loro
versions that pass forward replay and readers admitted by the same storage revision may change in any
release.

## Identities

| Identity | Meaning | Rules |
|---|---|---|
| `$id` | A row or tree node | Random 128-bit application register. Immutable through authored operations; survives moves, reopen and matching JSON import. Never a Loro container ID. Rows with a missing, invalid or duplicate ID read a derived `x-` ID (a frozen hash of internal identity, never written); ownership of a duplicated ID never depends on position. |
| `doc_id` | A logical document | Minted with the database; renewed by Duplicate; copied by a plain file copy, so it never authorizes synchronization. |
| Loro peer ID | A writing session | Random per session; never persisted or copied. |

Schema compatibility (the schema key) is not app identity: unrelated apps may share a
schema.

## Reads and writes

Decodable state always opens. Semantic anomalies from merges are preserved and reported
through `ctx.document.issues`; representable values keep their stored value, unusable
ones read as a documented fallback (a non-finite counter reads as `null`) and refuse
edits beneath them. Nothing is repaired on open. Undecodable bytes, missing
dependencies, unsupported formats or schema keys and resource limits still fail.
Validation stays strict for local writes. Live edits are synchronous; saving bounds
the durable checkpoint plus update payloads at 32 MiB. Ordinary saves append one
merged update. Counter-changing saves require full checkpoints because regrouping
floating-point deltas can change accepted values. Optional compaction failure leaves
acknowledged data saved and does not block close/export. A capacity failure retains live
work, reports `save-failed` and `full`, and blocks close/export. Further edits and retry
remain available. `full` clears after successful saving or explicit discard. Discard
reloads the latest durable state and clears drafts while retaining the writer lock;
a failed reload preserves unsaved work. Every accepted local commit is emitted once
on the outbound update stream, independently of persistence; imported peer updates
are persisted without re-emission. Projected counter types include `null` for overflow;
creation inputs and local writes still require finite numbers.

## Revisions and contracts

App versions and runtime identities are separate; several app releases may ship the
same sealed runtime. Byte changes need a new runtime revision. Each consumer bundles
exactly one runtime; old artifacts remain test inputs, never installed engines.
Runtime updates preserve the app/ctx contracts and read prior saved documents.
The separate storage revision increases when new writes are incompatible with older
readers. Swift stamps that minimum reader revision atomically with each write;
opening alone does not advance it. Readers below that floor refuse before decoding.
Readers in the same storage revision must still interpret candidate writes correctly.
Writers keep full history; readers accept shallow checkpoints, but safe pruning still needs a separate design
for peer catch-up and shared history. SQLite format 2 is owned by Swift; a format change
needs its own compatibility design.

`bun scripts/v1/runtime-release.ts` seals the current runtime and emits a release
directory; `bun run compatibility:restore` restores sealed releases for cross-revision
tests. Ordinary builds never change the ledger or fixtures. New capabilities get new
fixtures, authored with `bun scripts/v1/author-fixtures.ts`, which never replaces an
existing one.

## Independent CLI releases

The CLI package version may advance independently when its SDK and runtime
requirements are unchanged. `init` pins the project's SDK to the CLI's exact
`@hitslop/document` dependency, and builds compare the complete SDK identity.

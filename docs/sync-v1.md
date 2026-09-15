# Document architecture

hitSlop has one document data model. Authors define `S.Document` schemas from
`@hitslop/schema/document`; TypeBox validates application data without coercion,
default insertion, or field stripping. `documentStore({ schema, initial })`
exposes an immutable `current` view and an explicit `change(draft => …)` API.

The host supplies a versioned JavaScript/WASM runtime that owns the Loro Replica,
validation, historical edit reconciliation, and operation ordering. It executes
in each document’s webview; documents do not bundle the platform sync engine. Swift owns local package bytes and journal recovery.
The engine lives for the document runtime and `flush()` acknowledges durability.

Fresh templates contain no `stores/` or `state/`. Opening initializes authored
values and creates `state/identity.json`, `state/checkpoint.loro`,
`state/materialization.json`, and the editable `stores/data.json` envelope:

```json
{"$slop":{"format":1,"baseRevision":"<opaque token>"},"data":{}}
```

Only this current format is supported. An existing checkpoint requires its
identity and materialization metadata. There are no format converters or
alternative whole-file persistence APIs.

## Editing and persistence

Local changes update the replica and shared immutable view immediately. Automatic
saves wait for 250 ms of idle time, with a maximum wait of 1 second before starting
persistence during continuous editing. Explicit `flush()` (including close and
capture barriers) bypasses that delay and awaits durable completion. External-file
notifications also bypass the delay. A failed save remains visible for retry; it
does not start an automatic retry loop. A process crash can lose edits still
waiting for persistence, and slow storage can extend the durability window.

The UI calls `change()` and updates immediately. External saves preserve `$slop`
and change `data`. The engine diffs the historical baseline against the edit on
a Loro fork and merges the result. Identical retries are idempotent. Additional
edits on a consumed revision need review; reload the file before a new edit pass.

Malformed JSON, invalid data, and unresolved revisions remain on disk. UI edits
continue to durable checkpoints while projection writes pause. Missing JSON is
reconstructed only from healthy current state. Invalid envelopes cannot be
applied; users repair the file or deliberately keep the current document.

A per-path byte journal covers all participating files. Node `FileDocumentIO`
and Swift `SlopSyncStorage` share the transaction contract. Recovery checks all
hashes before replacing files. Unexpected external bytes stop recovery. Explicit
review replacements retain the original bytes in the recovery journal.

Review decisions target the displayed document revision and external hash.
Different current-format data can be deliberately applied against current state;
there is no unversioned import. Arbitrary simultaneous filesystem writers cannot
be made lossless by a watcher.

## Host errors

The runtime exports `errors.report({ id, message, details?, action? })` and
`errors.clear(id)`. An action has a label and async `run` callback. The host shows
reports and dispatches actions by ID and report revision; callbacks stay in JS.
SDK document and media adapters report failures automatically. Slops need no
storage-error banners. Loading indicators and field validation remain app UI.

macOS uses a native panel and review sheet. Browser preview uses a disposable
in-memory engine and host chrome beneath an iframe. Neither error chrome nor
review controls enter document exports, icons, or viewport measurements.

## Boundaries

Quick Checklist is the sole active example; the CLI scaffold follows the same
contract. All other template sources live in backlog or archives pending future
authoring work. They are excluded from builds, checks, and dependency support.

The supported document host is macOS with local files. iOS editing and iCloud
working-copy synchronization are unavailable. Media and theme storage remain
separate features. Presence, end-to-end encryption, and history compaction are
future work. Loro’s JS and base64 WASM ship together in the installed runtime,
loaded lazily from app resources. Browser previews serve the identical generated
runtime with disposable in-memory storage.

## Sharing (macOS)

Share opens native hitSlop controls. Google sign-in is required only for live
collaboration. `shareDocument` is a Firebase callable with Auth and App Check;
it creates rooms, redeems invitations, manages membership, and appends Loro
snapshots. Firestore listeners receive authorized updates, which the existing
JS engine validates, merges, and persists through the local journal. Native
code never interprets CRDT operations. The internal host-to-guest document
commands are snapshot, receive, copy, and seed; they do not expose credentials
or add another author-facing mutation API.

Rooms use the existing document identity; no extra identity or invite secret is
written into the package. Each member has whole-document editing access. The
owner can disable/rotate the invite link and remove people. Removed members
cannot rejoin with the old link. They retain already downloaded content.
Invitation URLs use `hitslop://join/<documentId>#<token>` and open the Mac app.
Joining explicitly saves a local replica from the shared history, using an
already installed template with an exact immutable-content fingerprint. Missing
templates require installation first; links never install executable code.

The initial transport stores full Loro snapshots as idempotent append-only
updates: 512 KiB per checkpoint, 10,000 updates and 20 members per room. These
are enforced limits, not compaction. Synchronization checks local changes every
second and receives remote edits through a Firestore listener. Offline edits
remain in the local checkpoint and resume on reopening/reconnection. “Synced”
requires server-confirmed delivery; local flush/close never waits for networking.
The service stores document data and history with Firebase-managed protection,
not end-to-end encryption. Media and theme changes are not synchronized.

Send a copy first creates a new document identity and history from valid visible
content, then opens Apple's share sheet. Duplicate uses the same independent
copy operation. Raw Finder copies retain history and document identity, but
possession of a file does not grant room access. Unresolved JSON reviews must be
resolved before making an independent copy. Existing files and templates are
never rewritten in place to update executable app code.

## Runtime requirements

Authored manifests use `schemas/v1/authoring-manifest.schema.json` and contain no
runtime declaration. The build stamps `"runtime": "1.0.0"` into the immutable
built manifest using the highest minimum required by the SDK packages in its
bundle graph. SDK package metadata uses `hitslop.runtime`; conflicting majors
fail the build. SDK-free apps use the builder baseline. Built manifests require
the runtime field; there is no legacy fallback or migration.

Runtime versions are independent of hitSlop app, bridge protocol, npm package,
and Loro versions. A requirement is the minimum stable `major.minor.patch`
release within that major: `1.2.0` accepts `1.3.1`, but neither `1.1.0` nor
`2.0.0`. The host chooses the highest installed compatible release before
starting JavaScript or storage workers. Unsupported documents offer the normal
hitSlop updater; opening a document never downloads executable code. Missing or
malformed declarations fail package validation.

The complete engine is versioned together, including validation, schema mapping,
reconciliation, and persistence. Compatible fixes raise the implementation
release; only newly required capabilities raise SDK minimums. A breaking API or
checkpoint/operation format needs a new major. Same-major releases must read and
exchange each other’s writes, including reopening data on an older compatible
host. Keep runtime-versioned checkpoint fixtures and exercise both directions
before releasing an engine update. Future major releases must retain a compatible
implementation for previously supported majors; never silently substitute one.

`window.slop.runtime.version` identifies the selected release. Its document
provider returns a narrow session interface without exposing Loro containers.
The Svelte store retains its normal API and synchronous mutations. Custom-I/O
consumers explicitly pass `runtime` from `@hitslop/sync/provider`.

Run `bun run schema:generate` after changing the engine to generate identical
native and CLI runtime resources. The app bundles these generated files; the CLI
serves its installed copy for previews. Document bundles reject platform engine
imports. Quick Checklist’s pre-capture package has a 500,000-byte regression
budget; report preview and icon bytes separately.

Ship the supporting host and publishing validator before publishing rebuilt
templates. Document application code stays fixed; compatible host-runtime fixes
can change when the user updates hitSlop.

### Releasing an engine update

1. Change the implementation version in `packages/sync/src/runtime-release.ts`.
   Raise SDK `hitslop.runtime` metadata and the shared SDK minimum only when
   document code needs a new capability.
2. For a new major, first preserve the exact last shipped runtime of each older
   supported major in `packages/sync/runtime-archive/` and list its version in
   `retainedRuntimeVersions`. The generator ships one release per supported major.
3. Run `bun run schema:generate`. It replaces superseded generated resources, so
   compatible releases do not accumulate old WASM files in the host.
4. Run schema, compatibility, native, preview, size, and npm release checks, then
   deliver the runtime through the normal app update.

# Document architecture

hitSlop has one document data model. Authors define `S.Document` schemas from
`@hitslop/schema/document`; TypeBox validates application data without coercion,
default insertion, or field stripping. `documentStore({ schema, initial })`
exposes an immutable `current` view and an explicit `change(draft => …)` API.

JavaScript owns the Loro Replica, validation, historical edit reconciliation,
and operation ordering. Swift owns local package bytes and journal recovery.
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
future work. Loro uses its bundled base64 WASM distribution, with a bundle-size
cost accepted for the current small-document implementation.

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

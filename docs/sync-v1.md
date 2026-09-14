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
separate features. Networking, presence, encryption, and history compaction are
future work. Loro uses its bundled base64 WASM distribution, with a bundle-size
cost accepted for the current small-document implementation.

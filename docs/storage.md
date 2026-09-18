# Storage

A slop can use JSON with optional document attachments, or no persistence. Storage does
not appear in the manifest and is created lazily in the writable document.

## JSON and local durability

Root `schema.ts` exports a deterministic TypeBox `S.Document`.
The document store supplies stable schema-derived `fields`. Root `initial.ts` supplies explicit defaults to both
the app and builder. `S.List(item, "id")` declares an ordered identity list;
`S.Array` is replaced atomically. Strings have ordinary last-write-wins semantics.
Validation never coerces, adds defaults, or strips unknown fields.

Document data is limited to 1 MiB of encoded UTF-8 JSON and 64 nested object/array
containers. Snapshot, projection, and room envelopes have a separate bounded
framing allowance of 68 containers; envelope overhead does not reduce the data
limit. Full edit requests retain their separate bridge byte/depth limits.
Native writes check exact data and assembled snapshot bounds before committing.

`S.Record` validates every key, including empty names and line terminators, using
`^[\\s\\S]*$` in emitted JSON Schema. Older annotated record schemas using `^.*$`
require rebuilding their source project. Immutable installed bundles are never
rewritten or migrated automatically; archived examples remain deferred.

`createDocument({ schema, initial })` owns Svelte readiness and teardown. Read its
frozen `data`; write with `set`, `unset`, `toggle`, `increment`, `insert`, `remove`,
`move`, `patch`, or a synchronous atomic `transaction(tx => ...)` batch. Inert paths
come from `store.fields`. Wrap the editor in `<Slop document={store}>` for unified
host error reporting, loading semantics, context, and capture views. Use `{@attach store.text(fields.title)}` for local debounced text
drafts, composition, and retained text after remote row deletion. There is no
writable document proxy or document-wide optimistic replay.

A Swift actor applies commands against the latest committed state under a SQLite
write transaction, validates the candidate, then persists JSON and revision before publishing a snapshot. `state/document.sqlite` uses
`user_version = 3`. SQLite serializes multiple windows and processes. Full
snapshots preserve unchanged row identities in the guest. The TypeScript preview
and room interpreter share permanent fixtures with Swift.

The authority retains one previous snapshot in a singleton undo slot, separate from
small request receipts. A successful ops command captures it in the commit transaction
by copying the stored snapshot bytes. Undo checks the originating lease, command,
authority, and exact revision, restores its data at a new revision, and consumes the
slot. Replacements and authority handoffs clear it. Rejected commands and retries do
not replace it. Expired leases prune their undo slot. This is bounded action undo,
not persistent user history. Undo changes JSON only; it does not reverse uploads
or delete media files.

`stores/data.json` is an editable projection:

```json
{"$slop":{"format":2,"documentId":"…","schemaHash":"…","authority":"…","baseRevision":0},"data":{}}
```

External editors preserve `$slop` and edit only `data`. A completed save is a
conditional replacement against that exact authority and revision. Stale or
invalid bytes are preserved under `state/proposals/` and remain in the editable
file. Projection pauses over them; app commands may continue. Native recovery
can reveal the proposal or explicitly replace the reviewed file with confirmed
data. There is no automatic merge.

Projection coalesces after 250 ms quiet time, with a two-second maximum scheduling
delay. It is outside the commit barrier. Close, export, backup and sharing force
projection; real I/O failure blocks them. A preserved proposal does not block
close. Guest drafts flush before native close. Unknown shared attempts are
persisted before sending and recovered after reconnect. Duplicate creates a fresh
local document identity. Capture copies use SQLite's backup API.

## Live sharing

Swift remains the sole gateway between an untrusted WebView and the room. Share
freezes an immutable app bundle and JSON seed. R2 owns that bundle, D1 owns
immutable metadata, and a SQLite Durable Object owns document JSON, revision,
leases, receipts, membership and invitations. Promotion persists its seed and
freezes local writes until the room confirms the handoff. Retry uses the same
seed and app bytes, including after restart.

Snapshots are ordered only within an authority epoch. Explicit host handoff may
change the epoch and restart revision numbering. Old connection snapshots cannot
change authority. Seven-day retry leases bound receipt retention. Exact request
retries return the same committed success or deterministic rejection. Expired
leases cannot execute, even after receipt pruning. Transport failures are not
receipts. Unknown outcomes never become new requests automatically.

Shared documents are read-only while disconnected, signed out, or revoked. Their
persisted mode never falls back to local writes. Local documents remain fully
offline. There is no shared offline editing queue.

Join validates and extracts the sender's app and current room snapshot in staging.
No credentials or owner database travel in the immutable bundle. The owner can
rotate/disable invitations and remove members; removal blocks rejoining and
closes existing sockets.

## Document attachments

Declare `photo: S.Optional(S.Media())` and create
`imageStore(document, fields.photo, { fallback: "" })` for images, or
`fileStore(document, fields.attachment)` for supported images and bounded ZIP files.
The adapters expose `choose()`, `replace(file)`, `clear()`, `src`, `isLoading`,
`pending`, and `error`. Replacement returns the same success/rejection result as
other document commands. `reload()` retries an unavailable attachment.

The host inspects bytes and computes SHA-256, then durably writes the immutable
file to `stores/media/<sha256>`. The document holds `{ sha256, mime, bytes,
filename? }`; the reference is an ordinary atomic document value. Never save a
browser blob URL or change an existing digest-named file. An external editor adds
a new supported file under its digest and conditionally replaces the JSON reference.

Sharing uploads referenced bytes before publishing a reference command. Failed
uploads leave the document unchanged and do not create an unknown command outcome.
Promotion uploads every referenced attachment before creating the room. Other
participants download missing bytes on document events or when opening an
attachment. Downloads verify the digest and content before exposing a local URL.
A missing download is visible through the adapter's error and can be retried.

Media downloads are public to anyone holding the hash. There is no room ACL on
`GET /media/<sha256>`. Clearing or replacing a reference does not delete its file:
local storage and R2 retain unreferenced blobs; garbage collection is not implemented.
Theme overrides remain local.

## Development and copies

`slop dev` supplies disposable in-memory JSON and real in-memory media blobs
for UI iteration. It performs no storage I/O, and a full page reload resets its
state. A build never copies authoring data.

Installing writes an immutable local catalog master. Opening or selecting it
creates a writable copy at a user-selected path. Personal state always belongs
to the copy, never the master.

## Theme overrides

Quick Checklist defines its theme in root `theme.ts` using `defineTheme` from
`@hitslop/runtime/theme`. This definition provides `theme.vars` to
vanilla-extract and generates immutable `assets/theme.css` during build.
Plain authored `assets/theme.css` is also supported; do not define both.
A writable
document may add `stores/theme.css` containing partial `--slop-*` overrides.
The host loads it after the default, watches it with the other stores on macOS,
and replaces the stylesheet without reloading the page.

Both files contain exactly one `:root` declaration block. The default defines
the complete public contract; the override may only use a subset of those
names. Structural selectors remain compiled into `app.html` and are not part of
the editable theme surface.
The native host validates overrides before applying them. Invalid overrides
retain the previous valid stylesheet, or use defaults on first open. Removing
the override restores defaults. Invalid mutable theme contents never block opening.

## Platform scope

iOS is archived. iCloud document locations are rejected; move documents to a local
folder and use Share. Pre-release databases and plain JSON projections are not
migrated. Unsupported inputs remain untouched.

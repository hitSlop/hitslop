# Storage

A slop can use JSON, named media, either, or neither. Storage does
not appear in the manifest and is created lazily in the writable document.

## JSON and local durability

Every JSON-backed document uses the native Swift Loro owner, whether private or
shared. `documentStore({ schema, initial })` exposes frozen confirmed data;
`store.change(draft => { ... })` submits structural edits and `documentText`
maintains text drafts with their original revision. The framework-neutral
controller owns sequencing, validation, and the flush barrier. Svelte owns only
reactivity and input handling. Missing native storage is an error; only `slop dev`
installs a disposable preview host.

Root `schema.ts` exports a deterministic TypeBox schema. Use `S.Document`,
`S.Object`, `S.List(item, "id")`, and `S.Text` from
`@hitslop/schema/document` to declare merge behavior. Unannotated values are
atomic replacements; convergence does not imply application-level validity.
Root `initial.ts` supplies explicit defaults to the app and build. Builds emit
`data.schema.json` and immutable `assets/initial.json`. Validation never coerces,
inserts defaults, or strips fields.

`state/document.sqlite` has SQLite `user_version = 1` and contains the document identity, exact packaged schema
fingerprint, full-history checkpoint, incremental updates, durable outbox,
replay cursor, and projection receipts. Candidate edits and remote merges are
validated before committing a database transaction. The live replica changes
only after COMMIT. SQLite serializes owners across windows/processes. A full
checkpoint is written after 100 updates or 1 MiB of accumulated updates; an
upload acknowledgement deletes only its outbox entry.

`stores/data.json` is an inspectable projection: `{ "$slop": { "format": 1,
"baseRevision": "..." }, "data": ... }`. External editors preserve `$slop` and
edit `data`. The host merges against that base revision, validates, and records
a receipt so a stale file cannot be replayed as a new edit. Invalid external
bytes are preserved for review. A committed pending projection is retried after
an interrupted file replacement. Edits remain durable in SQLite before acknowledgement;
projection file writes coalesce after 250 ms of inactivity, with a two-second
maximum scheduling delay during continuous edits. Flush, close, export, backup,
and sharing preparation drain pending projection work immediately. Open,
activation, and filesystem events reconcile external changes; filesystem
refreshes do not force a projection write for each database commit. There is no
document polling loop.

Close/export awaits visible guest drafts and durable commits. Close also drains
network work before closing the owner. Failed edits remain failures until
explicit `discardFailedChanges()`; reload and remote frames do not erase them.
Network loss does not prevent local edits. Duplicate creates a fresh identity
from the last valid data; capture copies use SQLite's backup API.

## Live sharing

Share freezes an allowlisted immutable app bundle and a Loro seed, uploads them
to Cloudflare, and returns an invitation link. The app may be unpublished and
sender-supplied. R2 stores its immutable bytes, D1 stores immutable metadata,
and one SQLite Durable Object owns the room's ACL, invite, seed, and ordered
opaque Loro log. Share retries use the same frozen seed and app bytes.

Join explicitly identifies the app as supplied by the sender. Download, bounded
archive extraction, package/schema checks, and seed validation happen in a
staging directory before creating the destination document. No credentials or
owner SQLite database travel in the bundle. App code/schema/assets are frozen
for the room; only document data is continuously synchronized.

The owner can rotate/disable invitations and remove members. Removal blocks
rejoining and closes existing sockets. Replay precedes upload on reconnect;
batch IDs make lost acknowledgements retryable. Invalid CRDT batches pause
sync without skipping history. Recover by duplicating the last valid local data
and sharing that new document; in-place room repair is deferred.

## Named media

Named media is for a small, known set of user-selected files such as
`recipe-photo` or `ambient-rain`. The image/file adapters validate names and
hand content to the host. The host content-sniffs supported images and bounded
ZIP archives, then atomically replaces the named entry under `stores/media/`.

Only schema fields marked `S.Media()` participate in content-addressed shared
media transfer. Document events trigger transfer; there is no media polling loop.
Media remains outside the Loro log, and theme overrides remain local.

Do not use named media as an arbitrary filesystem, and do not persist browser
blob URLs. Re-open media through the adapter after host change notifications.

## Development and copies

`slop dev` supplies disposable in-memory JSON and forgiving media stubs
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

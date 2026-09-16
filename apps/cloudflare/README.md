# hitSlop API and document relay

From this directory, copy `.env.example` to `.env` and set `TOKEN_KEY` to a random
signing secret. Wrangler reads this file locally; it is ignored by Git. Do not
also create `.dev.vars`, which overrides `.env`. `FIREBASE_PROJECT_ID` is public
configuration in `wrangler.jsonc`.

Use a separate production signing secret via `bunx wrangler secret put TOKEN_KEY`.
That command changes the deployed Worker. Never put signing keys in Wrangler
`vars`, client bundles, or document packages. Provision the D1 database and R2
bucket for the target environment before deployment.

## Local checks

- `bun run check`
- `bun test tests/api.test.ts`
- `bun test tests/room.integration.test.ts` (starts an isolated local Wrangler
  process, uses temporary SQLite storage, restarts it, and removes its files)
- From the repository root: `swift test --package-path
  apps/apple/Packages/HitSlopApple --filter SlopSyncTests`

## Sync contract

One SQLite Durable Object per document stores an immutable seed at sequence 1
and an append-only log of Loro batches. It relays opaque bytes; the native host
validates the merged document against its schema before publishing or saving it.
A room token must match the URL, stored identity, and message identity. Room
initialization is atomic and retryable only with the original seed.

`packages/api` defines every public HTTP operation with oRPC and TypeBox.
The Worker uses the OpenAPI Fetch handler; the CLI uses its typed OpenAPI client.
`bun run schema:generate` emits the OpenAPI 3.1 input for Apple's official Swift
client generator. `packages/schema/src/room.ts` owns explicit client/server
message variants, included as named OpenAPI components for Codable generation.

Worker-to-room initialization, seed reads, and membership changes use typed
Durable Object RPC. Expected errors return a discriminated result so HTTP status
survives the RPC boundary. Only WebSocket upgrades use `stub.fetch(request)`.
The Worker validates upgrades before waking a room. SQLite transactions protect
multi-statement changes; persisted socket attachments restore replay state after
hibernation. There are no external calls inside room transactions or per-message
`blockConcurrencyWhile` locks. `enable_request_signal` enables request cancellation
for the oRPC Fetch adapter.

The WebSocket flow is:

1. `welcome` → `hello` with the durable local cursor.
2. `updates` windows → native import and SQLite commit → one `applied` for the
   final sequence in the window.
3. `ready` → send one outbox batch. A matching `ack` durably removes it, then the
   next batch can be sent. An upload ACK never advances the replay cursor.
4. Connection failure or a missing ACK renews credentials and reconnects with
   backoff. Replay precedes uploads. Retries reuse exactly the same batch ID,
   hash, and bytes. Protocol/schema errors pause sync and preserve local edits.

Sockets use the hibernation API; `ping`/`pong` uses the runtime auto-response.
No in-memory state is necessary to recover the room. Native documents retain a
SQLite checkpoint, outbox, cursor, and the owner's immutable sharing seed.
Invitation downloads install a verified seed with fresh local state. In-app
Duplicate creates independent history and a new document identity.

## Current boundaries

This implementation targets macOS. iOS and iCloud coordination are deferred.
There are no compatibility adapters for older document or protocol formats.
Offline changes merge using the schema's Loro containers. CRDT convergence does
not guarantee schema validity: an invalid merge pauses that client for recovery.
The relay cannot inspect opaque Loro changes, so an invalid admitted batch can
block replay for other members; in-place room repair/quarantine is not implemented. Duplicate the last valid
local data and share a new room to recover.

Media has a separate content-addressed transfer path and is not part of the Loro
log. Completed uploads are cached for the connection and downloaded bytes are
hash-checked. Media GET URLs remain public by content hash; private media access
control is not implemented. Room log compaction is also deferred (64 MiB/10,000
entries per room).

## Authoring and recovery

`documentStore.current` is a frozen confirmed value. Use `store.change(draft =>
{ ... })` for structural edits and `documentText` for text inputs; direct
assignments and `bind:value` into `current` are invalid. Text drafts retain their
base revision so native Loro can merge against concurrent changes.

The close/export flush barrier rejects failed opens, edits, and commits. A remote
publication or reload cannot silently clear a failed edit. The example apps show
the error and offer explicit `discardFailedChanges()` recovery; failed text stays
in its input until that recovery. `reload()` retries a failed open. Network loss
alone does not block local editing or saving; the native durable outbox retries
when the room reconnects.

## Catalog and publishing

The native catalog, CLI search/publish, and creation counts use the same oRPC
HTTP contract. Swift consumes its generated OpenAPI client. Clients follow
pagination before filtering and sorting; D1 is the catalog source of truth.
R2 stores hash-addressed package bytes and images. The Worker also serves the
canonical manifest schema at `/schemas/v1/manifest.schema.json`.

`apps/firebase` has been retired. Firebase Auth and native telemetry remain;
there are no Firebase catalog subscriptions or callable Functions in clients.
Existing hosted Firebase data is not migrated or deleted by this source change.

## Share bootstrap and access

Share uploads an allowlisted immutable sender app (including unpublished apps),
plus the initial Loro seed. R2 keys bind the exact app bytes; D1 stores only
immutable metadata. The room owns membership, blocked users, and invitations.
Bootstrap retries must match both the original seed and artifact hash. Join
validates the bounded app and seed in staging before activating a destination.
Owners can rotate/disable invites and remove members, closing their sockets.
Media transfer follows schema-declared `S.Media` references on document events.

## Native integration smoke test

From the repository root, run:

```sh
HITSLOP_NATIVE_SYNC=1 bun test ./apps/cloudflare/tests/room.integration.test.ts
```

This starts isolated local Wrangler/D1/R2 storage and runs two real Swift Loro
replicas through generated HTTP clients and native WebSockets. It uploads an
unpublished app, joins, merges offline edits, disconnects/reconnects, and reopens
the resulting SQLite document. Swift/Xcode and Node must be on PATH. The Swift
test only accepts a loopback origin. No hosted data is created.

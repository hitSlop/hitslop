# hitSlop API and document authority

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
  apps/apple/Packages/HitSlopApple --no-parallel --filter CommandRoomTests`

## Sync contract

One SQLite Durable Object per shared document owns its JSON snapshot, revision,
retry leases, and command receipts. The room applies explicit operations and
validates the candidate against the immutable app's schema before committing.
Swift remains the WebView's gateway. A room token must match the URL, stored
identity, and message identity. Initialization is atomic and retryable only with
the original seed and immutable app hash.

`packages/api` defines every public HTTP operation with oRPC and TypeBox.
The Worker uses the OpenAPI Fetch handler; the CLI uses its typed OpenAPI client.
`bun run schema:generate` emits the OpenAPI 3.1 input for Apple's official Swift
client generator. `packages/schema/src/room.ts` owns explicit client/server
message variants, included as named OpenAPI components for Codable generation.

Worker-to-room initialization, seed reads, and membership changes use typed
Durable Object RPC. Expected errors return a discriminated result so HTTP status
survives the RPC boundary. Only WebSocket upgrades use `stub.fetch(request)`.
The Worker validates upgrades before waking a room. SQLite transactions protect
multi-statement changes; persisted socket attachments restore authenticated session state after
hibernation. There are no external calls inside room transactions or per-message
`blockConcurrencyWhile` locks. `enable_request_signal` enables request cancellation
for the oRPC Fetch adapter.

The WebSocket flow is:

1. Protocol 2 `welcome` → authenticated `hello`.
2. `ready` supplies the current snapshot and an authority-issued retry lease.
3. `execute` carries a command batch or conditional full replacement. The room
   commits JSON, revision, and receipt together, broadcasts a `snapshot` once,
   then returns the correlated `result`.
4. Connection failure or a lost result renews credentials and reconnects with
   backoff. An unknown attempt retries its exact original request and lease.
   Seven-day leases bound receipt retention; expired attempts never execute again.

Sockets use the hibernation API; `ping`/`pong` uses the runtime auto-response.
Room state survives eviction. Native documents persist their confirmed cache,
shared mode, and any unresolved admitted request before sending it. Invitation
copies start from a verified snapshot. In-app Duplicate creates an independent
local authority with a new document identity.

## Current boundaries

This implementation targets macOS. iOS and iCloud coordination are deferred.
There are no compatibility adapters for older document or protocol formats.
Local documents work offline. Shared documents become read-only when disconnected;
there is no offline edit queue or automatic merge of concurrent file edits.
Commands reject invalid candidates before commit. Full snapshots remain capped at
1 MiB; compression and subtree broadcasts are deferred pending measurement.

Media has a separate content-addressed transfer path. Completed uploads are cached
for the connection and downloaded bytes are hash-checked. Media GET URLs remain
public by content hash; private media access control is not implemented.

## Authoring and recovery

The document's `data` is a frozen confirmed snapshot. Use schema-derived `fields`
and explicit store verbs; `change(tx => …)` groups commands atomically. The store's
`text` action retains local input drafts, including IME composition. Committed
strings use last-write-wins semantics. Store lifecycle owns readiness and cleanup.

Close/export flushes drafts and forces the editable projection. Failed commands
and retained text require explicit recovery through the native host. Unknown
outcomes must resolve before new writes; they cannot be silently discarded.
Stale or invalid external file proposals are preserved and reported rather than
merged. See [the storage contract](../../docs/storage.md).

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
plus the initial JSON snapshot. R2 keys bind the exact app bytes; D1 stores only
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

This starts isolated local Wrangler/D1/R2 storage and runs real Swift document sessions through generated HTTP clients and native WebSockets. It uploads an
unpublished app, joins, verifies offline read-only behavior, disconnects/reconnects, and reopens
the resulting SQLite document. Swift/Xcode and Node must be on PATH. The Swift
test only accepts a loopback origin. No hosted data is created.

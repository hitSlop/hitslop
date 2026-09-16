# Native Loro relay spike

An isolated Cloudflare Worker routes each shared document to one SQLite-backed
Durable Object. Swift owns the Loro document and sends opaque snapshots over a
WebSocket. Opt-in protocol 2 uses durable incremental updates and an immutable seed;
see [spike 4](../../docs/native-loro-incremental-spike.md). The relay has no CRDT
engine and never interprets application data.

See [the decision report](../../docs/native-loro-spike.md) for the complete native
schema, draft, persistence, and measurement design. This is a test service, separate
from the production Firebase catalog/sharing service.

## Run from the repository root

```sh
# Build the native harness; run unit/UI/local-network/hosted-network checks;
# benchmark both engines with 1, 5, and 10 windows.
bun run spike:native-loro --e2e --hosted

# Correctness only, using the local relay.
bun run spike:native-loro --e2e --verify-only

# Two native processes editing copies of one shared checklist.
bun run spike:native-loro --open-pair
bun run spike:native-loro --open-pair --hosted

# Explicitly deploy/update ONLY the isolated test Worker, provision its signing
# secret, and run hosted checks. Requires Wrangler Cloudflare authentication.
bun scripts/native-loro/hosted.ts --deploy
```

Hosted commands use the endpoint recorded in `.hitslop/native-loro/hosted.json`.
Direct `hosted.ts`/`e2e.ts` calls use the debug native executable by default; set
`HITSLOP_SPIKE_EXECUTABLE` to use another build. The root runner builds and selects
release automatically. It does not implicitly deploy a Worker.

The local runner creates an ignored `.dev.vars`, starts Wrangler on port 8791,
retains SQLite under `.hitslop/native-loro/relay-storage`, and stops the server on
exit. Test rooms are deleted in cleanup. Interactive sessions end with Ctrl-C in
the terminal; their disposable native document directories remain for inspection.

## Wire contract

This section describes the retained protocol 1 baseline. Run
`bun run spike:native-loro --incremental` for protocol 2's outbox, crash/retry,
invalid-import, and large-history bootstrap gates. Add `--hosted --deploy` to
explicitly update the isolated Worker and run the same hosted gates.

All messages are JSON; `checkpoint` is canonical base64 of a Loro snapshot.
`schema` is the generated schema's SHA-256. `version` is an opaque frontier string.

| Direction | Message | Meaning |
| --- | --- | --- |
| Server → client | `welcome {bootId}` | Connection accepted; identifies this object incarnation |
| Client → server | `hello {after}` | Replay after the client's durably stored sequence |
| Server → client | `snapshot {sequence,hash,snapshot}` | One ordered, unapplied log entry |
| Client → server | `applied {sequence}` | Checkpoint and cursor committed together locally |
| Server → client | `ready {head,bootId}` | Replay caught up |
| Client → server | `append {id,snapshot}` | Offer a durable native checkpoint |
| Server → client | `ack {id,sequence,hash}` | Unique bytes committed to SQLite |
| Server → client | `error {message}` | Reject this operation; native local editing remains available |

Snapshot object:

```ts
{ documentId: string, schema: string, checkpoint: string, version: string }
```

SHA-256 deduplicates retry uploads. SQLite assigns contiguous sequences. The relay
persists before acknowledgement or fanout; one unacknowledged snapshot per socket
bounds replay. Swift validates and merges before committing its checkpoint and
replay cursor in the same existing journal transaction. It acknowledges delivery
only after that commit. Reconnect replays the remaining log and offers the current
native checkpoint again. No network heartbeat or polling runs while connected and
idle; WebSockets use the Durable Object hibernation API.

The relay retains every accepted unique snapshot. Replacing history with the last
snapshot would be incorrect: it might not contain another disconnected peer's
edits. A production service needs a proven compaction/checkpoint protocol or a
bounded incremental-update protocol before growing beyond these limits.

## Test access and limits

Credentials are short-lived, room-scoped HMAC-signed bearer tokens provided in
HTTP/WebSocket headers. A local test issuer holds the signing secret outside all
`.slop` packages. Tokens never enter the renderer. SQLite holds membership;
revocation closes the member's active sockets and blocks reconnect. The owner can
create a room, change membership, inspect counters, and remove the room.

This issuer is a harness, **not production account authentication or invitations**.
The relay can validate byte limits, identity, and schema fingerprint; only native
clients can validate the contents of an opaque Loro checkpoint.

Current limits: 512 KiB per decoded snapshot, 1 MiB per message, 64 MiB of checkpoint
payload per room, 10,000 unique snapshots, and 20 members. Quota errors pause network
delivery while native saving continues. Snapshot versions, indexes, and SQLite
bookkeeping are additional storage; the payload counter is not a billing meter.

`TEST_CONTROLS=true` enables owner-only fault injection at `/test`: lost ACK after
persistence, an artificially low quota, and forced object restart. This must remain
an isolated test deployment. No production data, media, presence, invite UI,
long-term retention policy, compaction, or abuse-resistant public token issuer is
implemented here.

## Verification

`tests/relay.ts` checks the opaque protocol using synthetic bytes. Native
`scripts/native-loro/e2e.ts` separately checks **real Loro** merges using two AppKit
processes, forced termination, offline reopen, editable JSON, renderer detach,
reconnection, quota, and revocation. A hosted idle observation records object boot
IDs and socket counts; it reports whether hibernation was actually observed.
Logs and evidence live under `.hitslop/native-loro/results-v2`.

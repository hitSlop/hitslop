# Native Loro spike 4: durable incremental sharing

This experiment keeps the native ownership and text policy established by
[spike 3](native-loro-bridge-spike.md), and replaces full-snapshot uploads with
ordered Loro updates. It is isolated from the production host and Firebase sharing.
Loro remains pinned to **1.13.3**. Incremental mode requires durable confirmation.

## Result and recommendation

**The incremental protocol passed locally and on the deployed test Worker. Keep
native Loro and the opaque relay; improve batching before production.**

The final run passed 26 native unit tests and, in each environment, 15 snapshot
baseline checks, 15 incremental relay checks, and 35 native end-to-end checks.
Release builds and the relay/harness TypeScript checks passed. All test rooms and
credential files were removed by the harness.

| Measurement | Local relay | Hosted Worker |
| --- | ---: | ---: |
| Edits in payload comparison | 1,000 | 1,000 |
| Full-snapshot binary payload total | 31,756,876 bytes | 31,674,167 bytes |
| Incremental binary payload total | 121,890 bytes | 121,890 bytes |
| Payload reduction | 99.616% | 99.615% |
| Time to sync the 1,000-edit backlog | 296.2 s | 363.6 s |
| Original seed snapshot | 984 bytes | 971 bytes |
| Current full snapshot at late join | 1,372,601 bytes | 1,371,443 bytes |
| Retained entries at late join, including seed | 1,090 | 1,090 |
| Third-device bootstrap | 13.5 s | 83.6 s |

The small-update bandwidth win is clear. **Backlog throughput is not ready to
ship unchanged:** roughly six minutes for 1,000 hosted edits is too slow. An
earlier local run took 47.4 seconds, so these variable single-machine measurements
also require a controlled performance follow-up. The backlog timings include
journal commits and test observation; they are not local UI acknowledgement
latency measurements.

The next work should batch transport and durable replay, and reduce journal work
for delivery bookkeeping. This keeps the confirmed-state contract and immutable
retry IDs. It does not require another CRDT engine or an optimistic webview replica.

## Architecture

```text
Svelte change / documentText
             │ JSON request, existing private bridge
             ▼
       Swift document actor ── confirmed JSON ──► Svelte
             │
             ├── one journal transaction:
             │     checkpoint + JSON projection + immutable outgoing batch
             │
             └── WebSocket ──► Durable Object's ordered opaque byte log
                                  │
                                  └── update ──► another Swift document actor
```

The dynamic schema still comes from the authored TypeScript and generated
`data.schema.json`. No Loro engine, peer, credentials, or update bytes enter the
webview. The renderer adapter retains `documentText` ancestry and confirmed
`current`; this spike does not introduce another text policy.

## What is durable

`SpikeDocument` owns a Loro replica, an outgoing queue, and an incoming replay
cursor. The existing journal commits their state together. Outgoing batches live
in host-owned `state/materialization.json` metadata, alongside the cursor and
schema fingerprint; there is no second database or third data format.

For each local UI or accepted external-JSON edit:

1. Capture the replica's version vector before applying the edit.
2. Apply the existing schema-aware diff and validation.
3. Export Loro updates since that vector.
4. Give those exact bytes a UUID and SHA-256 hash, once.
5. Journal checkpoint, JSON projection, and the new batch together.
6. Publish confirmed state and permit the batch to be sent.

The batch ID and bytes survive retry and restart. An unsaved staged batch cannot
leave the actor through `nextBatch()`: that method first completes the journal.
Accepted external-file edits use the same path. Importing a remote batch creates
no outgoing batch, so replay cannot start a snapshot echo loop.

### Two acknowledgements with different meanings

| Message | Meaning | Native durable action |
| --- | --- | --- |
| Server `ack` | The relay stored this outgoing batch | Remove that ID from the outbox in a journal transaction |
| Client `applied` | This client saved an incoming log entry | Send only after checkpoint and incoming cursor commit together |

An outgoing ACK **never advances the incoming cursor**. Other people's entries
can precede the acknowledged upload. A client's own echoed update travels through
the same ordered receive path; importing already-known operations is safe.

The connection sends one batch at a time and checks ACK ID, hash, and sequence.
Reconnecting replays from the durable incoming cursor, then retries the immutable
head of the outbox. Changing an ID on retry would break this contract.

## Relay protocol 2

Rooms choose their protocol at creation. Protocol 1 remains the snapshot baseline.
Protocol 2 requires freshly seeded native documents; existing snapshot-mode files
are not silently migrated. The test service's SQLite migration only adds columns
and an index, preserving old rooms as protocol 1.

The relay imports no Loro library and never merges JSON. Its responsibilities are
room authorization, membership, ordered storage, hashes, idempotency, byte limits,
and delivery with backpressure.

```ts
type Batch = {
  id: string;   // UUID, immutable across retries
  hash: string; // SHA-256 of decoded bytes
  bytes: string; // canonical base64 of one Loro incremental export
};
```

| Direction / route | Payload |
| --- | --- |
| `POST /rooms/:id` | `{protocol:2, documentId, schema, checkpoint, version}` — seed snapshot |
| `GET /rooms/:id/seed` | `{protocol:2, sequence:1, hash, snapshot}` — original seed |
| Client → server | `hello {protocol:2, documentId, schema, after}` |
| Client → server | `append {protocol:2, documentId, schema, batch}` |
| Server → client | `update {sequence, documentId, schema, batch}` |
| Server → client | `ack {id, sequence, hash}` |
| Client → server | `applied {sequence}` |
| Server → client | `ready {head, bootId}` or `error {message}` |

SQLite assigns a sequence when it first stores a batch. Repeating that batch ID
and hash returns the original sequence. Reusing an ID with different bytes fails.
The prototype also rejects identical bytes under a different ID. The durable
storage barrier completes before either fanout or ACK.

Each socket receives one unapplied entry at a time. The relay retains **every**
entry; its last delta cannot replace the preceding log. Test limits remain
512 KiB per decoded seed/update, 1 MiB per JSON message, 64 MiB of payload per room,
10,000 entries including the seed, and 20 members. These are application limits,
not Cloudflare platform limits or billing estimates.

### Bootstrap when the current snapshot is too large

The original seed is immutable sequence 1. A joining client fetches and checks
that seed, commits it with cursor 1, then replays all later deltas. Thus an
existing room can still admit a new device after its current snapshot exceeds
the per-message cap, as long as each retained entry is within that cap.

This does **not** make an already-large local file shareable for the first time.
Room creation still requires a seed within the limit. It also does not allow one
oversized edit through the socket. Such an edit remains in the durable local
outbox, pauses sharing, and blocks later batches until a future recovery policy
handles it. Local editing and reopening remain available.

## Receiving untrusted updates

The native owner checks identity, schema fingerprint, hash, and contiguous log
sequence. It imports into a temporary fork first, rejects Loro's nonempty
`ImportStatus.pending` dependencies, and validates the resulting JSON against the
schema before touching the live replica.

Malformed bytes, missing dependencies, or a schema-invalid projection pause
sharing without changing confirmed state, checkpoint, or durable cursor. Later
entries are not skipped. A relay can accept bad bytes from an authorized peer
because it intentionally cannot interpret their contents. This experiment proves
containment at the client; it does not implement repair of a poisoned room log.

## Failure tests

| Injected failure | Required recovery |
| --- | --- |
| Force quit while offline | Identical durable batch IDs/bytes reopen and later converge |
| Crash before send | Outbox retains the batch; first send happens after restart |
| Relay stores bytes but drops ACK | Retry returns the original sequence |
| Crash after receiving server ACK | Outbox still retains the batch; retry is idempotent |
| Crash after outbox-removal commit | Removed batch stays removed after restart |
| Crash after receive commit, before `applied` | Reopened checkpoint and cursor already include the entry |
| Journal interruption | Recovery keeps checkpoint, outbox, and cursor consistent |
| Relay restart | Stored seed, full update log, and idempotency keys survive |
| Invalid authorized-peer bytes | Confirmed state and cursor stay unchanged; local work continues |
| Quota, revocation, oversized delta | Local durable saves continue; network cannot discard the queue |

The unit tests inject exceptions before the journal commit and after each relevant
file replacement. The two-process harness uses actual `SIGKILL` at connection
boundaries. These exercise different recovery paths. ACK-only commits skip an
unchanged checkpoint, so there is no checkpoint-replacement fault to inject in
that particular transaction.

## Running it

```sh
# Build fixtures and release executable; unit, type, and local-network gates.
bun run spike:native-loro --incremental

# Also use the already-deployed isolated Worker recorded in hosted.json.
bun run spike:native-loro --incremental --hosted

# Explicitly update that test Worker before hosted gates.
bun run spike:native-loro --incremental --hosted --deploy
```

For a focused hosted rerun after a successful local run, add `--hosted-only`.
`--skip-build` reuses the current executable and omits build/unit/type gates; it
must not be treated as evidence that those gates ran. These commands operate on
disposable copies under `.hitslop/native-loro`, and delete created relay rooms and
test credential files in cleanup. Deployment requires the existing Wrangler
account authentication; tokens and signing secrets remain outside `.slop` files.

Sources:

- [Native owner and journal integration](../apps/apple/Packages/HitSlopApple/Sources/HitSlopLoroSpike/SpikeDocument.swift)
- [Immutable batch](../apps/apple/Packages/HitSlopApple/Sources/HitSlopLoroSpike/SpikeBatch.swift)
- [Native connection](../apps/apple/Packages/HitSlopApple/Sources/HitSlopLoroSpike/SpikeConnection.swift)
- [Relay](../Prototypes/native-loro-relay/src/index.ts)
- [Native failure tests](../apps/apple/Packages/HitSlopApple/Tests/HitSlopLoroSpikeTests/IncrementalTests.swift)
- [Protocol tests](../Prototypes/native-loro-relay/tests/incremental.ts)
- [End-to-end harness](../scripts/native-loro/incremental-e2e.ts)

## Evidence and limits

The runner writes `.hitslop/native-loro/results-v4/results.json`; individual runs
also retain native logs and document copies. The reviewed archive is
[results-v4.json](experiments/native-loro/results-v4.json).

The 1,000-edit comparison exports a full snapshot at every durable edit and counts
the actual immutable update bytes generated for those same edits. It compares
decoded binary payloads, excluding base64, message envelopes, ACKs, and transport
headers. It then uploads and replays all 1,000 real batches. This measures the
benefit over the snapshot spike; it is not a production bandwidth or latency SLA.

The first hosted attempt exceeded its four-minute backlog timeout while making
progress. A diagnostic retry was stopped after stack samples showed substantial
main-thread serialization of the entire outgoing queue in the test's progress
poll. The harness now requests only its durable count. Full batch contents are
still checked explicitly at crash boundaries and for payload accounting. The
final runs use this cheaper probe and a ten-minute correctness window, recording
the actual catch-up duration. The profiles also include journal work; this is not
a complete attribution of end-to-end latency to the network alone.

One durable edit per upload and one replay entry per acknowledgement still pay
network and journal costs repeatedly. Bounded upload/replay batching is the next
throughput improvement, preserving immutable retry IDs and durable cursor
semantics. Fast local confirmation does not imply fast backlog clearance across
the Internet.

Remaining production work includes network batching, compaction and bootstrap acceleration, recovery
UX for poisoned logs or oversized entries, bounded durable queue storage, auth and
invites, and the native service cutover. The prototype rewrites journal metadata
and saves full local checkpoints; smaller network updates do not make those disk
writes incremental. System IME remains the manual release gate from spike 3.
Browser preview, runtime compatibility, and old-document migration are unchanged.

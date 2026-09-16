# Native document bridge: spike 3

The follow-up [incremental sharing spike](native-loro-incremental-spike.md) keeps
this bridge policy and tests the native-to-native network protocol separately.

This experiment asks two narrower questions than [spike 2](native-loro-spike.md):

1. Can a text field render every native publication and discard draft ancestry?
2. Can native acknowledgement mean the journal transaction has completed?

The implementation remains in the opt-in `HitSlopLoroSpike` target and a generated
copy of Quick Checklist. It does not change the production runtime, the document
format, browser preview, or the relay protocol.

## Result and recommendation

**Prefer durable confirmation with the retained text draft/ancestry binding.**
The native-owner architecture passed this spike. Making every input fully
confirmed by immediately replacing the field failed the correctness screen under
both confirmation policies, even with zero injected delay.

Recorded on macOS 26.6.2, arm64, with an optimized native executable:

| Open windows | Accepted ACK p95 | Durable ACK p95 | Durable typing input-to-ACK p95 |
| --- | ---: | ---: | ---: |
| 1 | 18 ms | 31 ms | 42 ms |
| 5 | 22 ms | 32 ms | 38 ms |
| 10 | 24 ms | 32 ms | 38 ms |

These are pooled p95 values across three runs: 300 structural changes and 120
text inputs per cell. Every individual run's durable structural ACK p95 was
below 50 ms (worst: 37 ms). Normal typing at 20 characters/second reached at most
two queued requests and always drained. The two-animation-frame rendering proxy
was about 50–52 ms p95 for both policies. These figures include the new generated
bridge request validation, so they should not be substituted into spike 2's
older 7 ms measurements.

The immediate-frame candidate produced `abcXYZXYX` under accepted confirmation
and `abcXXYZXY` under durable confirmation from the same `abc` → `abcX` → `abcXY`
→ `abcXYZ` input trace. Exact ordering can vary with CRDT peer IDs; extra text is
always a failure. That candidate was excluded from benchmarks.

Verification passed:

- 20 native unit tests, including parameterized journal/close failure cases.
- Per confirmation policy: 21 additional input/bridge checks, 9 storage checks,
  47 existing native UI checks, 9 native keyboard/history checks, and 17 local
  two-process WebSocket checks.
- 18 benchmark runs; all final text and queue-drain checks passed.
- Svelte and harness TypeScript checks, generated experimental contract check,
  and the production schema freshness check.

At 500 ms of injected storage delay, three immediate inputs took about 1.64 s to
confirm in durable mode, while remaining visible and editable in the local text
field. Durability does not eliminate queues or temporary input state. It makes
acknowledged document state easier to reason about.

This supports the next native service implementation, with system IME and the
remaining production work below still outstanding. The harness keeps `accepted`
as its historical default; use `--confirmation durable` to try the recommended
policy. No production cutover is included.

## Run and inspect

```sh
# Build, validate, compare, and benchmark the passing text strategy.
bun run spike:native-loro --bridge-compare

# Also run two native processes against the existing local WebSocket relay.
bun run spike:native-loro --bridge-compare --e2e

# Correctness only.
bun run spike:native-loro --bridge-compare --verify-only

# Try each confirmation policy interactively.
bun run spike:native-loro --open --confirmation durable
bun run spike:native-loro --open --confirmation accepted

# Reproduce the rejected text policy interactively.
bun run spike:native-loro --open --text-policy host-frame

# Verify that experimental generated bindings match TypeBox.
bun scripts/native-loro/generate-contract.ts --check
```

Results, screenshots, disposable documents, and logs go to
`.hitslop/native-loro/results-v3/`. The committed measurement archive is
[results-v3.json](experiments/native-loro/results-v3.json). Spike 1 and 2 archives
are retained. `--skip-build` is for iterating on harness scripts against an already
built executable, not a release verification command. No hosted deployment runs
implicitly.

## Author API

The experimental adapter exposes document state, readiness, `change()`, `flush()`,
and teardown. It hides revision tokens, sessions, sequence numbers, parent edits,
and draft release. This is the API in the generated pilot:

```svelte
<script lang="ts">
  import { documentStore, documentText } from './spike-store.svelte';
  import schema from '../schema';
  import initial from '../initial';

  const checklist = documentStore({ schema, initial });

  async function toggle(id: string) {
    await checklist.change(data => {
      const task = data.tasks.find(task => task.id === id);
      if (task) task.done = !task.done;
    });
  }
</script>

<textarea use:documentText={{
  store: checklist,
  read: data => data.title,
  write: (data, value) => { data.title = value; },
}} />
```

For a task field, read and write through its stable task ID, not its array index.
A deleted task's writer does nothing; it does not recreate the task. The keyed
Svelte element remains attached to its item when that item moves.

`current` is a deeply frozen projection received from Swift. A `change()` callback
runs once, at the head of the ordered queue, on a clone of the latest confirmed
state. It must finish synchronously. The callback never crosses the native bridge.
`await change()` waits for the selected native confirmation policy. `flush()`
drains the queue and requests a native save, including recovery after a previous
edit rejected.

`documentText` is deliberately different from ordinary structural changes: the
browser already changed the field before its `input` event. The binding captures
that text immediately, while keeping document `current` native-owned. There is no
optimistic document replica and no CRDT code in the webview.

## One experimental wire definition

[The TypeBox source](../packages/schema/experiments/native-spike-bridge.ts) defines
frames, edits, method names, and policy choices. Its generator emits Swift Codable
models and request validation plus standalone TypeScript types for the copied
Svelte adapter. Generated files are not edited by hand. This definition stays
outside the production schema exports and build output.

Normal traffic:

```text
open  -> { publication, revision, data, dirty, error, projectionError }
apply <- { session, sequence, base, after, draft?, parent? }
apply -> native frame
flush -> native frame
native event -> native frame
releaseDraft <- { session, draft }       (internal cleanup)
```

`publication` is a monotonic native counter for suppressing stale replies/events.
`revision` is an opaque token tying a Loro frontier to the document identity and
schema fingerprint. It is not a runtime version. The schema is compiled from the
Svelte project's TypeScript source and read dynamically by the native adapter;
there is no generated Swift `Checklist` model.

Each renderer uses a session and increasing sequence. The host rejects an
out-of-order edit, detects reuse of a sequence for different content, and returns
the cached result for an identical last retry. There is one apply request in
flight per store. A newer publication cannot be replaced by an older reply.

Only the spike installs `remote`, `delay`, and `storage` fault controls. Native
request validation rejects extra fields, unknown methods, invalid sequences, and
out-of-range test delays. The unused `authoredRevision` reply field is removed.
The native owner alone retains authored frontiers.

## Why the immediate-frame text candidate fails

Starting with a CRDT text value `abc`, deliver these inputs in one event turn:

```text
input abcX    base = revision of abc
input abcXY   base = revision of abc
input abcXYZ  base = revision of abc
```

The candidate captures each proposed value and base when the input occurs, queues
them, and immediately renders native frames as they arrive. It never blocks
input. Without a parent chain, the three proposals become independent edits from
`abc`. The screen checks for exactly `abcXYZ`; it records any extra/missing text
and exits before benchmarks. This failure is about edit ancestry, even at zero
injected delay.

The retained binding keeps one local text draft while input requests or IME
composition are pending. Each accepted edit records its authored frontier in
Swift. Its successor diffs against that frontier, even if remote updates have
already merged into the canonical document. When typing settles, the binding
reconciles with native JSON and adjusts the selection. During composition it
sends only the final composed value. This is local field state, not a second Loro
replica.

## Accepted versus durable confirmation

| Policy | When `current` changes and `change()` resolves | Saving |
| --- | --- | --- |
| `accepted` | After validation and native in-memory merge | Debounced journal transaction; `flush()` is the save barrier |
| `durable` | After the journal transaction succeeds | One transaction per accepted edit; changed data is withheld on failure |

The journal uses the existing atomic replacement and synchronization path. Here,
“durable” means that transaction returned successfully. This spike tests injected
failures and process termination; it does not simulate physical power failure.

For durable confirmation, Swift keeps the last confirmed JSON and frontiers
separate from the working replica. Error publications may change status while
continuing to display the last confirmed data. A failed write can have written a
recoverable pending journal already. The owner retains that work, recovers the
journal, and completes a flush before applying another edit. It does not claim a
failed operation was rolled back.

A failed text request keeps its DOM draft. If recovery confirms every character
in that field, the binding releases the failed draft and permits continued
editing. If the user typed additional characters that were never accepted, it
holds those characters rather than discarding them. An explicit recovery/discard
experience for that case remains production work. Killing a renderer can lose
such unacknowledged text.

## Test boundaries

- Three inputs before acknowledgement at 0, 20, 100, and 500 ms.
- Remote edits around acceptance/reply and during composition; historical bases
  are included in injected remote proposals to avoid accidentally simulating a
  delete of a newly accepted character.
- Existing pilot actions, repeated checkboxes, text insertion/deletion/replacement,
  Unicode, item reorder/deletion, selection replacement, and paste-shaped input.
- Native AppKit keyboard events through WKWebView, including selection,
  backspace, and native undo/redo through the focused responder's undo manager.
  Undo may coalesce adjacent edits; redo must restore the exact final text.
  The browser's `input` events
  must be trusted for these checks to pass.
- Failed saves, recovery after a rejected queue, delayed storage, normal close,
  renderer reload, and native checkpoint recovery at journal boundaries.
- Existing local relay tests with both confirmation policies: independent
  processes, offline edits, force quit/reopen, external JSON, and reconnection.
- Optimized builds, three runs per policy at 1, 5, and 10 open windows. One window
  edits; the other windows are idle. This is not a simultaneous ten-editor load.
- A 20-character-per-second text stream measures input-to-acknowledgement and
  queue growth. Two animation frames after a mutation are a rendering latency
  proxy, not an instrumented display-presentation timestamp.

At zero delay, reply timing is naturally raced; delay controls at higher values
exercise the overlapping windows. Synthetic composition and paste events do not
prove behavior of a system input method or the system clipboard.

## Remaining production work

This spike does not implement the native migration, incremental relay updates,
compaction, the external-edit review sheet, a complete text recovery UI, or
large-document/history performance gates. It retains Loro Swift 1.13.3 and the
existing full-snapshot relay protocol. Manifest runtime compatibility still
belongs to the eventual production migration.

System IME composition with a remote edit remains a manual release gate. The
recorded machine's enabled input sources are stored with the keyboard results;
a U.S./Dvorak layout and Character Viewer do not exercise language composition.

# Command/snapshot spike

Disposable, standalone TypeScript proof of the proposed sync contract. Two independent Quick Checklist views share one in-memory authority. Production packages, native persistence, and the current Loro path are unchanged.

## Run

From this directory:

```sh
bun install
bun run dev
```

Open http://127.0.0.1:5187. Reload resets everything. This directory has its own dependency lock and is outside the root workspaces; it imports the repository's canonical schema validation and theme helpers directly.

Try the 0/50/150/400 ms latency controls, independent disconnections, rejected commands, and lost acknowledgements. The counter demonstrates concurrent increments. Checklist controls wait for confirmation; text fields keep local drafts. Flush drafts explicitly before inspecting confirmed state.

## Authoring proved here

```ts
const fields = paths(schema);
const store = documentStore({ schema, initial, host });

await store.insert(fields.tasks, { id: crypto.randomUUID(), text, done: false, archived: false });
await store.set(fields.tasks.item(task).done, true);
await store.patch(fields.tasks.item(task.id), { archived: false, done: false });
await store.change(tx => {
  for (const id of finished) tx.set(fields.tasks.item(id).archived, true);
});
```

The counter uses `counter.increment(counterPaths.count)` with its own schema/store. In Svelte, use `use:store.text={fields.title}` and read `store.data`. `$` cannot be an imported binding in a Svelte component, so this spike uses `fields`.

Paths are frozen, inert values with no writers or Proxy. `item(id | row)` exists only on branded identity lists; `at(key)` exists only on records. Plain arrays remain atomic. Confirmed snapshots are deeply read-only. A batch callback is synchronous and must use its transaction's verbs.

Mutations return `Promise<Result>`; expected rejections are explicit results and also appear on the store. Callers clear composers or show success only after `ok`. An unknown outcome must resolve the original request ID before another edit is submitted. `destroy()` flushes and refuses to close on failure; `dispose()` is explicit discard for this disposable harness.

## Contract

- Commands: `set`, `unset`, `toggle`, `increment`, `insert`, `remove`, `move`. `patch` expands to an atomic batch of sets.
- Paths: `{ key: string } | { item: string }` steps. No numeric list indices. Position is `{ before: id } | { after: id }`; omitted insert position appends.
- The authority clones, applies the complete batch, validates the resulting document, commits one revision plus request receipt, then publishes a full snapshot.
- `set` is explicit last-write-wins, including subtree replacement. Replacing an addressed row preserves its identity. Prefer semantic list verbs for concurrent membership/order changes. Root replacement uses conditional `replace`, not `set`.
- Missing targets/anchors reject the whole batch. Duplicate IDs and identity-field writes reject. Optional fields and record entries can be unset. Unknown stored fields survive unrelated edits; undeclared paths cannot be addressed.
- Retries reuse the same ID and payload; changed payloads reject. Receipts are unbounded and in-memory here. Production must persist receipts and state atomically and define retention.
- Conditional replacement requires the current `baseRevision`. It exercises the proposed file-save protocol, not an actual filesystem watcher.
- Text drafts debounce at 300 ms, flush on blur or explicit flush, and respect IME composition. Focused drafts survive remote snapshots. Rejected or deleted-row drafts remain available for retry/discard. Text is last-write-wins at authority acceptance, with no merge.
- Disconnected views are read-only and receive a fresh snapshot on reconnect. No offline command queue or document-wide optimistic replay.

## Verify

```sh
bun test tests
bun run check
bun run fixtures
bun run build
bun run test:browser
bun run benchmark
bun run benchmark:browser
```

Browser tests/benchmark require the running dev server and installed Google Chrome (`channel: "chrome"`). The fixture generator emits portable JSON with independently authored expected states for a future Swift interpreter. Strict negative type cases live in `tests/types.ts` and are checked by `bun run check`.

Engine timings are in `results/engine.json`; browser timings in `results/browser.json`. The browser benchmark renders a revision/count consumer, not 10,000 DOM rows. Neither measures native disk durability, WebKit, the Swift bridge, or a real network. See [FINDINGS.md](FINDINGS.md) for results and the graduation decision.

## File map

| Area | Files |
| --- | --- |
| Schema brands and inert paths | `src/schema.ts`, `src/paths.ts` |
| Wire and interpreter | `src/protocol.ts`, `src/apply.ts` |
| Authority and fault transport | `src/host.ts` |
| Store and local text drafts | `src/controller.ts`, `src/document-store.svelte.ts`, `src/text.ts` |
| Checklist and two-client harness | `src/checklist/`, `src/App.svelte` |
| Swift oracle | `fixtures/operations.json` |

`<Slop>`, native code, real sharing, persistence/locks, managed file edits, compression, and production migration are deliberately deferred. Graduate the useful pieces into existing packages and remove this experiment; do not maintain a second app.

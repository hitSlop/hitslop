# @hitslop/runtime

Framework-neutral browser bridge and command/snapshot controller for hitSlop.

List inserts generate the schema's declared identity when it is omitted:

```ts
const result = await checklist.insert(fields.tasks, {
  text, done: false, archived: false,
});
if (result.ok) console.log(result.id);
```

An explicit identity is preserved for imports and undo. Other item fields remain
required. Generation happens once before queuing; retries reuse the original command.
`tx.insert()` returns the reserved ID synchronously so later commands in the same
transaction can address it. The transaction result determines whether it committed.

Successful nonempty mutations expose `result.undo()` and `result.canUndo` after
checking `result.ok`. Undo restores the authority's previous data only while this
command is the latest revision; any later commit expires it, including typing or
another window's edit. Local drafts and pending writers flush before undo, so they
may expire it too. Use `canUndo` to disable a toast action; the authority checks
again when executing. Empty transactions have no undo. Undo returns the usual
`{ ok, revision }` / failure result and does not offer redo or a history stack.

`newId()` is also exported for callers that need an identity before insertion.
It produces a lowercase UUID v4 synchronously using secure browser randomness,
without a host call, and throws if secure randomness is unavailable.

`@hitslop/runtime/adapter` exports `createDocumentController`. It owns typed
commands, serial requests, immutable confirmed data, authority handoffs, exact
retry and the close/export flush barrier. Framework adapters register local text
drafts; Swift or the room owns authoritative validation and durable commits.

The host API is `slop.document.open/send/flush/subscribe/onConnection` with an
optional explicit `onHandoff`. On the native wire, send maps to
`document.execute`. Media and window APIs remain on `slop.media` and
`slop.window`. Missing native capability is an error; `slop dev` explicitly
installs a disposable in-memory authority using the same TypeScript interpreter.

See [Storage](../../docs/storage.md) and [Command protocol](../../docs/command-snapshot.md).

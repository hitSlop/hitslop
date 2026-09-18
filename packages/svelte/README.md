# @hitslop/svelte

Svelte 5.57+ authoring for host-owned documents and media.

```svelte
<script lang="ts">
  import { Slop, createDocument } from "@hitslop/svelte";
  import schema from "../schema";
  import initial from "../initial";
  const document = createDocument({ schema, initial });
  const { fields } = document;
</script>

<Slop document={document}>
  <button disabled={!document.canWrite} onclick={() => document.increment(fields.count)}>
    {document.data.count}
  </button>
  <input readonly={!document.canWrite} {@attach document.text(fields.title)} />
</Slop>
```

Create the document during component initialization. It owns readiness after the first
open attempt, typing drafts, the native flush barrier, and teardown. `<Slop>` uses
that document to provide loading semantics, typed context, capture views, and host
error reporting. Keep application helpers and derived values in the same component;
an extra Board component is unnecessary. One mounted wrapper has one stable document.

Read frozen `data` through ordinary Svelte expressions and `$derived`. Writes use
explicit verbs and `document.fields`; fields never contain live writers.
`transaction(tx => ...)` records synchronous commands that validate and commit
atomically, publishing one revision for an accepted nonempty transaction. Use only
`tx` methods inside it. It does not expose an evolving draft for reads. Writes
resolve to `{ ok: true, revision }` or `{ ok: false, error }`; success notices,
composer clearing, and undo setup belong after `result.ok`.

`insert(fields.tasks, { text, done: false })` fills the list's declared identity
when omitted. Its successful result also includes `id`. Explicit identities are
preserved; other required properties and identity constraints still validate.
Inside a transaction, `const id = tx.insert(...)` reserves the identity for later
commands in that batch. Only the transaction's successful result confirms the insert.
The SDK generates the identity before queuing and preserves it across retries.

Successful nonempty mutations expose `result.undo()` and `result.canUndo` after
checking `result.ok`. Undo restores the authority's previous data only while this
command is the latest revision; any later commit expires it, including typing or
another window's edit. Local drafts and pending writers flush before undo, so they
may expire it too. Use `canUndo` to disable a toast action; the authority checks
again when executing. Empty transactions have no undo. Undo returns the usual
`{ ok, revision }` / failure result and does not offer redo or a history stack.

Text attachments keep local drafts during focus, IME, and debounce. They preserve
selection across ordinary acknowledgements and retain failed or deleted-row edits
for host recovery. `isPending(path)` reports commands queued or in flight for that
field/item, including overlapping ancestor writes, without disabling sibling rows.
`canWrite` remains false while disconnected, loading, or resolving an unknown outcome.

`<Slop>` reports rendering errors and document/media failures to the host. Expected
command rejection does not destroy the editor or block close. Native recovery can
retry retained edits, copy text, explicitly discard drafts, or reset a failed render
without recreating the document. The preview host displays diagnostics locally.
Nested components can call `useSlop(schema)` to retrieve the matching document; a
foreign schema is rejected. Render boundaries do not catch async event-handler
errors, so the host also listens for unhandled errors and rejections.

Lists have `.item(id)` or `.item(row)`; records have `.at(key)`; atomic arrays have
no item address. `set`, `unset`, `toggle`, `increment`, `insert`, `remove`, `move`,
and shallow `patch` retain mutation intent. `S.paths(schema)` remains available
for standalone tooling. There is no writable document proxy.

Use optional `S.Media()` fields with `imageStore(document, fields.photo, { fallback: "" })`
or `fileStore(document, fields.attachment)`. Render the adapter's `src`; `choose()`,
`replace(file)`, `clear()`, and `reload()` handle host-owned bytes. Failures reach the
same host reporting path. Imports finish before document teardown. References sync;
immutable bytes live under their SHA-256 digest. Clearing removes the reference,
not the blob. Downloads are public to anyone holding the hash.

## Capture views

```svelte
<Slop document={checklist}>
  <main><!-- editor --></main>
  {#snippet icon()}<Icon completed={finished} total={visible.length} />{/snippet}
  {#snippet exportView()}<Export checklist={checklist.data} view={activeView} />{/snippet}
</Slop>
```

Capture snippets share the same snapshot and ordinary presentation components.
`icon` supplies a transparent 512×512 target; `exportView` supplies the preview and
PNG/PDF target. They mount only for capture. Keep exports in normal document flow,
with settled values and no editing controls or nested scrollers. Without an export
snippet, capture uses the editor with `data-slop-export="hide"` controls omitted.
`IconTarget` and `ExportTarget` remain available as standalone capture primitives.

See [Capture](../../docs/capture.md), [Storage](../../docs/storage.md), and
[Authoring](../../docs/authoring.md) for the complete host contracts.

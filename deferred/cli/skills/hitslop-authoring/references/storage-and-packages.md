# Storage and package boundary

Use no persistence for a pure calculation. Use JSON for structured data.
Declare optional `S.Media()` fields for attachments and create
`imageStore(document, fields.photo, { fallback: "" })` or
`fileStore(document, fields.attachment)`. These references sync with the document;
bytes live in immutable `stores/media/<sha256>` files. Media downloads are public
to anyone holding the hash.

JSON uses command/snapshot sync: Swift owns local SQLite; the room owns shared JSON.
`data` is confirmed read-only data. Destructure `fields` from the document store and use store
verbs, `transaction(tx => ...)` for batches, and `{@attach store.text(path)}` for text fields.
`createDocument` owns readiness and teardown. `<Slop document={store}>` unifies host
error reporting, loading semantics, context, and capture snippets without an extra
app component. Shared offline mode is read-only. Root `initial.ts` supplies explicit defaults.
Root `schema.ts` authors the TypeBox data shape. Svelte stores import its
default export directly and infer data types through
`createDocument({ schema, initial })`. List inserts generate their declared identity
when omitted; supplied IDs are preserved for imports and undo. Successful inserts
return `id` alongside the revision. `tx.insert()` reserves an ID synchronously for
later commands in its batch; the transaction result confirms whether it committed.
Successful nonempty mutations provide `undo()` and reactive `canUndo` for action toasts.
Undo requires that command to remain the latest revision; any subsequent commit
expires it. Keep native text undo; do not implement inverse commands or a history stack.
Validation checks values without
coercion, defaults, or field removal. Quick Checklist and the CLI counter starter use this workflow;
archived examples remain deferred. The media adapter imports bytes through the
host before setting the reference; clearing unsets the reference without deleting
the blob. Never mutate a digest-named file.

A template contains immutable `manifest.json`, generated `app.html`, optional
`data.schema.json`, optional immutable `.agents/skills/hitslop-document` guidance,
optional `assets/`, and capture images when registered/published. A writable document may lazily add `state/document.sqlite`, the `$slop` envelope in `stores/data.json`,
`stores/media/`, and `stores/theme.css`.
The macOS host may add Finder `Icon\r` metadata locally.

The builder supplies current guidance, but hosts must not require its presence
or compare it with their own copy. Quick Checklist and the CLI starter use single-source
`theme.ts`; archived examples return one at a time.

Never ship source, `node_modules`, `.hitslop`, `dist` nesting, authoring skills,
`style.css`, `document.json`, seed stores, unsupported stores, env files, keys,
or Finder metadata in a template or published artifact.

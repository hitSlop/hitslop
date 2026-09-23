---
name: hitslop-authoring
description: Create, preview, validate, build, and register hitSlop authoring projects with the TypeScript CLI. Use for manifests, storage choices, package boundaries, capture, identity, and release workflow.
---

# Author local v1 mini apps

Do not display “Saved,” “Saving…,” or routine persistence indicators inside authored slops. The native host owns save-failure and retry UI. Use task-specific feedback for explicit operations, such as “Importing skin…” or “Skin applied.”

Read manifest.json first; only runtime hitslop-v1 is supported. Use schema.ts with defineDocument/s from @hitslop/document, explicit initial.ts, and theme.ts. Pick schema builders by merge behavior: s.text for typed text, s.richtext({mark: expand}) for styled text, s.string/number/integer/boolean/enum scalars (last writer wins, optional bounds), s.object, s.list(s.object) for rows with $id identity, s.list(scalar) for plain sequences, s.record(value) for string-keyed values, s.counter for tallies, s.tree(s.object) for hierarchy, s.optional(node) for absent values. Move items between groups with an enum field, not separate lists. Keep transient view state in $state.
App components call `const doc = useDocument(schema)`: read immutable doc.current and write typed handles only: doc.at(row).done.set(true), doc.fields.items.insert(...), doc.change(tx => { tx.at(row)... }, { message }) for one all-or-nothing commit. at() keeps the schema type and requires the original snapshot object, not a clone. bindText binds Unicode text inputs; bindValue previews range drags and commits on change to start autosave. handle.preview(v) shows gesture values without history; set commits. flush is the durability barrier.

Initialize absent optional composites with set and record entries with put. Existing row lists and trees cannot be replaced, including through a containing object assignment: use insert/remove/move, or explicitly clear/delete before recreating new identities. Scalar lists use an empty list instead of optionality. Checkpoints retain history; automatic history pruning is deferred.

The host supplies the document SDK and Loro runtime. Do not embed the engine into app bundles or expose a second JSON writer. Build emits state.schema.json (a descriptor), initial.json, app.html, assets and document guidance. Never include state/, stores/, source, dependencies or caches in templates.

Start anywhere with `bunx @hitslop/cli init NAME`, then `cd NAME` and `bun install`. Use the generated `bun run check/dev/build/register` scripts. Bun is the only JavaScript runtime required; build/register need the compatible installed hitSlop Mac app, not Swift or Xcode. Preview state is disposable; rerun dev to rebuild source. Create a writable copy of a built/registered template before editing. Agents use schema/get/apply/batch/compact. Pre-v1 documents are rejected without migration; preserve supported v1 contracts.

Quick Checklist and Small Expenses are current examples; additional projects are discovered under examples/slops and bundled selection lives in bundled.json. Use plain CSS and defineTheme tokens and each app's own visual identity. Read the bundled hitslop-design references for CSS, presentation, and capture. PNG/PDF export is supported; hosted publishing and catalog are deferred.

Use `<Slop document={doc}>` from `@hitslop/document/svelte`; optional inline exportView and icon snippets mount only during capture. Keep markup together in App.svelte unless a separate component helps. Build/register generate Quick Look artwork through the native helper, without bundling Loro. Register backs up and replaces an existing stateless master only after a successful complete build.

Read [the workflow](references/workflow.md) and [package boundaries](references/storage-and-packages.md) for the complete source-to-document path.

Use `attachments` from `@hitslop/document/attachments` for portable binary files.
`attachments.import(file, { commit(ref) { doc.change(tx => { /* typed fields */ }) } })`
saves bytes before the reference and joins document flush/retry. `read(id)` returns
a Blob; `list()` returns IDs and sizes. References are ordinary schema scalars,
never base64 document values. Validate app formats first. Limits: 10 MiB/file,
100 MiB and 256 files/document. HTTPS data/media requests are allowed; CORS applies.

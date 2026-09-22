---
name: hitslop-authoring
description: Create, preview, validate, build, and register hitSlop authoring projects with the TypeScript CLI. Use for manifests, storage choices, package boundaries, capture, identity, and release workflow.
---

# Author local v1 mini apps

Read manifest.json first; only runtime hitslop-v1 is supported. Use schema.ts with defineDocument/s from @hitslop/document, explicit initial.ts, and theme.ts. App components use useDocument and bindText; read immutable current and write typed handles. transaction(tx => ...) is synchronous and atomic; flush is the durability barrier.

The host supplies the document SDK and Loro runtime. Do not embed the engine into app bundles or expose a second JSON writer. Build emits state.schema.json (a descriptor), initial.json, app.html, assets and document guidance. Never include state/, stores/, source, dependencies or caches in templates.

Start anywhere with `bunx @hitslop/cli init NAME`, then `cd NAME` and `bun install`. Use the generated `bun run check/dev/build/register` scripts. Bun is the only JavaScript runtime required; build/register need the compatible installed hitSlop Mac app, not Swift or Xcode. Preview state is disposable; rerun dev to rebuild source. Create a writable copy of a built/registered template before editing. Agents use schema/get/apply/batch/compact. Pre-v1 documents are rejected without migration; preserve supported v1 contracts.

Quick Checklist and Small Expenses are current examples; additional projects are discovered under examples/slops and bundled selection lives in bundled.json. Use plain CSS and defineTheme tokens and each app's own visual identity. Read the bundled hitslop-design references for CSS, presentation, and capture. PNG/PDF export is supported; hosted publishing and catalog are deferred.

Use `<Slop {document}>` from `@hitslop/document/svelte`; optional inline exportView and icon snippets mount only during capture. Keep markup together in App.svelte unless a separate component helps. Build/register generate Quick Look artwork through the native helper, without bundling Loro. Register backs up and replaces an existing stateless master only after a successful complete build.

Read [the workflow](references/workflow.md) and [package boundaries](references/storage-and-packages.md) for the complete source-to-document path.

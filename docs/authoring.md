# Authoring a slop

The supported v1 path is Bun + Svelte 5. The runtime format is framework-neutral,
with the React adapter archived while supported authoring focuses on Svelte.

## Create and preview

```sh
bunx @hitslop/cli init tiny-counter
cd tiny-counter
bun install
bun run dev
```

The generated scripts wrap `slop dev`, `validate`, `build`, `register`, and
`publish`. New projects start with Svelte 5, Bits UI, a TypeBox-backed JSON store,
and Vanilla Extract for structural styles.
Use `--template svelte` for a blank base or `--template svelte-counter` for
the teaching example. Edit `manifest.json` before the interface: it fixes the
job, author attribution, title, categories, and initial viewport. Interactive
init prompts for the required author name and optional public URL. In CI, pass
`--yes --author-name "Your Name"` and optionally `--author-url https://example.com`.

Development uses a disposable in-memory host fake. State lasts until the page
reloads; SQLite and named media are forgiving UI-only stubs. Register a local
master and open a writable document to test persistence, external edits, or native window behavior.

## Choose data deliberately

- Start with no persistence for a pure utility.
- Use one JSON object for settings or a compact document model.
- Use SQLite for collections, filtering, ordering, or transactional updates.
- Use named media for a known image/file role.

Storage is implicit; do not add declarations to the manifest. See
[Storage](storage.md) for concurrency and copy semantics.

Quick Checklist's current JSON-store contract uses a root `schema.ts` that
default-exports a TypeBox schema (`import * as Type from "typebox"`).
Import that schema directly where the store is created:

```ts
import dataSchema from "../schema";

const document = jsonStore({
  schema: dataSchema,
  initial: { count: 0 },
});
```

## Build

Editor types and typechecking need no generated files or running dev server.
The store uses TypeBox runtime validation without coercion, defaults, or field
removal. The builder evaluates `schema.ts` separately to emit `data.schema.json`;
keep schemas deterministic (no time, randomness, or environment-dependent shapes).
The CLI counter starter uses the same workflow; backlog examples remain deferred.

```sh
bun run validate
bun run build
```

The build bundles the web app into generated `app.html`, copies allowed
immutable assets, generates `data.schema.json` when `schema.ts` is present,
and embeds the canonical `hitslop-document` Agent Skill. If root
`document-guide.md` exists, the builder validates it as UTF-8 Markdown no larger
than 32 KiB and includes it as the skill's one app-specific reference. The
result is written to `dist/<slug>.slop`; it must be source-free and store-free.

Keep stable public theme defaults in `assets/theme.css` as one `:root` block of
`--slop-*` variables. Vanilla Extract consumes those variables through a global
theme contract and emits ordinary structural CSS into `app.html`. This gives
authors type-checked token names while keeping document overrides plain CSS and
framework-neutral.

## Preview and icon

`register` and `publish` use the native renderer to capture a full preview and
produce an exact 512×512 icon. A dedicated icon DOM target gives the best
result. Use optional Svelte `IconTarget` and `ExportTarget` helpers; see
[Capture views](capture.md).

For CI or exceptional artwork, pass `--preview <png>` and/or
`--icon <png>`. These flags replace capture inputs; they do not relax PNG
or package validation.

## Install and test a real document

```sh
bun run register
```

This writes the immutable master to
`~/.hitslop/templates/<slug>.slop`. Create a writable document through **My
Templates** or open the master and choose a destination. Test persistence in the
copy, then confirm reopening, duplicating, preview, PNG/PDF export, and Finder
icon behavior.

Validate or export a built document directly:

```sh
slop validate path/to/document.slop
slop export path/to/document.slop --format png --output document.png
slop screenshot path/to/document.slop --target preview --output Preview.png
```

## Publish

```sh
slop identity show
bun run publish
```

The CLI creates a local Ed25519 identity if needed, builds and captures one
immutable artifact, signs its hash/size envelope, and sends it to the configured
gateway. The key proves publisher ownership; public author attribution comes
from the signed `manifest.json`. Export an encrypted identity backup with
`slop identity export`.

The default endpoint is the official catalog. Use `--registry` or
`HITSLOP_REGISTRY_URL` for a self-hosted endpoint.

## Definition of done

The app has one obvious purpose; keyboard/focus/reduced-motion behavior works;
persistent initial values conform to the app's data schema; standard resizing or skin
hit-testing is tested; static capture has no editing controls; generated output
contains only allowed runtime files; and `bun run release:check` passes in this
repository.

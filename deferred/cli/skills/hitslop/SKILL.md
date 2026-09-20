---
name: hitslop
description: Create, fill, open, and export useful hitSlop documents, or build a new mini app when no template fits.
---

# Make a hitSlop document

Inside the repository use `bun slop`; elsewhere use `slop` or `bunx @hitslop/cli`.
Native creation, opening, and export require the current Mac app and helper.
`HITSLOP_NATIVE_CLI` selects a development helper.

## Find or build

1. Search `slop catalog search "<purpose>" --json`; inspect the results.
   A failed or incomplete listing does not prove no template exists.
2. Create a writable copy with `slop create <template-id> --output ./Document.slop`.
   Never edit masters under `~/.hitslop/templates`.
3. For a new app, read the sibling `hitslop-authoring/SKILL.md` and
   `hitslop-design/SKILL.md`. Keep editable source separate from built documents.
   Build and validate, then `slop create --from <built-package.slop> --output ./Document.slop`.

## Design principles

Start with the user's single job and realistic content. Make its primary action
and information clear; let each object have its own identity. Preserve an existing
visual direction during refinement. Check readable type, visible keyboard focus,
empty/loading/error states, narrow windows, and complete exports. The design skill
contains the detailed standards; do not add decorative UI at the expense of the task.

## Fill and present

Run `slop inspect ./Document.slop --json` and read its manifest, schema, and embedded
`.agents/skills/hitslop-document/SKILL.md`. Use explicit facts and defaults; never
invent missing user information. Open a new document to initialize its authored data.

JSON edits preserve the exact `$slop` envelope and `baseRevision`; edit only `data`.
Validate against `data.schema.json`, replace `stores/data.json` atomically, and wait
for the host to accept it before another edit. Stale or invalid proposals are retained
for review. Never edit the command database. Local and shared documents use the same
conditional file-editing contract; shared edits require connection.

Attachments are schema-backed media references. Their immutable bytes live under
`stores/media/<sha256>`; never overwrite content under an existing digest or put blob
URLs in JSON. Follow the embedded document guidance for imports.

Use `slop open ./Document.slop`, then `slop export ./Document.slop --format pdf --output
./Document.pdf` or `slop screenshot ./Document.slop --output ./Preview.png`. Inspect
the rendered result. CLI capture reads saved state; finish pending UI edits first.

Built app files are immutable. Layout or behavior changes belong in source, followed
by a rebuild. Publishing is a separate task.

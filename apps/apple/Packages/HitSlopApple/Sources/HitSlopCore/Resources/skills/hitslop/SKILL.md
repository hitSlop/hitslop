---
name: hitslop
description: Create usable local hitSlop documents such as invoices, checklists, and trackers from a template or a new mini app. Use for requests to make, fill out, open, or export these documents.
---

# Make a hitSlop document

Use `slop` (or `bunx @hitslop/cli` when it is not on PATH). Inside the hitSlop
repository use `bun slop`. Native creation, opening, and export require the
current Mac app and its bundled helper; `HITSLOP_NATIVE_CLI` selects a development
helper. `HITSLOP_CATALOG_URL` selects a catalog origin, including local emulators.

## Find or build the app

1. Search with `slop catalog search "invoice" --json`, using a few relevant
   keywords. Inspect titles and descriptions to choose a suitable template.
   `complete: false` means the server supplied a limited listing; a network
   error is not evidence that no template exists.
2. Create a writable document with `slop create <exact-template-id> --output
   ./Invoice.slop --json`. Never edit a master under `~/.hitslop/templates`.
3. When no suitable template is available, read the installed sibling
   `hitslop-authoring/SKILL.md` and `hitslop-design/SKILL.md`. Scaffold, implement,
   validate, and build a source project, then use `slop create --from
   <built-package.slop> --output ./Invoice.slop`. Keep source separate from the
   document. Publishing is a separate task.

## Fill and present the document

Run `slop inspect ./Invoice.slop --json`. Read its manifest, schema, and app
guidance. `dataExists: false` means no data has been saved yet: construct a
complete schema-valid value from the user's request, or open the document to
initialize its authored defaults and inspect again. Do not infer defaults from
JSON Schema or invent missing invoice facts.

For `editing: direct-json`, read the document's embedded
`.agents/skills/hitslop-document/SKILL.md`. Edit `stores/data.json` directly,
preserving unknown fields and existing item IDs. Validate the complete value
against `data.schema.json` before replacing the file atomically with a temporary
sibling. No checkout/apply step is needed. Run `slop validate ./Invoice.slop`.

An open app reloads valid external data; updated runtimes discard pending UI
edits when adopting disk. Simultaneous file writes are last-write-wins, not a
merge. Older compiled templates may retain their original save behavior.
`editing: sync-required` means JSON is a Loro projection: do not edit it through
this workflow. `editing: template` requires creating a writable copy first.

Use `slop open ./Invoice.slop` to show the result. Export saved disk data with
`slop export ./Invoice.slop --format pdf --output ./Invoice.pdf`. PNG export and
`slop screenshot ./Invoice.slop --output ./Preview.png` are also available.
Inspect the rendered result before handing it back. CLI export captures saved
data; it does not flush pending changes in another open window.

App code in a built document is immutable. Change layout or behavior in a source
project with `slop dev`, then rebuild; do not patch generated `app.html`.

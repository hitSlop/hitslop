# Reactive architecture

hitSlop deliberately uses different storage behavior for UI authoring and for a
built document. Browser development is a disposable preview. Durable storage,
external file edits, and native window behavior are tested in a built `.slop`.

## Browser development

`slop dev` starts Vite and injects an in-memory `window.slop` implementation.
It does not create development stores, expose HTTP storage routes, or poll.

- JSON operations retain a cloned value until the page reloads and emit local
  change events immediately.
- SQLite queries return no rows and mutations report zero changes.
- Named media reports missing files and accepts writes as no-op preview events.
- Window resize returns the requested size; window drag is a no-op.

This mode exists to iterate on layout and interaction quickly. Use an installed
writable copy when persistence semantics matter.

## Schemas and builds

An authored project that uses Svelte `jsonStore` has a root `schema.ts` that
default-exports a TypeBox schema. The component imports that same value:

```ts
import dataSchema from "../schema";

const document = jsonStore({
  schema: dataSchema,
  initial: { count: 0 },
});
```

The adapter validates initial, loaded, external, and outgoing values. The CLI
imports root `schema.ts` during a build and emits `data.schema.json`. The
authoring source schema is never copied into the runtime package.

The internal Vite build plugin emits source-free `app.html` and preserves the
generated dependency graph under immutable `assets/`. Authored structural CSS,
including Vanilla Extract output, is inlined with the app. Failed builds retain
the previous successful artifact.

## Themes

Themeable apps keep stable `--slop-*` custom properties in immutable
`assets/theme.css`. The build adds a second stylesheet link for
`stores/theme.css`, served by the native host as `theme.css`. That writable file
contains only owner overrides and loads after the default.

Quick Checklist is the platform pilot. Its root `theme.ts` uses `defineTheme`
to supply typed CSS variable references and generate `assets/theme.css` from
one definition. Native overrides are validated before hot reload. The CLI starter follows the same workflow; other examples remain deferred.

## Package guidance

New builds embed the canonical `.agents/skills/hitslop-document/SKILL.md` so an
agent opening the built document can discover its schema and mutable boundary.
Authors may provide one optional `document-guide.md`; scripts and arbitrary
skill resources do not cross into the runtime package.

## Native external changes

On macOS, one recursive FSEvents stream watches each open `.slop`. Events are
wake-up signals: after a short debounce, the runtime compares canonical JSON,
SQLite, media, and theme revisions and notifies the guest only when a value
actually changed. Theme changes replace the override `<link>` after the new
stylesheet loads, preserving page state.

iOS retains its existing timer fallback for now. Coordinated working copies
flush JSON, SQLite, media, and theme overrides back to the presented document.

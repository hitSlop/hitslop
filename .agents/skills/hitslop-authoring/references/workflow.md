# Authoring workflow

## Commands

Quick Checklist imports root `schema.ts` directly into `jsonStore`.
Editor types and checks work without preparation or a dev server. Builds emit
`data.schema.json` for the host; keep schema definitions deterministic.
The init scaffold remains deferred.

```sh
bunx @hitslop/cli init my-slop
bun run dev
bun run validate
bun run build
bun run register
bun run publish
```

`dev` is a disposable browser UI preview with in-memory JSON and forgiving
SQLite/media stubs. A reload clears preview state. Register a local master and
open a writable copy for real persistence, external-file, and native-window behavior.

`build` emits `dist/<slug>.slop`. Inspect the result. `register` adds an
immutable master under `~/.hitslop/templates`; open it to create a writable
copy and test persistence there.

New builds include the canonical document skill. Add optional app-specific
instructions only in root `document-guide.md`; the build copies it to the
skill's single reference after validating its encoding and size.

## Capture

Call `ready()` after initial data is usable. Prefer optional `IconTarget` and
`ExportTarget` from `@hitslop/svelte`, wrapping ordinary `Icon.svelte` and
`Export.svelte` presentation components. Pass the same data and selected view;
never open a second store. Helpers own mounting, geometry, and capture state.
Export content belongs in normal flow. Without an export target, use the existing
`data-slop-capture="static"` CSS and `data-slop-export="hide"` fallback.

Preview `?capture=icon` and `?capture=export` in the disposable gallery. The
runtime waits for fonts, images, and stable layout. For charts/virtualization,
register `capture.onPrepare(async (mode, signal) => { ... })` and clean up the
returned registration. Background captures use temporary snapshots. Optional
icons refresh Finder metadata on close; `QuickLook/Icon.png` remains immutable.

## Identity and publish

`manifest.json` owns the public author name and optional HTTP(S) author URL.
`slop identity show`, `export`, and `import` manage only the local publisher
key. Never place private identity material in a project. Publish signs one
built/captured artifact; the registry assigns release numbers externally.

## Definition of done

Validate keyboard/focus/reduced motion, long and empty content, persistence
reopen, resize or skin hit testing, static/full-height export, icon
legibility, and the contents of the final runtime package.

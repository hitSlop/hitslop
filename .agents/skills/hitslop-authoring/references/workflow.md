# Authoring workflow

## Commands

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

Call `ready()` after initial durable data and critical assets are usable. Test
the manifest viewport in live and `data-slop-capture="static"` states. Mark
editing controls `data-slop-export="hide"`. Keep output in normal document
flow so full-height PNG/PDF can see it.

An optional renderer-only icon target is a square 512px DOM element. Use
`capture.isRenderer()` so they never mount in the interactive app.

## Identity and publish

`manifest.json` owns the public author name and optional HTTP(S) author URL.
`slop identity show`, `export`, and `import` manage only the local publisher
key. Never place private identity material in a project. Publish signs one
built/captured artifact; the registry assigns release numbers externally.

## Definition of done

Validate keyboard/focus/reduced motion, long and empty content, persistence
reopen, resize or skin hit testing, static/full-height export, icon
legibility, and the contents of the final runtime package.

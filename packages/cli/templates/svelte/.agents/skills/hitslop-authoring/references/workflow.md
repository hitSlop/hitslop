# Authoring workflow

## Commands

```sh
bunx @hitslop/cli init my-slop
bun run dev
bun run validate
bun run build
bun run install
bun run publish
```

`dev` uses isolated `.hitslop/dev/stores/`. Use `slop dev --reset` after an
intentional default/schema reset and `--native` for real host window behavior.

`build` emits `dist/<slug>.slop`. Inspect the result. `install` adds an
immutable master under `~/.hitslop/templates`; open it to create a writable
copy and test persistence there.

## Capture

Call `ready()` after initial durable data and critical assets are usable. Test
the manifest viewport in live and `data-slop-capture="static"` states. Mark
editing controls `data-slop-export="hide"`. Keep output in normal document
flow so full-height PNG/PDF can see it.

An optional renderer-only icon target is a square 512px DOM element. Use
`capture.isRenderer()` so they never mount in the interactive app.

## Identity and publish

`slop identity show`, `set-name`, `export`, and `import` manage the local
publisher key. Never place private identity material in a project. Publish signs
one built/captured artifact; the registry assigns release numbers externally.

## Definition of done

Validate keyboard/focus/reduced motion, long and empty content, persistence
reopen, resize or skin hit testing, static/full-height export, icon
legibility, and the contents of the final runtime package.

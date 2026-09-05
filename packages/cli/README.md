# @hitslop/cli

Create, preview, validate, build, register, and publish local-first `.slop`
apps.

```sh
bunx @hitslop/cli init my-slop
cd my-slop
bun install
bun run check
bun run dev
```

The supported v1 scaffold uses Svelte 5 and includes portable
`hitslop-authoring` and `hitslop-design` skills. Root `schema.ts` uses TypeBox;
root `theme.ts` supplies typed CSS variables and generated default CSS. Editor
inference and `bun run check` need no generated files or running dev server.
Optional icon/export components share the editor's store. `slop build` emits a
source-free runtime package; `slop register` adds an immutable local template;
`slop publish` captures and signs one artifact for the catalog.

Interactive init asks for a required author name and optional URL. For
non-interactive use, pass `--yes --author-name "Your Name"` and optionally
`--author-url https://example.com`.

Documentation: [Authoring](https://github.com/hitslop/hitslop/blob/main/docs/authoring.md) ·
[Package format](https://github.com/hitslop/hitslop/blob/main/docs/package-format.md)

MIT © 2026 hitSlop contributors.

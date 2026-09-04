# @hitslop/cli

Create, preview, validate, build, register, and publish local-first `.slop`
apps.

```sh
bunx @hitslop/cli init my-slop
cd my-slop
bun install
bun run dev
```

The supported v1 scaffold uses Svelte 5 and includes portable
`hitslop-authoring` and `hitslop-design` skills. `slop build` emits a
source-free runtime package; `slop register` adds an immutable local template;
`slop publish` captures and signs one artifact for the catalog.

Interactive init asks for a required author name and optional URL. For
non-interactive use, pass `--yes --author-name "Your Name"` and optionally
`--author-url https://example.com`.

Documentation: [Authoring](https://github.com/hitslop/hitslop/blob/main/docs/authoring.md) ·
[Package format](https://github.com/hitslop/hitslop/blob/main/docs/package-format.md)

MIT © 2026 hitSlop contributors.

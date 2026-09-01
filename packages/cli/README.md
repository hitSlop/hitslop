# @hitslop/cli

Create, preview, validate, build, install, and publish local-first `.slop`
apps.

```sh
bunx @hitslop/cli init my-slop
cd my-slop
bun install
bun run dev
```

The supported v1 scaffold uses Svelte 5 and includes portable
`hitslop-authoring` and `hitslop-design` skills. `slop build` emits a
source-free runtime package; `slop install` adds an immutable local template;
`slop publish` captures and signs one artifact for the catalog.

Documentation: [Authoring](https://github.com/hitslop/hitslop/blob/main/docs/authoring.md) ·
[Package format](https://github.com/hitslop/hitslop/blob/main/docs/package-format.md)

MIT © 2026 hitSlop contributors.

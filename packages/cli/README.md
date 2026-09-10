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

The supported v1 scaffold uses Svelte 5. `init` installs missing skills; `slop skills sync`
explicitly replaces `hitslop-authoring`, `hitslop-design`, and `hitslop-document`
in `~/.hitslop/skills` and links them for coding agents. Existing user directories and
unrelated links are preserved. Skill installation supports macOS and Linux
(system `flock` required) and is optional for project creation. Root `schema.ts` uses TypeBox;
root `theme.ts` supplies typed CSS variables and generated default CSS. Editor
inference and `bun run check` need no generated files or running dev server.
Optional icon/export components share the editor's store. `slop build` emits a
source-free runtime package; `slop register` adds an immutable local template;
`slop publish` captures and signs one artifact for the catalog.

Interactive init asks for a required author name and optional URL. For
non-interactive use, pass `--yes --author-name "Your Name"` and optionally
`--author-url https://example.com`.

Documentation: [Authoring](https://github.com/hitslop/hitslop/blob/master/docs/authoring.md) ·
[Package format](https://github.com/hitslop/hitslop/blob/master/docs/package-format.md)

MIT © 2026 hitSlop contributors.

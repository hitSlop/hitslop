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
explicitly replaces `hitslop`, `hitslop-authoring`, `hitslop-design`, and `hitslop-document`
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

## Use a document

```sh
slop catalog search "invoice" --json
slop create <template-id> --output ./Invoice.slop --json
slop inspect ./Invoice.slop --json
# Edit stores/data.json against the returned schema, replacing it atomically.
slop validate ./Invoice.slop --json
slop open ./Invoice.slop --json
slop export ./Invoice.slop --format pdf --output ./Invoice.pdf --json
```

`create --from <built-package.slop>` also works offline with a local template,
including fresh builds without Quick Look captures. Creation, opening, and
rendering require the current macOS native helper. `HITSLOP_NATIVE_CLI` selects
one explicitly. `HITSLOP_CATALOG_URL` (or `--registry` on search/create) selects
the catalog origin. `HITSLOP_TEMPLATES_ROOT` selects the creation cache root.
Search follows all catalog pages; `complete: false` identifies an older server's
limited response. Update the Firebase API to enable complete pagination.

JSON commands return `{ ok: true, result: ... }` or `{ ok: false, error: { code,
message } }` with nonzero exit status on failure. Progress goes to stderr.
`inspect` reports absent data explicitly (`dataExists: false`); open the document
to initialize authored defaults or supply a complete schema-valid value.

New runtimes prefer valid external file changes over unsaved UI edits. Concurrent
file writes are last-write-wins. Export uses saved disk data. Documents with
`state/checkpoint.loro` require sync-aware editing; do not edit their projections.
Read the installed `hitslop` skill for template selection and authoring fallback.

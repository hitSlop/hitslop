# hitSlop

`.slop` packages are framework-neutral runtime web apps with optional host-owned
JSON, SQLite, named media, and theme override data. Read `manifest.json` first.

- Authored templates live in `examples/slops/`; paused templates live in
  `archive/templates/`. Runtime packages never contain source, dependencies,
  build caches, seed stores, or editable stylesheets.
- Preview with `bun slop dev examples/slops/<id>` and build with
  `bun slop build examples/slops/<id>`.
- Use `_vibe/` as local visual reference material. It is inspiration-only and
  must not be copied into source, runtime packages, or the open-source release.
- A runtime package has `manifest.json`, generated `app.html`, optional immutable
  `assets/`, optional generated `data.schema.json`, the canonical embedded
  `.agents/skills/hitslop-document` skill, optional canonical
  `stores/data.json`, `stores/data.sqlite`, `stores/theme.css`, and user-selected
  supported media under `stores/media/`,
  and optional `QuickLook/Preview.png` and `QuickLook/Icon.png`.
- Manifest storage is implicit. A slop can use JSON, SQLite, named media, or
  any combination. Replace JSON and media atomically and keep SQLite
  transactions on one connection.
- Manifest `author.name` is required and `author.url` may be an HTTP(S) URL.
  Attribution belongs to the signed artifact; the publisher identity is only a
  signing key.
- Browser `slop dev` is a disposable UI preview: no bridge server, disk stores,
  or polling. Test persistence and native behavior in a built writable copy.
- Svelte `jsonStore` requires `{ schema, initial }`. Put the Zod 4 schema in root
  `schema.ts`, default-export it, and attach that same export to the store.
- Treat `manifest.json`, `app.html`, `data.schema.json`, `assets/`, `.agents/`,
  and `QuickLook/Icon.png` as immutable in a document. Never add `style.css`,
  `document.json`, or a build directory. The macOS host may add the
  Finder-managed `Icon\r` metadata file to local documents; templates and
  published artifacts must not contain it.
- Reusable TypeScript lives in `packages/`. Apple Swift products live in the
  app-local `apps/apple/Packages/HitSlopApple` package; AppKit code remains in
  its macOS-only Host, Catalog, and NativeCLI targets.
- macOS uses built-in package Quick Look for previews and derives each local
  document's Finder custom icon from its immutable `QuickLook/Icon.png`.
- Catalog selection caches immutable artifacts at
  `~/.hitslop/templates/cache/<publisher>/<slug>/<release>.slop`, verifies
  SHA-256, and copies one to the user-selected path. Local `slop register`
  writes `~/.hitslop/templates/<slug>.slop`. Anything under
  `~/.hitslop/templates` is a catalog master, never a writable document.
  Firebase stores only public catalog metadata and immutable published artifacts;
  it never stores a local document.
- Zod is authoritative. Run `bun run schema:generate` after schema changes;
  JSON Schema then generates the Swift types and validates Swift manifests.

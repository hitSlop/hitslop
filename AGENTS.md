# hitSlop

`.slop` packages are framework-neutral runtime web apps with optional host-owned
JSON, SQLite, and named media data. Read `manifest.json` first.

- Authored templates live in `examples/slops/`; paused templates live in
  `archive/templates/`. Runtime packages never contain source, dependencies,
  build caches, seed stores, or editable stylesheets.
- Preview with `bun slop dev examples/slops/<id>` and build with
  `bun slop build examples/slops/<id>`.
- A runtime package has `manifest.json`, generated `app.html`, optional immutable
  `assets/`, optional canonical `stores/data.json`, `stores/data.sqlite`, and
  user-selected images under `stores/media/`,
  and optional `QuickLook/Preview.png` and `QuickLook/Thumbnail.png`.
- Manifest storage is implicit. A slop can use JSON, SQLite, named images, or
  any combination. Replace JSON and media atomically and keep SQLite
  transactions on one connection.
- Treat `manifest.json`, `app.html`, `assets/`, and `QuickLook/Thumbnail.png` as
  immutable in a document. Never add `style.css`, `document.json`, or a build
  directory. The macOS host may add the Finder-managed `Icon\r` metadata file
  to local documents; templates and published artifacts must not contain it.
- Reusable TypeScript lives in `packages/`. Apple Swift products live in the
  app-local `apps/apple/Packages/HitSlopApple` package; AppKit code remains in
  its macOS-only Host, Catalog, and NativeCLI targets.
- macOS uses built-in package Quick Look for previews and derives each local
  document's Finder custom icon from its immutable `QuickLook/Thumbnail.png`.
- Catalog selection caches immutable artifacts at
  `~/.hitslop/templates/cache/<publisher>/<slug>/<release>.slop`, verifies
  SHA-256, and copies one to the user-selected path. Convex never stores a local
  document.
- Zod is authoritative. Run `bun run schema:generate` after schema changes;
  JSON Schema then generates the Swift types and validates Swift manifests.

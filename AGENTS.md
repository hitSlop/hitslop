# hitSlop

`.slop` packages are framework-neutral runtime web apps with optional host-owned
JSON, named media, and theme override data. Read `manifest.json` first.

- Active authored templates live in `examples/slops/`; paused examples live in
  `examples/slops/_backlog/` and older templates in `archive/templates/`.
  Backlog source is excluded from gallery discovery, builds, tests, and checks.
  Runtime packages never contain source, dependencies,
  build caches, seed stores, or editable stylesheets.
- Preview with `bun slop dev examples/slops/<id>` and build with
  `bun slop build examples/slops/<id>`.
- For work tracked by `SLOPMIGRATION.md`, read and follow
  `SLOPMIGRATIONRUNNER.md` before editing a slop.
- Use `_vibe/` as local visual reference material. It is inspiration-only and
  must not be copied into source, runtime packages, or the open-source release.
- A runtime package has `manifest.json`, generated `app.html`, optional immutable
  `assets/`, optional generated `data.schema.json`, the canonical embedded
  `.agents/skills/hitslop-document` skill, optional canonical
  `stores/data.json`, `stores/theme.css`, and user-selected
  supported media under `stores/media/`,
  and optional `QuickLook/Preview.png` and `QuickLook/Icon.png`.
- Manifest storage is implicit. A slop can use JSON, named media, either, or
  neither. Replace JSON and media atomically.
- Manifest `author.name` is required and `author.url` may be an HTTP(S) URL.
  Attribution belongs to the signed artifact; the publisher identity is only a
  signing key.
- Browser previews are disposable: no bridge server, disk stores, or polling.
  Routine migrations use the shared gallery for UI smoke tests; persistence and
  native behavior are reserved for explicit release-gate work.
- Author JSON schemas with `import * as Type from "typebox"` in root `schema.ts`.
  Import that schema directly into `jsonStore({ schema, initial })`.
  Types are inferred from the schema; the store uses TypeBox runtime validation.
  No generated files or dev server are needed for editor types. Schemas must be
  deterministic because the app and package builder evaluate them separately.
  Validation never coerces, inserts defaults, or strips fields. Use explicit
  initial values and `additionalProperties: true` to preserve unknown fields.
  Quick Checklist and the CLI counter starter use this workflow; backlog examples remain deferred.
- Quick Checklist is the platform pilot. Define its theme once in root
  `theme.ts` with `defineTheme` from `@hitslop/runtime/theme`; builds generate
  immutable `assets/theme.css`. Keep owner overrides in `stores/theme.css`.
- Builds embed document guidance, but opening a document never depends on its
  exact text or presence. Do not make optional guidance a runtime prerequisite.
- The bridge contract lives in `packages/schema/src/bridge.ts`. Generate its
  native resources with `bun run schema:generate`; do not edit generated code.
- Treat `manifest.json`, `app.html`, `data.schema.json`, `assets/`, `.agents/`,
  and `QuickLook/Icon.png` as immutable in a document. Never add `style.css`,
  `document.json`, or a build directory. The macOS host may add the
  Finder-managed `Icon\r` metadata file to local documents; templates and
  published artifacts must not contain it.
- Reusable TypeScript lives in `packages/`. Apple Swift products live in the
  app-local `apps/apple/Packages/HitSlopApple` package; AppKit code remains in
  its macOS-only Host, Catalog, and NativeCLI targets.
- macOS uses built-in package Quick Look for previews and derives each local
  document's initial Finder custom icon from immutable `QuickLook/Icon.png`.
  Optional authored icon targets refresh Finder metadata on close. Background
  capture uses disposable snapshots; dedicated Svelte export/icon views share
  data with the editor through `ExportTarget` and `IconTarget`.
- Catalog selection caches immutable artifacts at
  `~/.hitslop/templates/cache/<publisher>/<slug>/<release>.slop`, verifies
  SHA-256, and copies one to the user-selected path. Local `slop register`
  writes `~/.hitslop/templates/<slug>.slop`. Anything under
  `~/.hitslop/templates` is a catalog master, never a writable document.
  Firebase stores only public catalog metadata and immutable published artifacts;
  it never stores a local document.
- TypeBox is authoritative. Run `bun run schema:generate` after schema changes;
  JSON Schema then generates the Swift types and validates Swift manifests.

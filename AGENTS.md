# hitSlop

`.slop` packages are runtime web apps with host-owned JSON or SQLite. Read `manifest.json` first and edit only `style.css`, assets, or stores declared in `stores`.

- Authored Svelte templates live under `Templates/`, never inside runtime `.slop` packages.
- Preview source with `slop dev Templates/<id>` and release all templates with `slop package-templates`.
- JSON stores are ordinary UTF-8 JSON files and should be replaced atomically.
- SQLite stores can be inspected with `sqlite3`; copy documents through `SlopDuplicator` so its read-only online snapshot includes committed WAL data without mutating bundled templates.
- Never add `source/`, package manifests, `.build`, `node_modules`, or package checkouts to a runtime document. Treat `build/index.html` as generated.

Reusable code lives in `Packages/*/Package.swift` and `sdk/`. The Xcode project is only a thin macOS app and Quick Look bundle layer.

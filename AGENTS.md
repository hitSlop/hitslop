# hitSlop

`.slop` packages are editable web apps with host-owned JSON or SQLite. Read `manifest.json` first, keep authored files under `source/`, and edit only stores declared in `stores`.

- Svelte/TS/CSS changes rebuild with `slop build <doc.slop>` or `node sdk/bin/slop.mjs build <doc.slop>` (writes `build/index.html`).
- JSON stores are ordinary UTF-8 JSON files and should be replaced atomically.
- SQLite stores can be inspected with `sqlite3`; copy documents through `SlopDuplicator` so its read-only online snapshot includes committed WAL data without mutating bundled templates.
- Never add `.build`, `node_modules`, package checkouts, or compiler output other than `build/index.html` to a document.

Reusable code lives in `Packages/*/Package.swift` and `sdk/`. The Xcode project is only a thin macOS app and Quick Look bundle layer.

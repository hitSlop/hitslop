# hitSlop

`.slop` packages are editable ElementaryUI WebAssembly apps. Read `manifest.json` first, edit files declared under `source`, and edit only stores declared in `stores`.

- Swift/CSS changes require a compiler rebuild of `build/app.wasm`.
- JSON stores are ordinary UTF-8 JSON files and should be replaced atomically.
- SQLite stores can be inspected with `sqlite3`; copy documents through `SlopDuplicator` so its read-only online snapshot includes committed WAL data without mutating bundled templates.
- Never add `.build`, `node_modules`, package checkouts, or compiler output other than `build/app.wasm` to a document.
- Documents do not supply `@main`; the compiler injects `GeneratedApp.swift` and mounts `ContentView`.

Reusable code lives in `Packages/*/Package.swift`. The Xcode project is only a thin macOS app and Quick Look bundle layer.

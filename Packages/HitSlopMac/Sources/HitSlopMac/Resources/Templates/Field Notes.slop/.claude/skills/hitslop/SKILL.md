---
name: hitslop
description: Edit, theme, validate, duplicate, and export this ElementaryUI WebAssembly .slop package.
---

# Field Notes

Read `manifest.json` first.

- Edit only files declared under `source` and stores declared in `stores`.
- Edit `theme.css` for live styling without rebuilding Wasm.
- ElementaryFlow is available for Swift layout and state styles. Keep `--slop-*` tokens and semantic classes as the public theme API; never target private `_e*` classes or inline `--e-*` variables.
- Swift or `source/styles.css` changes require rebuilding `build/app.wasm`.
- Replace JSON atomically; use `sqlite3` only for declared SQLite stores.
- Duplicate with `slop duplicate` so committed WAL data is included.
- Never add `.build`, `node_modules`, package checkouts, or compiler output other than `build/app.wasm`.

Commands: `slop validate .`, `slop duplicate . ../Copy.slop`, and `slop export . --format png|pdf`.

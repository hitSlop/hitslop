---
name: hitslop
description: Edit, theme, validate, duplicate, and export this ElementaryUI WebAssembly .slop package.
---

# {{TITLE}}

This directory is a first-release hitSlop package. Read `manifest.json` before changing anything.

## Package rules

- Edit Swift and CSS only when they are declared under `source` in the manifest.
- Swift or `source/styles.css` changes require rebuilding `build/app.wasm` with the hitSlop compiler.
- Edit `theme.css` for live appearance overrides. It hot-reloads without rebuilding Wasm.
- Only edit JSON or SQLite files declared in `stores`.
- Replace JSON atomically and keep it valid UTF-8 JSON.
- Use `sqlite3` for SQLite stores. Use `slop duplicate` when copying a live document so committed WAL data is preserved.
- Do not add `.build`, `node_modules`, package checkouts, or compiler output other than `build/app.wasm`.
- Documents do not provide `@main`; the compiler injects `GeneratedApp.swift` and mounts `ContentView`.

## Declared stores

{{STORE_GUIDE}}

## Commands

```sh
slop validate .
slop duplicate . ../"{{TITLE}} copy.slop"
slop open .
slop export . --format png --output ../"{{TITLE}}.png"
slop export . --format pdf --output ../"{{TITLE}}.pdf"
```

## Styling

The host loads its semantic baseline, ElementaryFlow's static CSS, `source/styles.css`, then `theme.css`. Prefer the stable `--slop-*` custom properties and the document's semantic class names. Never target ElementaryFlow's private `_e*` classes or override its inline `--e-*` implementation variables. Remote imports are blocked; package assets belong under `assets/`.

ElementaryFlow is available to Swift sources for type-checked layout and interaction styles. Themeable Flow values should reference `var(--slop-*)`; keep component defaults in `source/styles.css` and live user overrides in `theme.css`.

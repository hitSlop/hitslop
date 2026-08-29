---
name: hitslop
description: Edit data and document-local CSS in this runtime .slop package.
---

# {{TITLE}}

This directory is a hitSlop package. Read `manifest.json` before changing anything.

## Package rules

- This package intentionally contains no Svelte source or build dependencies.
- Treat `build/index.html` as generated and read-only.
- Edit `style.css` for live document-local overrides. It hot-reloads without rebuilding.
- Only edit JSON or SQLite files declared in `stores`.
- Replace JSON atomically and keep it valid UTF-8 JSON.
- Use `sqlite3` for SQLite stores. Use `slop duplicate` when copying a live document so committed WAL data is preserved.
- Do not add `source/`, `.build`, `node_modules`, package checkouts, or package manifests.

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

The host loads its minimal baseline, the cartridge's compiled styles, then `style.css`. Override the document's own selectors and custom properties; there is no global theme contract. Remote imports remain blocked and live package assets belong under `assets/`.

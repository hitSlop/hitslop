---
name: hitslop
description: Edit, theme, validate, duplicate, and export this Svelte .slop package.
---

# {{TITLE}}

This directory is a hitSlop package. Read `manifest.json` before changing anything.

## Package rules

- Keep all authored web source under `source/`; every regular file there participates in the source hash.
- Source changes require `slop build`, which writes `build/index.html`.
- Edit `theme.css` for live appearance overrides. It hot-reloads without rebuilding.
- Only edit JSON or SQLite files declared in `stores`.
- Replace JSON atomically and keep it valid UTF-8 JSON.
- Use `sqlite3` for SQLite stores. Use `slop duplicate` when copying a live document so committed WAL data is preserved.
- Do not add `.build`, `node_modules`, package checkouts, or compiler output other than `build/index.html`.

## Declared stores

{{STORE_GUIDE}}

## Commands

```sh
slop validate .
slop build .
slop duplicate . ../"{{TITLE}} copy.slop"
slop open .
slop export . --format png --output ../"{{TITLE}}.png"
slop export . --format pdf --output ../"{{TITLE}}.pdf"
```

## Styling

The host loads its semantic baseline, then the document's inlined source styles, then `theme.css`. Prefer the stable `--slop-*` custom properties and the document's semantic class names. Remote imports are blocked; live package assets belong under `assets/`.

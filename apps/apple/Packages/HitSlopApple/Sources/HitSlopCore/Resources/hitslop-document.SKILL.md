---
name: hitslop-document
description: Safely inspect, edit, validate, and export a built hitSlop .slop document. Use when changing its JSON data, SQLite records, named media, or theme overrides.
metadata:
  hitslop-skill-version: "1"
---

# Work with this hitSlop document

Read `manifest.json` first. This directory is a built, framework-neutral web
document, not a source project. If `references/app-guide.md` exists, read it
for app-specific data and styling guidance.

## Inspect

- Read `data.schema.json` when present before changing `stores/data.json`.
- Treat `manifest.json`, `app.html`, `data.schema.json`, `assets/`, this
  skill, and `QuickLook/Icon.png` as immutable application files.
- User data belongs only in `stores/`. `QuickLook/Preview.png` may be
  refreshed by the host. `Icon\r` is Finder metadata, not document content.

## Edit data safely

- For JSON, validate the complete value against the schema, write a temporary
  sibling file, then atomically replace `stores/data.json`.
- For SQLite, use one connection for each transaction. Do not copy or directly
  edit `data.sqlite-wal` or `data.sqlite-shm`.
- Named attachments belong in `stores/media/`. Names start with a lowercase
  ASCII letter and contain only lowercase letters, digits, and hyphens. Replace
  a media file atomically; use only supported image or bounded ZIP content.

## Edit the theme

The immutable defaults are in `assets/theme.css`. To customize appearance,
write `stores/theme.css` with one `:root` rule that overrides only existing
`--slop-*` variables. Do not add selectors, layout rules, or new variables.

## Check and export

Run `slop validate .` after edits. Use
`slop export . --format png|pdf --output <path>` for the full document and
`slop screenshot . --target preview|icon --output <path>` for render targets.

---
name: hitslop-authoring
description: Create, preview, validate, build, install, or publish hitSlop authoring projects with the TypeScript CLI.
---

# hitSlop authoring

- Work on authoring projects, not built runtime documents.
- Read `manifest.json` first. Zod in `packages/schema` is authoritative.
- Use `bun slop <command> <path>` in this repository; externally use `slop` or
  `bunx @hitslop/cli`.
- Use `slop dev` with isolated `.hitslop/dev/stores`; add `--native` only for
  host rendering and window-mask behavior.
- Treat `dist/<slug>.slop/app.html` as generated. Source CSS is compiled into it.
- Never copy source, dependencies, build caches, stylesheets, or seed stores
  into a runtime template.
- Storage is implicit and ID-free: JSON is `stores/data.json`, SQLite is
  `stores/data.sqlite`, and either is created only when code first uses it.
- Publishing captures `QuickLook/Preview.png` and derives a maximum-512px
  `QuickLook/Thumbnail.png` unless the author supplies `--thumbnail`. It signs
  one immutable artifact and lets the registry assign the next release number.
  Never add a version to the manifest.
- Prefer a 512x512 custom thumbnail with a centered subject, safe margins, and
  no essential small text. Templates and published artifacts never contain the
  macOS host-generated `Icon\r` Finder metadata.
- Publisher ownership comes from the local key. Use `slop identity` commands to
  inspect, rename, export, or import it.
- When creating or substantially revising a slop interface, also use the local
  `hitslop-design` skill.

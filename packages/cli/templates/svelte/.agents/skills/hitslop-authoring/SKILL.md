---
name: hitslop-authoring
description: Create, preview, validate, build, install, or publish hitSlop authoring projects with the TypeScript CLI. Use for manifests, storage choices, package boundaries, capture, identity, and release workflow.
---

# hitSlop authoring

Read `manifest.json` first. Work on the authored source project, never a built
runtime document.

## Workflow

1. Fix the single job, categories, and initial window size in the manifest.
2. Choose no storage, JSON, SQLite, named media, or a deliberate combination.
3. Develop with isolated stores and test live plus static capture states.
4. Validate and build a source-free, store-free runtime package.
5. Install a master, create a writable copy, and test reopen/export.
6. Publish one signed immutable artifact.

Use `bun slop <command> <path>` inside the hitSlop repository. In a scaffolded
project use its Bun scripts, `slop`, or `bunx @hitslop/cli`.

Read [references/workflow.md](references/workflow.md) for commands, capture,
identity, and the definition of done. Read
[references/storage-and-packages.md](references/storage-and-packages.md) before
adding persistence or changing the runtime boundary.

## Non-negotiable package rules

- Runtime packages contain `manifest.json`, generated `app.html`, optional
  immutable `assets/`, optional host-owned `stores/` in writable documents,
  and optional `QuickLook/` images.
- Authored templates and published artifacts contain no stores, source,
  dependencies, build caches, editable stylesheets, SQLite sidecars, or
  Finder-managed `Icon\r`.
- Storage is implicit and ID-free. Never add storage declarations or release
  versions to the manifest.
- Treat `dist/<slug>.slop` as generated output.
- Publishing captures `QuickLook/Preview.png`, produces a maximum-512px
  `Thumbnail.png`, and signs one immutable ZIP.
- Publisher ownership comes from the local Ed25519 identity; back it up with
  `slop identity export`.

When creating or substantially revising an interface, also use the local
`hitslop-design` skill.

---
name: hitslop-authoring
description: Create, preview, validate, build, or publish hitSlop authoring projects with the TypeScript CLI.
---

# hitSlop authoring

Work on authoring projects, not built runtime documents.

- Read `manifest.json` first; Zod in `packages/schema` is authoritative.
- Use `bun slop <command> <path>` inside this repository. In an external
  project use the installed `slop` binary or `bunx @hitslop/cli`.
- Use `slop dev` for browser debugging with isolated `.hitslop/dev` stores;
  add `--native` only when host rendering itself matters.
- Treat `dist/<slug>.slop/app.html` as generated.
- Never copy source, dependency manifests, `node_modules`, or build caches into
  a runtime package.
- Publishing creates/uses the local Ed25519 identity and lets the server assign
  the next release number. Do not add a version to the manifest.
- Store paths are derived: a manifest entry `state: { kind: "json" }` maps to
  `stores/state.json`; authors never declare paths.
- A catalog artifact is source-free and cannot be used as an authoring starter.

---
name: hitslop-authoring
description: Create, preview, validate, build, register, or publish hitSlop authoring projects with the TypeScript CLI. Use for manifests, storage choices, package boundaries, capture, identity, and release workflow.
---

# hitSlop authoring

Read `manifest.json` first. Work on the authored source project, never a built
runtime document.

## Workflow

1. Fix the single job, categories, and initial window size in the manifest.
2. Choose no storage, JSON, named media, or a deliberate combination.
3. Develop against the disposable browser fake and test live plus static capture states.
4. Validate and build a source-free, store-free runtime package.
5. Register a local master, create a writable copy, and test reopen/export.
6. Publish one signed immutable artifact.

Use `bun slop <command> <path>` inside the hitSlop repository. In a scaffolded
project use its Bun scripts, `slop`, or `bunx @hitslop/cli`.

Read [references/workflow.md](references/workflow.md) for commands, capture,
identity, and the definition of done. Read
[references/storage-and-packages.md](references/storage-and-packages.md) before
adding persistence or changing the runtime boundary.

## Non-negotiable package rules

- Runtime packages contain `manifest.json`, generated `app.html`, optional
  `data.schema.json`, the canonical document Agent Skill, optional immutable `assets/`, optional host-owned
  `stores/` in writable documents, and optional `QuickLook/` images.
- Author root `schema.ts` with `import * as Type from "typebox"`.
  Import that schema directly into `jsonStore({ schema, initial })`.
  Type inference requires no generated files or running dev server. The store
  uses TypeBox runtime validation; builds emit `data.schema.json` for the host.
  Keep schema definitions deterministic: app and builder evaluate separately.
  Never manually supply a validator or rewrite ordinary schema imports. Preserve
  unknown fields with `additionalProperties: true`; never coerce or insert defaults.
  Quick Checklist is the only active example. Paused source is preserved in
  `examples/slops/_backlog/`, excluded from active checks, tests, and builds.
  Promote and migrate one example at a time. The CLI counter starter follows the same APIs.
- Authored templates and published artifacts contain no stores, source,
  dependencies, build caches, editable stylesheets, unsupported stores, or
  Finder-managed `Icon\r`.
- Storage is implicit and ID-free. Never add storage declarations or release
  versions to the manifest.
- Treat `dist/<slug>.slop` as generated output.
- Quick Checklist and the CLI counter starter use root `theme.ts` uses `defineTheme`
  from `@hitslop/runtime/theme`, supplying typed variables and generated
  immutable `assets/theme.css`. Owners still edit `stores/theme.css`.
- Builds embed document guidance; missing or changed guidance never prevents
  opening. Do not compare its text with the host's current copy.
- Publishing captures `QuickLook/Preview.png`, produces an exact 512×512
  `QuickLook/Icon.png`, and signs one immutable ZIP.
- Publisher ownership comes from the local Ed25519 identity; back it up with
  `slop identity export`.

When creating or substantially revising an interface, also use the
`hitslop-design` skill.

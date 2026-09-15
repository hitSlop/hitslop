# Storage and package boundary

Quick Checklist is the versioned-document pilot: author `S.Document` from
`@hitslop/schema/document` (TypeBox underneath), and use
`documentStore({ schema, initial })` plus `change(draft => ...)`. Application types
contain only data; generated `data.schema.json` describes the disk envelope
`{$slop: {format: 1, baseRevision}, data}`. Preserve the opaque `$slop` metadata
when editing files. Native review owns invalid/unknown-baseline recovery.

Quick Checklist and the CLI scaffold use this same contract. All other template
sources are deferred. Use no persistence for a pure calculation; use the document
engine for structured data and named media for known file roles. All persistent
mutations use `change()`, and `current` is immutable. Host chrome reports storage
errors automatically. Validation never coerces, inserts defaults, or strips fields.

A template contains immutable `manifest.json`, generated `app.html`, optional
`data.schema.json`, optional immutable `.agents/skills/hitslop-document` guidance,
optional `assets/`, and capture images when registered/published. A writable document may lazily add `stores/data.json`,
`stores/media/`, `stores/theme.css`, and host-owned `state/`
(Loro checkpoint, identity, materialization metadata and journal). Templates must not contain `state/`.
The macOS host may add Finder `Icon\r` metadata locally.

The builder supplies current guidance, but hosts must not require its presence
or compare it with their own copy. Quick Checklist and the CLI starter use single-source
`theme.ts`; backlog migration remains a separate task.

Never ship source, `node_modules`, `.hitslop`, `dist` nesting, authoring skills,
`style.css`, `document.json`, seed stores, unsupported stores, env files, keys,
or Finder metadata in a template or published artifact.

## Host runtime

Source manifests use `https://api.hitslop.com/schemas/v1/authoring-manifest.schema.json`.
The build generates a required minimum-compatible `runtime` version in the built
manifest. Do not author this field or bundle `@hitslop/sync`/Loro into a document.
The installed host supplies the JS/WASM engine; `slop dev` and the gallery serve
the same runtime with disposable storage. Unsupported requirements require an
app update. See `docs/sync-v1.md` in the repository for versioning and release rules.

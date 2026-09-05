# Storage and package boundary

Use no persistence for a pure calculation. Use JSON for one compact object
graph, SQLite for queryable collections and transactional changes, and named
media for a small set of known file roles.

JSON writes replace the value atomically and may use an expected revision.
Root `schema.ts` authors the TypeBox data shape. Svelte stores import its
default export directly and infer data types through
`jsonStore({ schema, initial })`. Validation checks values without
coercion, defaults, or field removal. Quick Checklist is the migrated pilot;
other examples and init are deferred. Group related SQLite statements in one host transaction and parameterize values. Never copy live WAL
or SHM files. Replace/remove named media through the host rather than treating
it as an arbitrary filesystem.

A template contains immutable `manifest.json`, generated `app.html`, optional
`data.schema.json`, optional immutable `.agents/skills/hitslop-document` guidance,
optional `assets/`, and capture images when registered/published. A writable document may lazily add `stores/data.json`,
`stores/data.sqlite`, `stores/media/`, and `stores/theme.css`.
The macOS host may add Finder `Icon\r` metadata locally.

The builder supplies current guidance, but hosts must not require its presence
or compare it with their own copy. Quick Checklist is the single-source
`theme.ts` pilot; do not migrate other examples or the init template yet.

Never ship source, `node_modules`, `.hitslop`, `dist` nesting, authoring skills,
`style.css`, `document.json`, seed stores, SQLite sidecars, env files, keys,
or Finder metadata in a template or published artifact.

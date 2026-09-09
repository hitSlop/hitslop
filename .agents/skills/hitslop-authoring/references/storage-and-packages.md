# Storage and package boundary

Use no persistence for a pure calculation. Use JSON for structured data and
named media for a small set of known file roles.

JSON writes replace the value atomically and may use an expected revision.
Root `schema.ts` authors the TypeBox data shape. Svelte stores import its
default export directly and infer data types through
`jsonStore({ schema, initial })`. Validation checks values without
coercion, defaults, or field removal. Quick Checklist and the CLI counter starter use this workflow;
backlog examples remain deferred. Replace/remove named media through the host
rather than treating it as an arbitrary filesystem.

A template contains immutable `manifest.json`, generated `app.html`, optional
`data.schema.json`, optional immutable `.agents/skills/hitslop-document` guidance,
optional `assets/`, and capture images when registered/published. A writable document may lazily add `stores/data.json`,
`stores/media/`, and `stores/theme.css`.
The macOS host may add Finder `Icon\r` metadata locally.

The builder supplies current guidance, but hosts must not require its presence
or compare it with their own copy. Quick Checklist and the CLI starter use single-source
`theme.ts`; backlog migration remains a separate task.

Never ship source, `node_modules`, `.hitslop`, `dist` nesting, authoring skills,
`style.css`, `document.json`, seed stores, unsupported stores, env files, keys,
or Finder metadata in a template or published artifact.

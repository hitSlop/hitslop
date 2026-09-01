# Storage and package boundary

Use no persistence for a pure calculation. Use JSON for one compact object
graph, SQLite for queryable collections and transactional changes, and named
media for a small set of known file roles.

JSON writes replace the value atomically and may use an expected revision.
Keep defaults explicit and new fields backward-readable. Group related SQLite
statements in one host transaction and parameterize values. Never copy live WAL
or SHM files. Replace/remove named media through the host rather than treating
it as an arbitrary filesystem.

A template contains immutable `manifest.json`, generated `app.html`, optional
`assets/`, and capture images when installed/published. A writable document may
lazily add `stores/data.json`, `stores/data.sqlite`, and `stores/media/`.
The macOS host may add Finder `Icon\r` metadata locally.

Never ship source, `node_modules`, `.hitslop`, `dist` nesting, skills,
`style.css`, `document.json`, seed stores, SQLite sidecars, env files, keys,
or Finder metadata in a template or published artifact.

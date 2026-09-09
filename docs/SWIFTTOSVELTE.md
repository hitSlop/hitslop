# Swift → Svelte decision record

hitSlop replaced its embedded Swift/WASM guest with a framework-neutral web
runtime. The native host still owns package validation, JSON persistence,
window geometry, iCloud coordination, Quick Look, and the bridge. Svelte is an
authoring SDK, not part of the `.slop` format.

```text
App.svelte
    │  jsonStore({ schema, initial })
    ▼
@hitslop/svelte → @hitslop/runtime → window.slop → native host
                                      ├── stores/data.json
                                      ├── stores/media/*
                                      └── stores/theme.css
```

The switch removed a guest compiler and language-specific runtime without
weakening the native data boundary. Authors use ordinary Svelte, TypeScript,
CSS, and Vite; build compiles them into one immutable `app.html`.

The bridge has one optional JSON store. It is declared by use rather than the
manifest, created lazily, and written atomically with revision checks.

Guests call `ready()` after mounting. Readiness waits for pending bridge work and
stable animation frames so screenshots and previews capture settled UI.

Runtime packages never contain source, dependencies, build output directories,
editable stylesheets, or seeded data. See [architecture.md](architecture.md)
for the current normative contract.

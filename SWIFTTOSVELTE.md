# Swift → Svelte decision record

hitSlop replaced its Embedded Swift/WASM guest with a web cartridge. The native host still owns package validation, JSON/SQLite persistence, themed windows, Quick Look, and the `window.slop` bridge. Svelte is the bundled authoring SDK, while `slop-web/1` remains framework-neutral.

This is a hard format cut. The host opens `slop-web/1`; it does not open or migrate `slop-wasm/1` packages.

## Why

The old guest required a Swift WASM SDK and an external compiler. Persistence already crossed through JavaScript, so the compiler was substantial machinery around a web-shaped runtime boundary.

The web guest keeps the useful boundary and makes the editable side ordinary Svelte, TypeScript, and CSS:

```text
App.svelte
    │  jsonStore("state") / sqliteQuery(...)
    ▼
@slop/svelte
    ▼
@slop/runtime
    ▼
window.slop ── WKWebView ──► SlopBridge ──► data.json / data.sqlite
```

## Package contract

Paths are conventions rather than manifest configuration:

```text
Notes.slop/
├── manifest.json
├── source/
│   ├── App.svelte
│   ├── main.ts
│   └── styles.css
├── build/index.html
├── theme.css
├── assets/
├── data.json or data.sqlite
└── QuickLook/
```

- `source/` contains every authored build input. All regular files below it participate in `artifact.sourceHash`.
- `build/index.html` is the sole cartridge and the only committed compiler output inside a document.
- `theme.css` and `assets/` are live package resources, not build inputs.
- Stores remain explicit because their IDs, kinds, paths, and limits are part of the native security boundary.

The manifest contains document metadata, window configuration, the selected theme ID, stores, and hashes. It does not contain runtime, dependency, source-path, source-file, artifact-entry, or stylesheet-path fields.

## Host contract

The host serves `build/index.html` at `slop://app/`, inserts `slop-base.css` first and `theme.css` last, and exposes:

```ts
window.slop.ready()
window.slop.json.read / write / onChange
window.slop.db.query / execute / transaction / onChange
```

Guests must call `ready()` after mounting. Readiness waits for outstanding bridge work and two stable animation frames; a guest that never signals readiness times out instead of being treated as successfully loaded.

Remote navigation and network access remain blocked. Runtime package assets must live under `assets/`.

## Persistence

- JSON writes are atomic and revision-checked. `jsonStore.update` snapshots Svelte state, serializes local writes, and retries one external revision conflict after reloading.
- SQLite remains native. `sqliteQuery` uses parameterized statements and reloads from the host change event after mutations.
- Svelte `$state` proxies must be snapshotted before crossing the bridge; `structuredClone` cannot clone them directly.

## Build and install

```sh
scripts/install-cli.sh --prefix /usr/local
slop build path/to/Notes.slop
slop validate path/to/Notes.slop
```

The installed layout is:

```text
<prefix>/bin/slop
<prefix>/libexec/hitslop/sdk/
```

The CLI requires Node 20.19 or newer. It resolves the SDK from `SLOP_SDK`, its installed `libexec` directory, or the current repository for development. Documents never contain Node, `node_modules`, Vite configuration, or package checkouts.

Browser-only `slop dev` is intentionally not part of v1. A localStorage mock can approximate JSON persistence, but it cannot preserve arbitrary SQLite semantics without maintaining a second database implementation.

## Verification

```sh
swift test --package-path Packages/SlopKit
swift test --package-path Packages/HitSlopMac
swift build --package-path Packages/SlopCLI
node sdk/bin/slop.mjs build "Packages/SlopTemplates/Sources/SlopTemplates/Resources/Templates/Field Notes.slop"
node sdk/bin/slop.mjs build "Packages/SlopTemplates/Sources/SlopTemplates/Resources/Templates/SQLite Field Notes.slop"
node sdk/bin/slop.mjs build "Packages/SlopTemplates/Sources/SlopTemplates/Resources/Templates/Notebook.slop"
```

In the app, verify JSON and SQLite mutations, external store edits, explicit readiness, live theme changes, duplication, and Quick Look/export output.

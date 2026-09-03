# Framework and authoring packages

All public packages are MIT licensed and currently versioned `0.1.x`. The
runtime contract is framework-neutral; UI adapters are intentionally thin.

## @hitslop/cli

The `slop` executable owns project lifecycle:

- `init` scaffolds the supported Svelte project and portable agent skills.
- `validate` parses the authoritative manifest.
- `dev` runs Vite with a disposable in-memory host fake for UI work.
- `build` emits a source/store-free runtime directory and optional schema metadata.
- `register` captures and adds an immutable local catalog master.
- `publish` signs and uploads an immutable ZIP.
- `identity` manages the local Ed25519 publisher identity.

Capture is delegated to `hitslop-native`, keeping WebKit behavior consistent
with the app. Identity export is encrypted and private keys are never project
files.

## @hitslop/runtime

Application-facing exports are `slop`, `ready`, `capture`, and `sql`.
They cover JSON, SQLite, named media, window resize/drag, host readiness,
renderer detection, and parameterized statement composition.

`@hitslop/runtime/adapter` exposes lower-level persistence/media primitives
for framework adapter authors. Ordinary slops should use the root package or a
framework package instead. The subpath prevents adapter internals from becoming
the main application API.

## @hitslop/svelte

Svelte 5 rune-aware classes/functions:

- `jsonStore` / `JsonStore`
- `sqliteQuery` / `SqliteQuery`
- `imageStore` / `ImageStore`
- `fileStore` / `FileStore`

These expose reactive value/loading/error/persistence state while delegating all
durability to the runtime host. `jsonStore` requires a Zod schema alongside its
initial value and validates data at the persistence boundary. The CLI template
is the canonical v1 authoring example.

## @hitslop/react

React hooks mirror the storage capabilities:

- `useJsonStore`
- `useSqliteQuery`
- `useImageStore`
- `useFileStore`

The maintained `examples/slops/react-counter` app is the integration guide.
There is intentionally no `slop init --template react` in v1; API feedback can
settle before a second scaffold becomes a compatibility promise.

## @hitslop/schema

Zod definitions cover the manifest, controlled categories, package paths, and
the signed publish protocol. Generation emits the public JSON Schema, Swift
Codable model, and bundled Swift validation schema. Change Zod first, run
`bun run schema:generate`, and commit every generated result.

## Dependency direction

```text
schema  ◀── cli, api, registry
runtime ◀── svelte, react
schema-generated JSON/Swift ◀── Apple Core
```

Framework adapters may depend on `runtime/adapter`; runtime must not depend on
Svelte or React. Services share schema validation rather than duplicating
manifest types.

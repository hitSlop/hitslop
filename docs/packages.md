# Framework and authoring packages

All public packages are MIT licensed and currently versioned `0.3.x`. The
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
They cover JSON, named media, window resize/drag, host readiness,
renderer detection, and parameterized statement composition.

`@hitslop/runtime/adapter` exposes lower-level persistence/media primitives
for framework adapter authors. Ordinary slops should use the root package or a
framework package instead. The subpath prevents adapter internals from becoming
the main application API.

## @hitslop/svelte

Svelte 5 rune-aware classes/functions:

- `jsonStore` / `JsonStore`
- `imageStore` / `ImageStore`
- `fileStore` / `FileStore`

These expose reactive value/loading/error/persistence state while delegating all
durability to the runtime host. `jsonStore` accepts the schema directly
from root TypeBox `schema.ts`, alongside its initial value, and
validates data at the persistence boundary. Quick Checklist
and the CLI counter starter share this workflow; backlog examples remain deferred.

The React adapter is paused in `archive/packages/react`, outside the workspace
and release pipeline. The runtime remains suitable for future framework adapters.

See [Capture views](capture.md) for `IconTarget`, `ExportTarget`, and optional
asynchronous preparation through the framework-neutral runtime.

## @hitslop/schema

TypeBox definitions cover the manifest, controlled categories, package paths, and
the signed publish protocol. Generation emits the public JSON Schema, Swift
Codable model, and bundled Swift validation schema. Change TypeBox first, run
`bun run schema:generate`, and commit every generated result.

`@hitslop/schema/validation` provides TypeBox runtime checks.
`@hitslop/schema/json` contains plain-JSON assertions. Authoring apps import
schemas directly; the builder emits JSON Schema for the native host.

## Dependency direction

```text
schema  ◀── cli, api, registry
runtime ◀── svelte
schema-generated JSON/Swift ◀── Apple Core
```

Framework adapters may depend on `runtime/adapter`; runtime must not depend on
Svelte or React. Services share schema validation rather than duplicating
manifest types.

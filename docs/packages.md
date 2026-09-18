# Framework and authoring packages

All public packages are MIT licensed and currently versioned `0.3.x`. The
runtime contract is framework-neutral; UI adapters are intentionally thin.

## @hitslop/cli

The `slop` executable owns project lifecycle:

- `init` scaffolds the supported Svelte project and installs missing machine-level agent skills.
- `skills sync` writes `hitslop`, `hitslop-authoring`, `hitslop-design`, and `hitslop-document` into `~/.hitslop/skills` and links them for coding agents.
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

Application-facing exports are `slop`, `ready`, `capture`, `flush`, and `hostInfo`.
They cover JSON, document media, window resize/drag, host readiness,
capture lifecycle, and host capability discovery.

`@hitslop/runtime/adapter` exposes lower-level persistence/media primitives
for framework adapter authors. Ordinary slops should use the root package or a
framework package instead. The subpath prevents adapter internals from becoming
the main application API.

## @hitslop/svelte

Svelte 5 rune-aware classes/functions:

- `createDocument` / `SlopDocument` with typed verbs, store-owned fields, and text attachments; `<Slop>` supplies host reporting and capture snippets
- `imageStore(document, fields.photo, { fallback })` / `ImageStore`
- `fileStore(document, fields.attachment)` / `FileStore`

These expose reactive value/loading/error/persistence state while delegating all
durability to the runtime host. `createDocument` accepts the schema directly
from root TypeBox `schema.ts`, alongside its initial value, and
validates data at the persistence boundary. Quick Checklist
and the CLI counter starter share this workflow; archived examples remain deferred.

The React adapter is paused in `archive/packages/react`, outside the workspace
and release pipeline. The runtime remains suitable for future framework adapters.

See [Capture views](capture.md) for `IconTarget`, `ExportTarget`, and optional
asynchronous preparation through the framework-neutral runtime.

## @hitslop/schema

TypeBox definitions cover the manifest, controlled categories, package paths, and
the signed publish protocol. Generation emits the public JSON Schema, Swift
Codable model, and the bundled TypeScript engine for Apple. Change TypeBox first, run
`bun run schema:generate`, and commit every generated result.

`@hitslop/schema/validation` provides TypeBox runtime checks.
`@hitslop/schema/json` contains plain-JSON assertions. Authoring apps import
schemas directly; the builder emits JSON Schema for the native host.

## @hitslop/document-engine

One deterministic evaluator implements commands, schema validation, receipts and
undo decisions. It imports `@hitslop/schema`; it has no storage, clock, network or
identity-generation dependencies. Hosts supply time, identities and committed
state, then durably commit the returned delta before acknowledgement.

`/web` supplies Web Crypto request preparation, leases and the disposable preview
authority. `/jsc` supplies the JSON string ABI used by Apple’s trusted bundled
engine. Cloudflare imports the evaluator directly. Build the Apple resource with
`bun run schema:generate`; never edit the generated JavaScript.

## Dependency direction

```text
schema ◀── document-engine ◀── CLI preview, Cloudflare, Apple/JSC
schema ◀── api, runtime ◀── svelte
schema-generated fixed Swift models ◀── Apple Core
```

Framework adapters may depend on `runtime/adapter`; runtime must not depend on
Svelte or React. Services share schema validation rather than duplicating
manifest types.

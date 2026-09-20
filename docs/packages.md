# Framework and authoring packages

The active v1 workspace contains private `@hitslop/document`, `@hitslop/schema`, and `@hitslop/cli` packages. Only `hitslop-v1` is supported.

## @hitslop/document

`defineDocument` and `s` define the application schema. Typed handles mutate a Loro document; snapshots are read-only. The host supplies the pinned JS/WASM engine to both native WebViews and disposable previews. The Svelte adapter provides `useDocument`, `bindText`, and `<Slop {document}>` with lazy inline `exportView` and `icon` snippets. See [authoring](authoring.md) and [capture](capture.md).

A generated `state.schema.json` is a document descriptor, not JSON Schema. `initial.json` is immutable creation-only data. Swift stores opaque checkpoint/update bytes and does not interpret application fields.

## @hitslop/schema

TypeBox owns platform manifest, bridge, and socket envelopes. Change source contracts and run `bun run schema:generate`; `bun run check` detects generated drift. Native validation covers envelopes and package boundaries, while operation semantics remain in the shared document runtime.

## @hitslop/cli

TypeScript handles source scaffolding, browser preview, Svelte compilation, template building, and local registration. Builds generate runtime resources, compile the Swift helper, then capture previews/icons in disposable copies. Browser development requires no native renderer.

macOS document operations delegate to the bundled Swift CLI. Helper discovery is shared with the template builder; the Bun development/test adapter is separate. See [CLI commands](cli.md).

Retired runtime, Svelte, JavaScriptCore, and publishing implementations under `deferred/` are historical references, not active packages or fallback engines.

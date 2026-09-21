# Architecture

A `.slop` is immutable app code plus a structured local document. The host supplies a document SDK and Loro JS/WASM runtime for each supported contract; each WebView creates its own live Loro document. Svelte is a thin adapter over immutable projections and typed operations. The Swift CLI runs the same bundled WASM runtime in an engine-only invisible WebKit session when no native owner exists. It never loads authored app code.

```text
App → typed operations → host-supplied Loro runtime
                              ↓ update bytes
                        native storage queue → SQLite
CLI → live Unix socket ────────┘
CLI → exclusive lock → same WASM runtime in WebKit → Swift SQLite (when closed)
```

Swift does not interpret application fields. It validates packages, isolates resource access, owns disk writes and close/export, and presents save/application errors. SDK validation applies to supported commands; it is not a security boundary from authored code sharing the page.

An edit returns after acceptance in memory. `flush()` and a successful CLI mutation acknowledge local persistence. No network acknowledgement exists in v1. Renderer death can lose unsaved edits.

The builder externalizes runtime imports and rejects embedded engine modules. Native and preview runtime resources are generated from the same entry point. Runtime loading verifies `hitslop-v1`, uses a separate WASM resource, and downloads no executable code. Documents select a contract and minimum revision. The current release builds contract 1; future incompatible contracts retain older runtime trees. See [runtime versioning](versioning.md).

No JavaScriptCore engine, JSON projection, external JSON editing, proposal recovery, or room authority remains in the active graph. The existing macOS client, TCA, local catalog, Firebase Analytics/Crashlytics, and native CLI remain active. Hosted catalog, OpenAPI/Registry, public publishing, document sharing, Firebase Auth/App Check, and account UI are deferred. Firebase startup remains enabled for telemetry only. The old `slop` s-expression skill is unrelated to this package format.

Document sockets validate generated TypeBox envelopes. get flushes drafts and pending writes before returning persisted state; a small `hello` supplies the current runtime session epoch for new mutations. The host supplies a live export callback to reuse native capture without adding renderer dependencies to the engine. See [CLI](cli.md).

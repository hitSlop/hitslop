# Architecture

A `.slop` is immutable app code plus a structured local document. The host installs one pinned document SDK and Loro JS/WASM release; each WebView creates its own live Loro document. Svelte is a thin adapter over immutable projections and typed operations. The Swift CLI runs the same bundled WASM runtime in an engine-only invisible WebKit session when no native owner exists. It never loads authored app code.

```text
App → typed operations → host-supplied Loro runtime
                              ↓ update bytes
                        native storage queue → SQLite
CLI → live Unix socket ────────┘
CLI → exclusive lock → same WASM runtime in WebKit → Swift SQLite (when closed)
```

Swift does not interpret application fields. It validates packages, isolates resource access, owns disk writes and close/export, and presents save/application errors. SDK validation applies to supported commands; it is not a security boundary from authored code sharing the page.

An edit returns after acceptance in memory. `flush()` and a successful CLI mutation acknowledge local persistence. No network acknowledgement exists in v1. Renderer death can lose unsaved edits.

The builder externalizes runtime imports and rejects embedded engine modules. Native and preview runtime resources are generated from the same entry point. Runtime loading verifies `hitslop-v1`, uses a separate WASM resource, and downloads no executable code. The current release has one runtime; no compatibility archive exists.

No JavaScriptCore engine, JSON projection, external JSON editing, proposal recovery, or room authority remains in the active graph. The existing macOS client, TCA, local catalog, Firebase, OpenAPI generation, and native CLI remain active. Only remote catalog loading and document sharing are deferred. The old `slop` s-expression skill is unrelated to this package format.

Document sockets validate generated TypeBox envelopes. Reads execute directly; a small `hello` supplies the current runtime session epoch for new mutations. The host supplies a live export callback to reuse native capture without adding renderer dependencies to the engine. See [CLI](cli.md).

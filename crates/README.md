# Shared document core

Promoted from `spikes/hitslop-core` at `9ded8c9` for the contract-4 cutover.
The spike remains historical evidence; implementation work belongs here.

- `hitslop-core`: descriptor interpretation, Loro operations, publications and bytes.
- `hitslop-core-ffi`: UniFFI adapter used by the Apple host and native helper.
- `hitslop-core-wasm`: wasm-bindgen adapter for browser development and Bun tests.

The root toolchain/lockfile pin Rust 1.96.1, Loro 1.16.2, UniFFI 0.31.1 and
wasm-bindgen 0.2.127. Install the matching generator once:

```sh
cargo install wasm-bindgen-cli --version 0.2.127 --locked --root generated/core-tools
bun run schema:generate
bun run core:build:wasm
bun run core:build:native # macOS only
bun run core:test
```

`bun run build` prepares both bindings before Swift. `bun run test` refreshes the
WASM binding before SDK tests. CI caches artifacts by toolchain, lockfile and source;
a cache hit never substitutes for Cargo's dependency checks. The native build prepares arm64 and x86_64 macOS slices before making its universal
XCFramework, so CI test architecture does not dictate the release architecture.
Generated XCFramework and Swift bindings are disposable and excluded from Git. TypeBox owns wire types;
run `bun run schema:generate`, never edit `wire.generated.rs` manually.

The native owner retains SQLite format 2 and writes storage reader revision 2.
Its contract-4 gate refuses contract 3 before ownership/storage creation. This is
an integration foundation: the existing app still selects contract 3 until the
renderer, public SDK and CLI cutover are complete. There is no automatic fallback
from a contract-4 owner to the old engine.

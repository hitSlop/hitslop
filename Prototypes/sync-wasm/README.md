# Loro runtime smoke check

Disposable proof that the self-contained Loro WASM distribution, hashing,
mutation and snapshot round-trip run in browser preview and the native `slop:`
scheme. No document persistence, network, registration or publishing.

```sh
bun slop dev Prototypes/sync-wasm
bun slop build Prototypes/sync-wasm
HITSLOP_WASM_PACKAGE="$PWD/Prototypes/sync-wasm/dist/sync-wasm.slop" swift test --package-path apps/apple/Packages/HitSlopApple --filter loroRunsUnderNativePackageScheme
```

In browser preview, “Test host error” verifies that the shared error panel
appears below the document and its async Retry action clears the report.

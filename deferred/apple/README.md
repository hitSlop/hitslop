# Archived Apple implementations

These files are outside all active Swift targets. They reference retired command/snapshot types and are historical reference, not disabled features that can be enabled by changing Package.swift.

The shipped document engine is Loro JS/WASM in HitSlopWasm. Do not restore JavaScriptCore, JSON room seeds, mutable theme stores, or the old generated bridge contract. Future collaboration must use Loro updates and the boundaries in [sharing-later.md](../../docs/sharing-later.md).

Firebase Analytics/Crashlytics remain active. OpenAPI/Registry, Firebase Auth/App Check, account, hosted catalog, archive handling, publishing, and sharing are deferred. The local-release directory preserves the removed client integration and tests.

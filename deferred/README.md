# Deferred tooling and historical tests

These directories retain old publishing tooling and tests tied to the retired command/snapshot or room engines. They are excluded from the workspace and are not a fallback runtime. Platform manifest/catalog/publish contracts needed by current work live in packages/schema.

The macOS client is active: its original App, Core, Runtime, Host, Features/TCA, Catalog, Firebase Analytics/Crashlytics, and NativeCLI targets remain in apps/apple. HitSlopWasm supplies the shared document engine. OpenAPI/Registry, accounts/Auth/App Check, document sharing, archive handling, and hosted catalog loading are deferred. See apple/local-release for their preserved integration. Local template discovery remains part of the client.

# Deferred tooling and historical tests

These directories retain old publishing tooling and tests tied to the retired command/snapshot or room engines. They are excluded from the workspace and are not a fallback runtime. Platform manifest/catalog/publish contracts needed by current work live in packages/schema.

The macOS client is active: its original App, Core, Runtime, Host, Features/TCA, Catalog, Firebase, OpenAPI, Registry, and NativeCLI targets remain in apps/apple. HitSlopWasm supplies the shared document engine. Only document sharing and hosted catalog loading are deferred; local template discovery is part of the client.

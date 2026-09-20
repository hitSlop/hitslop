# After local v1

Public authoring is the next catalog direction: an author uploads a validated immutable hitslop-v1 template, users browse through the generated OpenAPI client, and downloads become immutable cached masters. Creating a document makes a local writable copy. Bundled starters and cached templates remain usable offline.

Plan a separate Cloudflare catalog/publishing module using Worker HTTP endpoints, R2 artifacts, and catalog metadata. Keep TypeBox authoritative and generate Swift OpenAPI contracts. Public publishing needs publisher identity, upload limits, package isolation/checksums, immutable release identity, and abuse controls before activation. The current old Worker is historical scaffolding, not a supported deployment.

Document collaboration is a separate future module. Authenticate in Swift, transfer Loro bytes, append opaque updates remotely, and import them into each WebView replica. Local SQLite remains the offline cache. One writer owns each local replica. Keep credentials outside authored code, ByteStore as the persistence boundary, and convergence tests around internal import/export. Add a dedicated sync envelope rather than overloading apply.

Do not restore JSON room seeds, command/snapshot authority, guest snapshot reconciliation, JSC, data.json, or a second semantic validator. Public catalog work does not require room collaboration.

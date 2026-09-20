# Apple client

The shipped client is macOS 14+ on Apple silicon, distributed as signed/notarized GitHub Release DMG and ZIP artifacts with Sparkle updates.

Keep the existing TCA Features, Catalog, frameless Host windows and hover toolbar, Firebase startup, OpenAPI client scaffolding, Sparkle, and NativeCLI. HitSlopWasm owns visible and engine-only WebKit sessions; HitSlopRuntime integrates the engine with the client. No JavaScriptCore document engine exists.

Loro JS/WASM is pinned and bundled identically for the host and installed helper. Swift persists opaque format-1 SQLite bytes. The helper routes to a live Unix socket or owns a closed package. It needs no Node/Bun, and headless document editing never loads authored app.html.

The app includes immutable Quick Checklist and Small Expenses starters under Contents/Resources/StarterTemplates. The catalog combines these with ~/.hitslop/templates and recents. Always create a writable copy to edit. Built-ins and registered templates have source-specific identities. The default catalog has no hosted request, auth listener, or account UI.

Firebase Release configuration, Analytics, Crashlytics and App Check remain active. Firebase/OpenAPI modules are retained for future public authoring; this release does not expose hosted discovery, join URLs, remote creation, or public publishing. Sharing, media import, schema evolution, undo UI, iCloud, and synced folders remain deferred.

Native owns save failure and recovery UI. Save failure retries the same replica; renderer failure reopens saved state under the existing writer lease. PNG/PDF toolbar and CLI exports share destination validation and atomic publication. QuickLook snapshots remain active.

Run bun run test:local before release. See ../local-testing.md and ../security.md for validation and boundaries. TypeBox contracts are generated with bun run schema:generate; never edit generated Swift.

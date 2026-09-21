# hitSlop v1

Read manifest.json first. Only runtime `hitslop-v1` is accepted. No legacy-format migration. Preserve all shipped v1 runtime contracts; see docs/versioning.md.

- The live document is Loro in the WebView. Swift stores opaque checkpoint/update bytes in state/document.sqlite (format 1).
- One OS writer lock owns a local package. CLI commands route to the live native session or acquire ownership when closed. Never bypass a busy lock or unlink writer.lock.
- Author schema.ts with defineDocument/s from @hitslop/document. state.schema.json is a descriptor, not JSON Schema. initial.json is immutable creation-only data.
- App state uses text, finite scalar registers, enums, optional scalars, objects, and movable object lists. $id is row identity. Use typed handles and synchronous transaction(tx => ...); snapshots are read-only.
- Never add stores/data.json, projections, watchers for JSON reconciliation, a JavaScriptCore document engine, compatibility lenses, or a second document engine.
- Host and CLI ship matching runtimes per supported contract. App bundles must not embed Loro or the document implementation. slop dev uses the same runtime with disposable memory storage.
- Keep TypeBox authoritative for platform manifest/bridge contracts. Generate native contracts with bun run schema:generate; do not edit generated files.
- Runtime packages contain manifest.json, app.html, assets/, state.schema.json, initial.json, optional QuickLook images and embedded .agents/skills/hitslop-document guidance. Builds contain no state, stores, source, dependencies or caches.
- Preserve the existing macOS client: TCA Features, Catalog, Host slop windows/hover toolbar, Firebase Analytics/Crashlytics, Sparkle, and NativeCLI. HitSlopWasm supplies the common document engine; HitSlopRuntime integrates it. A runtime rewrite must not replace the client.
- Flush local drafts and document writes before close/export. Failed saves retain ownership and show native retry. Destroy WebViews on close.
- Native code validates package isolation, symlinks, bridge envelopes and resource sizes. Authored code can damage its own document; no independent native semantic validator.
- Quick Checklist and Small Expenses are the only active examples. Each owns its design; use plain CSS and defineTheme tokens. Read examples/slops/PRODUCT.md and docs/presentation.md for visual changes. _vibe is inspiration only.
- CLI: bun slop dev/build/register SOURCE; schema/get/apply/batch/compact DOCUMENT. Runtime masters are immutable; create a writable copy to edit.
- PDF/PNG export is in scope. Collaboration, media import, remote catalog cutover, publication, undo UI, schema evolution, history pruning, iCloud and other synced folders are deferred.
- Tests: bun run check; bun run test; bun run build; bun run swift:test. Historical _docs/, archive/, deferred/, retired command-engine tests and backend source are not active tests or implementation contracts.

- The native Swift CLI edits through the live Unix socket or an engine-only invisible WebKit session. Installed editing needs no Node/Bun. Never load authored app code for headless document operations.
- Catalog discovery combines bundled slops and ~/.hitslop/templates, with manifest-derived categories and Recents. Users unpack external downloads before placing template packages in that folder. Hosted discovery, OpenAPI/Registry, accounts/Auth/App Check, and sharing code live in deferred; Firebase Analytics/Crashlytics stay active.

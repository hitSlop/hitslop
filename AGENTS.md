# hitSlop v1

Read manifest.json first. Only runtime `hitslop-v1` is accepted. No legacy-format migration. Preserve all shipped v1 runtime contracts; see docs/versioning.md.

- The live document is Loro in the WebView. Swift stores opaque checkpoint/update bytes in state/document.sqlite (format 1).
- One OS writer lock owns a local package. CLI commands route to the live native session or acquire ownership when closed. Never bypass a busy lock or unlink writer.lock.
- Author schema.ts with defineDocument/s from @hitslop/document. state.schema.json is a descriptor, not JSON Schema. initial.json is immutable creation-only data.
- App state uses text/rich text, finite scalar registers (including bounded integers), enums, objects, movable object/scalar lists, records, counters, trees, and optional values (scalar lists use an empty list). $id is row/tree identity. Read immutable snapshots; write typed fields or doc.at(snapshot) handles and synchronous change(tx => ...); transaction remains a compatibility alias. Initialize absent composites with set/put; never assign over existing identity-bearing collections, including through a containing object.
- Never add stores/data.json, projections, watchers for JSON reconciliation, a JavaScriptCore document engine, compatibility lenses, or a second document engine.
- Host and CLI ship matching runtimes per supported contract. App bundles must not embed Loro or the document implementation. slop dev uses the same runtime with disposable memory storage.
- Keep TypeBox authoritative for platform manifest/bridge contracts. Generate native contracts with bun run schema:generate; do not edit generated files.
- Runtime packages contain manifest.json, app.html, assets/, state.schema.json, initial.json, optional QuickLook images and embedded .agents/skills/hitslop-document guidance. Builds contain no state, stores, source, dependencies or caches.
- Preserve the existing macOS client: TCA Features, Catalog, Host slop windows/hover toolbar, Firebase Analytics/Crashlytics, Sparkle, and NativeCLI. HitSlopWasm supplies the common document engine; HitSlopRuntime integrates it. A runtime rewrite must not replace the client.
- Flush local drafts and document writes before close/export. Failed saves retain ownership and show native retry. Destroy WebViews on close.
- Native code validates package isolation, symlinks, bridge envelopes and resource sizes. Authored code can damage its own document; no independent native semantic validator.
- Active examples are discovered from immediate manifest-bearing directories under examples/slops; bundled.json selects shipped templates. Quick Checklist and Small Expenses remain regression fixtures. Each owns its design; use plain CSS and defineTheme tokens. Read examples/slops/PRODUCT.md and docs/guides/authoring.md for visual changes. _vibe is inspiration only.
- CLI: bun slop dev/build/register SOURCE; schema/get/apply/batch/compact DOCUMENT. Runtime masters are immutable; create a writable copy to edit.
- PDF/PNG export is in scope. Collaboration, audio-library import, remote catalog cutover, hosted template publication, undo UI, schema evolution, history pruning, iCloud and other synced folders are deferred.
- Tests: bun run check; bun run test; bun run build; bun run swift:test. Historical _docs/, archive/, deferred/, retired command-engine tests and backend source are not active tests or implementation contracts.

- The native Swift CLI edits through the live Unix socket or an engine-only invisible WebKit session. Installed editing needs no Node/Bun. Never load authored app code for headless document operations.
- Catalog discovery combines bundled slops and ~/.hitslop/templates, with manifest-derived categories and Recents. Users unpack external downloads before placing template packages in that folder. Hosted discovery, OpenAPI/Registry, accounts/Auth/App Check, and sharing code live in deferred; Firebase Analytics/Crashlytics stay active.

- Launch includes matching npm schema/document/CLI packages, published manually after the compatible signed Mac app. Hosted template publication remains deferred. See docs/guides/releasing.md.

- Reusable attachments are in scope: host-owned immutable blobs in state/attachments, referenced by ordinary Loro fields. Use @hitslop/document/attachments or the native attachment CLI. HTTPS data/media access is allowed; CORS still applies.
- Initial release baseline: contract 1/revision 1/SDK 1.0.0. Preserve sealed runtime bytes and ledger records; subsequent releases follow docs/versioning.md.

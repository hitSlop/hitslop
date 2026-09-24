---
name: hitslop-native
description: Work on hitSlop Apple hosting, local storage, iCloud coordination, template caching, previews, export, or the native CLI.
---

# Native v1 host

Preserve the real macOS client and its existing target graph: Core, Runtime, Host, Features/TCA, Catalog/local templates, Firebase Analytics/Crashlytics, and NativeCLI. HitSlopWasm is the shared engine used by visible document windows and engine-only hidden WebKit sessions in the Swift CLI. Do not replace the client with a playground shell. Loro in the WebView owns live state. Swift stores opaque bytes; do not restore the JavaScriptCore evaluator, JSON projection, room authority, or app-specific Swift schemas.

Generate TypeBox platform contracts with bun run schema:generate. Run bun run build to generate runtime resources, compile the native helper, and then capture template artwork. One writer owns state/writer.lock; never unlink it. host.lock is discovery only. Package paths must be local, isolated and free of symlinks. A failed connection never authorizes a competing writer.

Normal close/export commits local drafts and flushes. Failed close retains ownership. Destroy WebViews after successful close. Native owns save/error/retry UI. PNG/PDF export and automatic Quick Look/Finder icon refresh remain active; media import, remote catalog cutover, OpenAPI/Registry, accounts/Auth/App Check, archive sharing and collaboration are deferred. Bundled slops and ~/.hitslop/templates supply manifest-derived categories; Recents opens local documents. See docs/reference/runtime.md and docs/guides/authoring.md.

Run bun run swift:test for actual WKWebView, live/closed CLI, failed-save/close, and export coverage. bun run bench:windows measures the current SDK; do not reuse Mirror-era results as current evidence.

Document socket envelopes are generated from TypeBox. Use hello for session identity and get for state. There are no public mutation retry flags. After an unknown outcome run get before another edit; get flushes pending writes. Live CLI exports reuse the existing host capture flow; closed exports render owned snapshots. HITSLOP_NATIVE_CLI is the explicit helper override for document and template commands.

Resolve each document's runtimeContract and minRuntimeRevision before opening storage. Keep /__runtime__/ URLs stable and select runtimes/<contract> as their backing directory. SDK/Loro versions are provenance, not opening gates. Preserve shipped contract fixtures and use docs/versioning.md for release rules.

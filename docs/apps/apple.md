# Apple apps and Swift package

`apps/apple` contains the existing macOS app and the Swift 6 package in `Packages/HitSlopApple`. Preserve its client target graph.

- **HitSlopCore** validates packages, generated platform contracts, local paths, and copies.
- **HitSlopWasm** hosts the pinned JS/WASM document runtime, opaque SQLite storage, exclusive writer ownership, and per-document sockets.
- **HitSlopRuntime** integrates document sessions with the client and retains document creation and API infrastructure.
- **HitSlopHost** owns AppKit document windows, masks, toolbar, native capture, previews, and Finder icons.
- **HitSlopCatalog** and **HitSlopFeatures** preserve the local catalog, recents, and TCA client flows.
- **HitSlopFirebase** and **HitSlopRegistry** retain Firebase and generated OpenAPI integrations; hosted loading and sharing remain deferred.
- **HitSlopNativeCLI** reads, edits, creates, opens, and exports documents without requiring Node/Bun.

## Sessions and capture

Use the `open` factories for client flows. Each visible document owns one live Loro replica in its WebView. A closed-document CLI edit uses an engine-only invisible WebKit session with the same runtime and no authored app code. Swift never evaluates application schemas or maintains a second document engine.

The writer lock is authoritative. CLI mutations use the live owner's socket when busy, and acknowledge persistence before returning success. HitSlopHost attaches the live export callback without making HitSlopWasm depend on the renderer. See [CLI](../cli.md).

Normal close commits drafts and flushes before releasing ownership. Failed saves retain ownership and native retry UI. Await `closeAndWait()` before removing temporary packages. Successful close destroys the WebView; failed background teardown retains its snapshot.

Inline export/icon snippets share the existing document. Live export preserves transient view selection; closed export renders a disposable saved-state copy. Closing refreshes QuickLook previews and Finder icon metadata without rewriting the immutable icon asset. See [capture](../capture.md).

## Copies and local catalog

Templates under `~/.hitslop/templates` remain immutable masters. Create a writable copy to edit. Local catalog discovery and recents work offline. Agent skills are packaged and installed by the TypeScript CLI (`bun run skills:build`, then `bun slop skills`); the native app does not manage skill links. Synced folders, iCloud, hosted loading, sharing, and media import remain deferred.

## Development

```sh
bun run build
bun run swift:test
```

Build generates runtime resources, compiles the helper, then captures both active templates. `scripts/embed-hitslop-native.sh` embeds the helper and matching resource bundles. Signing, notarization, Sparkle, and store credentials remain local/CI secrets.

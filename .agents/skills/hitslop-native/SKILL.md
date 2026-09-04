---
name: hitslop-native
description: Work on hitSlop Apple hosting, local storage, iCloud coordination, template caching, previews, export, or the native CLI.
---

# hitSlop native host

- Apple Swift code belongs in `apps/apple/Packages/HitSlopApple`; keep the two
  Xcode app targets thin. AppKit-only code belongs in `HitSlopHost`,
  `HitSlopCatalog`, or `HitSlopNativeCLI`.
- `HitSlopRegistry` performs direct Firestore catalog subscriptions and records
  a creation through the Firebase callable Function only after a document is
  successfully created.
- `DocumentFactory` verifies SHA-256, caches hosted artifacts at
  `cache/<publisher>/<slug>/<release>.slop`, and copies locally. Never silently
  update an existing document.
- JSON is atomic. Every SQLite transaction stays on one connection. Both fixed
  stores are lazy and neither is declared by the manifest.
- Generated Swift manifest models and the bundled validation schema come from
  `bun run schema:generate`; never edit them directly.
- Capture a full `QuickLook/Preview.png` and produce an exact 512×512
  `QuickLook/Icon.png` unless the author supplies one. Documents may
  refresh only the preview; keep the icon immutable. Use macOS's built-in
  package handling for Quick Look. For Finder list rows, the host derives
  Finder-managed `Icon\r` metadata from the static icon when it creates or
  opens a local document. Accept that exact metadata in local documents but
  never include it in templates or published artifacts. Do not add Quick Look
  extensions.
- Skinned windows use an exact-size RGBA PNG as visible backing and mask, with
  10% alpha click-through and a transparent WebView.
- On iOS, surface iCloud coordination and flush failures; do not silently lose
  a store update.

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
- JSON replacement is atomic. The structured data store is lazy and is not
  declared by the manifest.
- Generated Swift manifest models and the bundled validation schema come from
  `bun run schema:generate`; never edit them directly.
- That command also generates bridge request validation, method/error enums,
  and the guest JavaScript bundle from the TypeScript protocol/runtime sources.
- Storage runs on a serial worker. Normal macOS close/quit must await the guest
  flush barrier. Mutable JSON/theme errors do not prevent the app shell opening;
  validate JSON at store access and retain the previous valid theme on failure.
- Document guidance is optional when opening and never exact-text validated.
- Capture a full `QuickLook/Preview.png` and produce an exact 512×512
  `QuickLook/Icon.png` unless the author supplies one. Documents may
  refresh the preview and optional authored Finder metadata on close; keep
  `QuickLook/Icon.png` immutable. Use macOS's built-in
  package handling for Quick Look. For Finder list rows, the host derives
  Finder-managed `Icon\r` metadata from the static icon when it creates or
  opens a local document. Accept that exact metadata in local documents but
  never include it in templates or published artifacts. Do not add Quick Look
  extensions.
- Skinned windows use an exact-size RGBA PNG as visible backing and mask, with
  10% alpha click-through and a transparent WebView.
- On iOS, surface iCloud coordination and flush failures; do not silently lose
  a store update.

- Background captures use disposable snapshots. Never
  point a rendering runtime at original writable stores. Interactive exports
  serialize and restore editor state; runtime capture preparation is shared JS.

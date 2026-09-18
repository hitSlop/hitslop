---
name: hitslop-native
description: Work on hitSlop Apple hosting, local storage, iCloud coordination, template caching, previews, export, or the native CLI.
---

# hitSlop native host

- Apple Swift code belongs in `apps/apple/Packages/HitSlopApple`; keep the macOS
  Xcode app target thin. AppKit-only code belongs in `HitSlopHost`,
  `HitSlopCatalog`, or `HitSlopNativeCLI`.
- Catalog clients use the generated oRPC/OpenAPI client for the Cloudflare API.
  D1 owns catalog metadata and creation counts; R2 owns immutable artifacts.
  Follow all pagination cursors and record a creation only after the document
  is successfully created. Firebase provides authentication and telemetry.
- `DocumentFactory` verifies SHA-256, caches hosted artifacts at
  `cache/<publisher>/<slug>/<release>.slop`, and copies locally. Never silently
  update an existing document.
- The command actor owns local JSON; Swift forwards shared commands to the room.
  Commit validated candidates and request receipts to
  `state/document.sqlite` before publication; `stores/data.json` is a revision
  envelope projection. Storage remains implicit in the manifest.
- Generated Swift manifest models and the bundled validation schema come from
  `bun run schema:generate`; never edit them directly.
- That command also generates bridge request validation, method/error enums,
  and the guest JavaScript bundle from the TypeScript protocol/runtime sources.
- JSON runs on the document actor with cross-process SQLite transactions; media
  and theme use the storage worker. Normal macOS close/quit must await the guest
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
- iOS is archived. Reject iCloud document locations before opening or creating
  writable documents; never copy projections without their SQLite state.

- Background captures use disposable snapshots. Never
  point a rendering runtime at original writable stores. Interactive exports
  serialize and restore editor state; runtime capture preparation is shared JS.

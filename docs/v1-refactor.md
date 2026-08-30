# Platform refactor implementation record

This refactor is intentionally breaking. hitSlop had not launched, so the old
Swift-owned package format and compatibility machinery were removed instead of
being carried into the foundation.

## What changed

- Reorganized the repository around `apps/`, publishable TypeScript packages,
  reusable Swift packages, and ordinary example authoring projects.
- Replaced Firebase/D1-era plans with Convex for catalog metadata and private
  Cloudflare R2 for content-addressed artifacts and screenshots.
- Added a TanStack Start public catalog and controlled artifact gateway.
- Moved authoring to `@hitslop/cli`; the native CLI is now only the small WebKit
  companion used for native development, screenshots, and PDF export.
- Added framework-neutral `@hitslop/runtime` and Svelte 5 helpers. A future
  React SDK can reuse the same bridge without changing `.slop`.
- Made Zod the single source of shared types, emitting committed JSON Schema
  and generated Swift `Codable` models through Quicktype.
- Rebuilt the macOS app as a thin catalog plus independent frameless document
  windows, restored hover controls, window dragging, custom alpha masks,
  external data refresh, export/share/duplicate actions, and editor/Finder
  actions.
- Added local template installation and discovery under
  `~/.hitslop/templates`, with transactional replacement and native previews.
- Added safe immutable hosted-template caching, SHA-256 verification, and
  local-only document creation.
- Added host-generated Finder thumbnails and Quick Look previews that never
  execute guest code.
- Added a cross-platform runtime layer used by the initial iOS/iCloud work.
- Added direct macOS release automation, Developer ID signing/notarization,
  Sparkle updates, and GitHub release workflows.

## Final authoring contract

Authors edit a normal Svelte/Vite project. `manifest.json` describes catalog
metadata, stores, and window presentation. It deliberately contains no package
version, runtime discriminator, entry path, store path, or release number.

```json
{
  "$schema": "https://hitslop.app/schemas/manifest.schema.json",
  "slug": "tiny-counter",
  "title": "Tiny Counter",
  "description": "Counts a very small thing.",
  "author": { "name": "Longtail Labs" },
  "categories": ["Widgets"],
  "stores": {
    "state": { "kind": "json", "maxBytes": 1048576 }
  },
  "window": {
    "width": 560,
    "height": 420,
    "resizable": true,
    "shape": { "kind": "roundedRect", "radius": 22 }
  }
}
```

The store key maps to `stores/state.json`. Build emits a source-free
`dist/tiny-counter.slop` with `app.html`. Install and publish render and embed
the Quick Look PNGs before hashing or distribution.

When a host duplicates the template, it adds this optional block to the same
manifest:

```json
{
  "document": {
    "id": "a-new-uuid",
    "template": {
      "publisherKeyId": "…",
      "release": 4,
      "artifactSha256": "…"
    }
  }
}
```

There is no `document.json`. Local templates without hosted lineage still get
the document UUID.

## Runtime and storage safety

The app validates every package before opening it. Runtime code is isolated
behind `slop://` and a restrictive content security policy. Guest code cannot
read the package directory; it can only request the generated HTML, stylesheet,
and assets. JSON and SQLite stay behind the bridge.

JSON writes are atomic and revision-aware. SQLite uses host-owned connections,
transaction boundaries, statement restrictions, and optional byte limits.
The host watches both store state and visual inputs: store changes emit scoped
SDK events, while HTML/style/asset changes reload the web view.

`SlopDuplicator` is the only template-to-document copy path. It captures
committed SQLite WAL data through the online backup API without mutating cached
templates, removes transient sidecars, and assigns a new identity.

## Template and release flow

Local authoring:

```text
slop dev → slop validate → slop build → slop install
```

Publishing:

```text
build + preview + deterministic ZIP
  → sign with local Ed25519 publisher key
  → TanStack/R2 gateway verifies envelope and bytes
  → Convex assigns the next immutable release
```

End-user creation:

```text
choose template
  → reuse or download verified cached release
  → choose a destination
  → duplicate locally and add manifest document identity
  → refresh Finder icon and open the frameless mini app
```

Publishing a later release affects only documents created afterward. The
future explicit updater must preserve compatible stores and use an atomic,
recoverable replacement; that operation is intentionally not faked today.

## Removed concepts

- Swift-bundled template sources and the old all-in-one Swift CLI.
- `.mjs` runtime/SDK files.
- `format: "hitslop/1"` and `runtime: "web"`.
- `build/index.html` inside runtime packages.
- Root-level `data.json`/`data.sqlite` and author-controlled store paths.
- Separate `document.json` provenance.
- Quick Look extensions that render a live WebView.
- Built-in templates privileged by the app binary.
- Automatic migration guidance for a product that had not shipped.

The current contract is documented normatively in
[architecture.md](architecture.md). This file records the scope and rationale
of the breaking reset.

# hitSlop architecture

## The document boundary

A `.slop` is a package directory and a complete runtime web app. It has one
source of metadata and identity: `manifest.json`.

```text
example.slop/
├── manifest.json
├── app.html
├── style.css                  optional editable overrides
├── assets/                    optional guest-readable assets
├── stores/
│   ├── state.json
│   └── library.sqlite
├── QuickLook/
│   ├── Preview.png
│   └── Thumbnail.png
└── AGENTS.md                  optional editing guidance
```

`app.html` is generated. Source, package manifests, dependencies, and build
caches never enter the runtime package. There is no format/runtime version,
authored entry path, authored store path, or separate `document.json`.

Manifest stores are a dictionary. The key is the bridge ID and determines the
path: `state: { kind: "json" }` means `stores/state.json`; SQLite uses
`stores/<id>.sqlite`. A template manifest has no `document`. The host adds a
fresh document UUID, plus optional immutable release lineage, to the manifest
when it creates a user document.

The window block owns initial width, height, optional resizing, and shape.
Rounded rectangles, circles, and capsules can resize. An image-masked window
must be fixed-size and references an exact-size alpha PNG under `assets/`.

## Guest and host responsibilities

Guest HTML runs in an ephemeral WebKit data store behind `slop://`. The scheme
serves only `app.html`, `style.css`, and `assets/`. It never exposes the
manifest, stores, SQLite sidecars, or Quick Look files.

The injected `window.slop` bridge is the only data boundary. It provides JSON
reads, atomic writes, SQLite queries/mutations/transactions, and store-scoped
change events. External JSON replacement or SQLite commits refresh reactive
data without reloading the page. Changes to HTML, CSS, or assets reload the
visual runtime.

The host creates `QuickLook/Preview.png` and `Thumbnail.png` after the guest
reaches its stable `ready()` boundary and after visible data changes. Finder's
thumbnail extension and Quick Look preview extension only read those PNGs;
neither extension executes guest code. The macOS host also refreshes the
package's custom Finder icon for immediate feedback.

## Schema pipeline

Zod 4 under `Packages/schema/src` is authoritative:

```text
Zod ── z.infer ──> TypeScript types and runtime validation
  └── z.toJSONSchema ──> committed JSON Schema
                           └── quicktype ──> Swift Codable models
```

Run `bun run schema:generate` after changing Zod. CI runs the drift check so
the JSON Schema and Swift models cannot silently diverge.

## Authoring and local installation

`@hitslop/cli` owns `slop init`, `dev`, `validate`, `build`, `install`, `pack`,
`screenshot`, and `publish`. Svelte is the first SDK, not part of the runtime
contract. `slop dev` uses isolated `.hitslop/dev` store copies and a browser
mock of the bridge; `--native` is available for WebKit-specific debugging.

`slop install` stages an explicitly local template as:

```text
~/.hitslop/templates/<slug>/
├── template.slop/
│   └── QuickLook/{Preview,Thumbnail}.png
└── install.json               artifact SHA-256 and install time
```

The install marker does not contain a version or repeat the fixed package
name. The catalog validates it, reads the same manifest used by hosted
templates, and duplicates `template.slop` to the chosen destination.

Hosted templates use a separate immutable cache keyed by publisher, slug, and
server-assigned release. The host downloads from the R2 gateway only when that
exact artifact is absent, verifies SHA-256, then duplicates locally. Convex is
not involved in creating or storing the user's document.

All copies go through `SlopDuplicator`. It makes the document writable,
snapshots SQLite with the online backup API so committed WAL data is included,
removes sidecars, and writes a fresh document identity. Existing documents are
never silently replaced when a template gains a new release.

## Platform layout

- `apps/catalog`: TanStack Start landing/catalog and private R2 gateway.
- `apps/registry`: Convex catalog metadata, immutable releases, and anonymous
  counters.
- `Packages/cli`, `Packages/runtime`, `Packages/schema`, `Packages/svelte`:
  publishable TypeScript authoring/runtime packages.
- `apps/macos/packages/HitSlopCore`: document validation, duplication, archive
  integrity, and generated shared models.
- `HitSlopRuntime`: cross-platform WebKit/storage/document creation and iCloud
  working-copy support.
- `HitSlopHost`: AppKit windows, masks, toolbar, rendering, previews, and the
  macOS catalog.
- `HitSlopRegistry`: read-oriented Convex Swift catalog access and anonymous
  telemetry.

Convex owns searchable metadata and counters; private R2 owns immutable bytes.
Publishing uses a local Ed25519 keypair, and Convex assigns release integers.
Users never manage versions or need an account to publish under their key.

## Future document updates

An explicit update must create a new sibling from the target cached release,
copy only stores whose ID and kind still match, validate it, and atomically
exchange it while retaining a backup. Store-kind changes require an explicit
migration. Until that exists, hitSlop exposes no unsafe update operation.

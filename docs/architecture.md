# hitSlop architecture

## One package, two optional stores

A `.slop` directory is a complete runtime web app. `manifest.json` describes
only catalog discovery and native presentation. `app.html` and `assets/` are
immutable after build. The only mutable package content is host-owned data, the
host-generated preview, and platform filesystem metadata. Thumbnail artwork is
captured once with the template and remains static.

```text
example.slop/
├── manifest.json
├── app.html
├── assets/                    optional
├── stores/
│   ├── data.json              optional and lazy
│   ├── data.sqlite            optional and lazy
│   └── data.sqlite-{wal,shm}  transient host sidecars
├── QuickLook/
│   ├── Preview.png            optional until first capture
│   └── Thumbnail.png          static package-time Finder image
└── Icon\r                     optional macOS-local Finder metadata
```

Templates never contain `stores/`. Documents may independently create the JSON
store, SQLite store, both, or neither. Fixed paths remove store IDs, path
configuration, kinds, byte limits, seed copying, and migration matching from
the manifest.

There is no `document.json` and no document identity or release lineage in the
manifest. Copying a template preserves the manifest byte-for-byte. A later
release affects only documents created from that release.

## Manifest and presentation

Every manifest requires the v1 `$schema` URL, publisher-scoped slug, title,
description, one or two controlled category IDs, and presentation dimensions.
Standard windows are resizable by default and support `rounded`, `ellipse`, or
`capsule`. A skin instead references an exact-size RGBA PNG under `assets/` and
is fixed-size.

The skin PNG is both the visible backing and native mask. The WebView remains
transparent, and pixels below 10% alpha pass pointer events through the window.
Quick Look capture preserves that silhouette.

## Guest boundary

Guest code runs in an ephemeral WebKit data store behind `slop://`. The scheme
serves only `app.html` and `assets/`; it never exposes the manifest, stores,
SQLite sidecars, or preview.

The bridge is deliberately ID-free:

```ts
slop.json.open(initial)
slop.json.read()
slop.json.write(value, expectedRevision?)
slop.json.onChange(callback)

slop.db.query(sql, parameters?)
slop.db.execute(sql, parameters?)
slop.db.transaction(statements)
slop.db.onChange(callback)

slop.window.resize({ width, height })
```

JSON replacement is atomic and revision-aware. Each SQLite transaction stays
on one host connection. There are no runtime store-size limits; publish and
archive boundaries enforce artifact limits instead.

Window resizing is host-owned. Standard documents may request a bounded size;
the host returns the applied dimensions. Manifest dimensions are the initial
size, while PNG-skinned documents remain fixed to their exact mask.

## Schema pipeline

Zod in `packages/schema/src` is authoritative for TypeScript validation. The
generation pipeline is:

```text
Zod → JSON Schema draft 2020-12 → Swift Codable models
                         └──────→ bundled Swift runtime validation
```

`bun run schema:generate` writes the committed JSON Schema, generated Swift
model, and bundled Swift schema resource. Generated Swift is never edited by
hand.

## Identity, publishing, and registry

The CLI keeps a local Ed25519 publisher key. Its key ID owns slugs in the
registry, so slug uniqueness is publisher-scoped rather than global. The
display name is editable and the identity can be encrypted for export/import.

Publishing builds, captures a full Quick Look preview, derives a maximum-512px
Finder thumbnail unless the author supplies one, creates one deterministic ZIP,
and signs an envelope containing its hash and size. The catalog gateway
verifies the signature, ZIP structure, expansion limits, package boundary,
manifest, skin, and two valid static images. It stores the immutable artifact in
R2 and derives the browser preview and manifest from those signed bytes. macOS
uses built-in package handling for Quick Look. After creating or opening a
local document, the host derives Finder's custom icon from the immutable
`Thumbnail.png`; Finder stores that as hidden `Icon\r` metadata inside the local
package. This metadata is accepted for documents but rejected from templates
and published artifacts. Convex assigns a monotonically increasing release
number.

Convex stores publisher identities, templates, releases, idempotent publish
requests, and one aggregate `creations` counter. It does not track downloads,
installs, favorites, devices, or local documents. The counter increments only
after a host successfully creates a document.

## Local installation and hosted cache

```text
~/.hitslop/templates/
├── <slug>.slop
└── cache/<publisher-key>/<slug>/<release>.slop
```

Local installs are replaceable templates at the templates root. Hosted cache
entries stay nested, immutable, and verified by SHA-256 before use. Catalog
masters are not writable at rest; creating a document copies one and then
makes the copy writable. There are no wrappers, install markers, sidecars, or
`current` pointers. All creation paths duplicate the validated template to a
user-selected destination; Convex never creates or stores it. Anything under
`~/.hitslop/templates` is a catalog input, never a user document.

On iOS, local documents live in the user's iCloud container. The runtime uses a
working copy and explicitly flushes the two canonical stores back to iCloud,
surfacing coordination failures to the UI.

## Package layout

- `apps/apple`: one Xcode project with thin iOS and macOS application targets.
- `apps/apple/Packages/HitSlopApple`: Core, Runtime, Registry, AppKit Host,
  Catalog, and native CLI targets shared through one SwiftPM dependency graph.
- `apps/catalog`: public TanStack catalog and private R2 publish gateway.
- `apps/registry`: Convex metadata and live catalog subscriptions.

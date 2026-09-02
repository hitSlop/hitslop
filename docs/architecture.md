# Architecture

hitSlop separates an immutable web application from mutable, host-owned
document data. That one boundary lets a tiny app remain framework-neutral while
native hosts provide reliable persistence, windows, preview, export, and cloud
coordination.

```text
author source ──CLI build──> immutable .slop template
                                  │
                        copy to user-selected path
                                  ▼
                         writable .slop document
                                  │
             WebView bridge ◀──── host ────▶ JSON / SQLite / media
                                  │
                           preview and export

publish ──signed ZIP──> Catalog gateway ──artifact──> R2
                              │
                              └──metadata──> Convex registry
```

## Trust boundaries

The guest WebView is untrusted package code. It runs in an ephemeral WebKit data
store behind the `slop://` scheme, which serves only `app.html` and
`assets/`. It cannot resolve the manifest, stores, SQLite sidecars, Quick Look
images, or arbitrary file URLs.

The native host validates the manifest before loading, exposes a narrow message
bridge, validates media by content, and owns every filesystem mutation. JSON is
atomically replaced with an expected-revision check. SQLite transactions remain
on one connection. Named media replacement is atomic.

The publish gateway treats the submitted ZIP as hostile. It verifies the
Ed25519 envelope, hash and byte count; rejects unsafe paths, duplicates,
symlinks, encryption, unsupported compression, excessive entry counts and
expansion; validates the manifest, package allowlist, PNGs, and exact RGBA skin
dimensions; then stores content-addressed immutable bytes.

## Template, cache, document

These three things must never be confused:

- A built or published **template** is immutable and contains no stores.
- A **catalog master** under `~/.hitslop/templates` is immutable input. Hosted
  entries live at `cache/<publisher>/<slug>/<release>.slop` and are verified by
  SHA-256.
- A **document** is a copy at a user-selected path. Only the copy may create or
  change `stores/`, refresh `QuickLook/Preview.png`, or gain Finder metadata.

Convex stores catalog metadata, never a local document. A new release does not
mutate existing documents.

## Browser bridge

The framework-neutral API is deliberately ID-free:

```ts
slop.json.open(initial)
slop.json.read()
slop.json.write(value, expectedRevision?)
slop.json.onChange(callback)

slop.db.query(sql, parameters?)
slop.db.execute(sql, parameters?)
slop.db.transaction(statements)
slop.db.onChange(callback)

slop.media.open(name)
slop.media.write(name, base64, mimeType)
slop.media.remove(name)
slop.media.onChange(callback)

slop.window.resize({ width, height })
slop.window.drag()
```

`@hitslop/runtime` exposes this contract. Svelte and React packages adapt it
to their reactive models; they do not define a second persistence system.

## Schema pipeline

Zod under `packages/schema/src` is authoritative:

```text
Zod → JSON Schema draft 2020-12 → Swift Codable models
                         └──────→ bundled Swift validation resource
```

Run `bun run schema:generate` after schema changes. Generated output is
committed and CI rejects drift.

## Capture and export

The native renderer uses a separate hidden WebView. It marks the root with
capture state, waits for `slop.ready()`, layout settlement, and a short font/
paint buffer, then captures. Preview preserves manifest dimensions. PNG and PDF
exports use current width and full document height; PNG is deterministic 2× and
PDF retains WebKit text/vector output.

An optional renderer-only `icon` target is 512×512. Finder and compact catalog
rows use the icon; catalog detail uses the full preview. See
[Design and presentation](presentation.md).

## Platform topology

- [Apple apps](apps/apple.md) own documents and native presentation.
- [Catalog gateway](apps/catalog.md) owns hostile artifact ingress and R2 egress.
- [Registry](apps/registry.md) owns searchable metadata and release numbering.
- [Packages](packages.md) provide authoring and browser APIs.

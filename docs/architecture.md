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
             WebView bridge ◀──── host ────▶ JSON / SQLite / media / theme
                                  │
                           preview and export

publish ──signed ZIP──> Firebase Function ──artifact──> Cloud Storage
                              │
                              └──metadata──> Firestore
```

## Trust boundaries

The guest WebView is untrusted package code. It runs in an ephemeral WebKit data
store behind the `slop://` scheme, which serves `app.html`, immutable `assets/`,
named media, and the dedicated writable theme override endpoint. It cannot
resolve the manifest, arbitrary stores, SQLite sidecars, Quick Look images, or
arbitrary file URLs.

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

Firebase stores public catalog metadata and immutable published artifacts,
never a local document. A new release does not mutate existing documents.
The public `templates` collection carries a nested current-release projection so
native clients never join against private release history. Successful document
copies increment a lifetime popularity counter; release updates preserve that
counter and the template's original publication time.

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

Browser `slop dev` injects a disposable in-memory implementation of this
contract for UI work. It has no disk-backed bridge or polling. On macOS, built
documents use FSEvents to wake revision checks after external file changes.

## Schema pipeline

Zod under `packages/schema/src` is authoritative for the shared manifest and
publish protocol:

```text
Zod → JSON Schema draft 2020-12 → Swift Codable models
                         └──────→ bundled Swift validation resource
```

Run `bun run schema:generate` after schema changes. Generated output is
committed and CI rejects drift.

Each Svelte app with a JSON store also default-exports its data schema from root
`schema.ts` and attaches it to `jsonStore({ schema, initial })`. The CLI emits
that app-specific contract as `data.schema.json` during build.

Every new build also embeds one immutable, canonical Agent Skill at
`.agents/skills/hitslop-document`. It teaches compatible agents the package
boundary and safe direct-file workflows. A publisher may add only one bounded
Markdown reference through source `document-guide.md`; scripts, extra skills,
and arbitrary resources are rejected.

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
- [Firebase backend](apps/firebase.md) owns hostile artifact ingress, immutable
  Storage objects, public catalog metadata, and release numbering.
- [Packages](packages.md) provide authoring and browser APIs.

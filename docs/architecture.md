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
             WebView bridge ◀──── host ────▶ JSON / media / theme
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
resolve the manifest, arbitrary stores, Quick Look images, or
arbitrary file URLs.

The native host validates the manifest before loading, exposes a narrow message
bridge, validates media by content, and owns every filesystem mutation. JSON is
atomically replaced with an expected-revision check. Named media replacement is
atomic.

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

slop.media.open(name)
slop.media.write(name, base64, mimeType)
slop.media.remove(name)
slop.media.onChange(callback)

slop.window.resize({ width, height })
slop.window.drag()
```

`@hitslop/runtime` exposes this contract. The Svelte package adapts it
to its reactive model; it does not define a second persistence system.

`packages/schema/src/bridge.ts` defines the wire requests, reply envelope,
error codes, host information, and change events. One
`BridgeMethods` registry pairs parameter and result schemas for each method.
JavaScript calls infer their result from the method and validate the
reply envelope and method-specific value before returning it. Generation emits
the native request schema, Swift method/error enums, and the browser bridge
bundle. The Apple host validates every request before dispatch. Storage runs
on a serial worker, while WebKit and window operations remain on the UI actor.
`hostInfo()` reports protocol version and capabilities; errors expose a stable
`code`. `flush()` waits for registered framework stores and bridge writes.

Browser `slop dev` injects a disposable in-memory implementation of this
contract for UI work. It has no disk-backed bridge or polling. On macOS, built
documents use FSEvents to wake revision checks after external file changes.

## Schema pipeline

TypeBox under `packages/schema/src` is authoritative for the shared manifest and
publish protocol:

```text
TypeBox → JSON Schema draft 2020-12 → Swift Codable models
                         └──────→ bundled Swift validation resource
```

Run `bun run schema:generate` after schema changes. Generated output is
committed and CI rejects drift.

Each Svelte app with a JSON store also default-exports its data schema from root
`schema.ts` and attaches it to `jsonStore({ schema, initial })`. The CLI emits
that app-specific persisted-value contract as `data.schema.json` during build.
The native host and CLI validate it without coercion or field removal.

Every new build also embeds one immutable Agent Skill at
`.agents/skills/hitslop-document`. It teaches compatible agents the package
boundary and safe direct-file workflows. A publisher may add only one bounded
Markdown reference through source `document-guide.md`; scripts, extra skills,
and arbitrary resources are rejected by authoring validation. Guidance is
optional when opening a document; its contents are not compared with the host's
current copy.

The CLI and macOS app also install the current `hitslop-authoring`,
`hitslop-design`, and `hitslop-document` skills into `~/.hitslop/skills` and
link those names into `~/.agents/skills` and `~/.claude/skills`. That machine
cache is the updatable source of truth for coding agents; runtime packages still
embed `hitslop-document` so a copied `.slop` stays self-describing.

The app refreshes once per app version; CLI initialization only fills missing
skills, and `slop skills sync` explicitly replaces the bundle. Both installers
stage the complete tree before activation and use an OS file lock to serialize
replacement. A sibling backup restores the previous installation after failed
or interrupted activation. Discovery links never replace user directories or
unrelated links. Installation errors do not block documents or source creation.
Global document guidance resolves app-specific instructions inside the target
`.slop`, not inside its own installation directory.

## Capture and export

Background capture uses a hidden WebView with a disposable package snapshot.
Interactive export uses the current session, serializes capture, and restores
editor state. A shared runtime controller prepares optional Svelte capture views,
awaits assets and stable layout, and retains the existing static CSS fallback.
Preview and icon failures are independent; Finder metadata refreshes on close.
See [Capture views](capture.md) for authoring, dimensions, and limits.

## Platform topology

- [Apple apps](apps/apple.md) own documents and native presentation.
- [Firebase backend](apps/firebase.md) owns hostile artifact ingress, immutable
  Storage objects, public catalog metadata, and release numbering.
- [Packages](packages.md) provide authoring and browser APIs.

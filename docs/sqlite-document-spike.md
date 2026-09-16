# Single-file SQLite document experiment

Status: working isolated macOS prototype, verified September 15, 2026.
Production `.slop` documents still use the existing package format. This experiment
uses **`.slopsql`**, a regular SQLite file, and a separate **SQLite Document Lab** app.

## Result

The document can carry its compiled application, data, shared theme, preview, and
icon in one file. Finder custom icons regenerate, and Quick Look reads the stored
PNG without opening the application or running its JavaScript.

Verified on macOS 26.6.2, Apple silicon, Xcode 26.6:

| Check | Observed result |
| --- | --- |
| Real Quick Checklist Svelte application | Opened directly from SQLite through a WebKit resource scheme |
| Data + theme change | 1/3 done, blush → 3/3 done, mint; both preview and icon changed |
| Finder custom icon | Same fixture path changed visibly from pink A to blue B; database bytes unchanged by `setIcon` |
| Finder Space preview | Loaded both the fixture and real checklist from embedded PNGs |
| Copy without Finder icon metadata | Quick Look still displayed the checklist and shared theme |
| System thumbnail extension | `QLThumbnailGenerator` returned `.thumbnail` (type 2), 512×512, matching embedded artwork |
| Real edit + close | Changed copied checklist to blush and 2/3 done; close completed, Finder icon refreshed, and reopened Quick Look showed the new state |
| Closed-file move + rename | Copied SQLite, moved/renamed the file, then successfully rendered generation 2 from its new path |
| Native Loro | Renderer made zero platform WASM calls |
| Storage | Four tests passed: rejected saves/retries, theme merge/reset, stale data baseline, backup/generation guards |
| Killed writer | Recovery preserved the entire confirmed document row and outbox after a forced mid-transaction kill |

Measured complete data/theme edit plus two captures and verification: **0.663 s**
on this machine. The resulting main database was **647,168 bytes**, preview PNG
217,708 bytes, icon PNG 23,825 bytes. This is one local measurement, not a benchmark.
Finder reports additional size for custom-icon filesystem metadata.

Evidence: [runtime result](experiments/sqlite-document/runtime.json),
[before preview](experiments/sqlite-document/before-preview.png),
[after preview](experiments/sqlite-document/after-preview.png),
[system thumbnail](experiments/sqlite-document/system-thumbnail.png),
[preview after interactive editing/close](experiments/sqlite-document/after-close-preview.png),
and [crash recovery result](experiments/sqlite-document/crash.json).

## What gets bundled

Keep authoring in ordinary Svelte/TypeScript/Vanilla Extract files. The existing
build compiles them to HTML, JavaScript, and CSS. Store that generated asset graph
inside SQLite, retaining relative resource paths:

| Table | Contents |
| --- | --- |
| `sqlar` | Immutable `app.html`, manifest, generated schema, compiled JS/assets, default theme CSS, embedded guidance, fallback artwork |
| `document` | Identity, generation, Loro checkpoint, confirmed JSON projection, shared theme projection, revision, receive cursor |
| `outbox` | Ordered Loro updates with IDs and SHA-256 hashes |
| `artwork` | Derived preview/icon PNGs and the generation they represent |

`app.html` contains generated structural CSS; JavaScript remains a compiled asset.
`assets/theme.css` contains immutable authored theme defaults. No `.svelte` source,
`node_modules`, build cache, or separate editable stylesheet is required to run it.
The experiment uses the existing native-Loro prepared build and its initial-data
asset to seed a document; this is not yet a general production artifact converter.

**Recommendation: single-file delivery, with the existing internal bundle graph.**
There is no need to concatenate all code, fonts, and images into one HTML string.
WebKit resolves `slopsql://document/...` resources directly from SQLite; no temporary
asset extraction is needed. The spike implements uncompressed `sqlar` rows only.

## Shared theme with Loro

The Loro root has separate `content` and `theme` fields. `content` follows the
authored document schema; `theme` is a map of declared `--slop-*` token overrides.
Independent token changes merge independently. Same-token concurrent changes use
Loro's deterministic conflict resolution. Reset deletes overrides, revealing the
immutable defaults. There is no personal/private theme layer in this version.

Theme values are validated against the authored token names, length and syntax
constraints, and known variable references. The host serves a generated `theme.css`
projection after the defaults. A data edit based on an older revision retains its
historical theme baseline, so it cannot accidentally revert a newer theme change.

Each edit stages a candidate replica. One SQLite transaction saves the checkpoint,
data/theme projections, generation, and outgoing updates; only then does the host
publish a confirmed frame. Rejected edits leave the live replica and outbox intact.
Repeated requests return their previous success or failure, and later edits can
continue after a rejected save.

## Finder and artwork

The host takes a SQLite backup snapshot, renders the existing Svelte `ExportTarget`
and `IconTarget` views in a disposable WebKit instance, and stores PNGs only if the
document generation still matches. Background capture follows a two-second idle
delay. Close flushes editing and refreshes artwork; failed capture keeps the last
good artwork and does not discard durable data.

The icon is exactly 512×512. The preview uses the current export view at a 480×620
logical viewport (960×1240 pixels on the tested display). Shared theme overrides
apply to editor, export view, preview, and icon. PNGs are derived local caches,
outside Loro; peers regenerate them from shared state.

The separate sandboxed Quick Look extensions open SQLite read-only and return the
embedded images. `NSWorkspace.setIcon` adds local Finder metadata; losing that
metadata during copying does not lose the embedded preview/thumbnail. Finder may
decorate an extension-generated thumbnail differently from a custom file icon.

Initial integration failure: the preview registration omitted
`QLIsDataBasedPreview: true`. macOS tried to instantiate a view controller and
asserted. Adding the flag and refreshing the development extension registration
fixed it. See [Apple's QLPreviewProvider requirements](https://developer.apple.com/documentation/quicklookui/qlpreviewprovider).
Normal document icon updates required neither a Finder restart nor cache reset.

## Run it

From the repository root, with Bun, Swift/Xcode, and the existing package
dependencies available:

```sh
bun scripts/sqlite-lab/run.ts
```

This prepares the native-Loro checklist, builds/tests the spike, creates a fresh
document, exercises WebKit/data/theme/artwork, and runs the killed-writer test.
Each run writes a new directory under `.hitslop/sqlite-lab/`.

For Finder integration, generate and sign the isolated app. Set
`LAB_SIGNING_IDENTITY` to an installed signing identity (a certificate hash works)
and `LAB_TEAM` to its team. The project defaults match this repository's team.

```sh
xcodegen generate --spec apps/apple/SQLiteDocumentLab/project.yml
xcodebuild -project apps/apple/SQLiteDocumentLab/SQLiteDocumentLab.xcodeproj \
  -scheme SQLiteDocumentLab -configuration Debug \
  -derivedDataPath .hitslop/sqlite-lab/DerivedData \
  CODE_SIGN_STYLE=Manual DEVELOPMENT_TEAM="$LAB_TEAM" \
  CODE_SIGN_IDENTITY="$LAB_SIGNING_IDENTITY" build
pluginkit -a .hitslop/sqlite-lab/DerivedData/Build/Products/Debug/SQLiteDocumentLab.app/Contents/PlugIns/SQLitePreview.appex
pluginkit -a .hitslop/sqlite-lab/DerivedData/Build/Products/Debug/SQLiteDocumentLab.app/Contents/PlugIns/SQLiteThumbnail.appex
```

Open a generated `.slopsql` with **SQLiteDocumentLab.app**, change tasks or use the
Mint/Blush/Reset theme controls, close, then press Space on the file in Finder.
The app is a development build, not a notarized distribution.

Additional commands:

```sh
apps/apple/Packages/HitSlopApple/.build/debug/hitslop-sqlite-spike open path/to/Checklist.slopsql
apps/apple/Packages/HitSlopApple/.build/debug/hitslop-sqlite-spike capture path/to/Checklist.slopsql
/usr/bin/swift scripts/sqlite-lab/thumbnail.swift path/to/Metadata-stripped.slopsql /tmp/thumbnail.png
```

Use `QLThumbnailGenerator` for the extension check; the legacy `qlmanage -t` probe
did not complete in this session.

## Limits and next decision

- This proves the container, rendering, shared-theme model, and Finder path. It
  does not migrate production `.slop` documents, catalog signing, or publishing.
- Native Loro and its bridge reuse the existing experimental implementation.
  Two-replica tests exchange updates directly; no production collaboration service
  or iCloud/Dropbox concurrent-writing support is added.
- SQLite uses DELETE journaling, FULL synchronization, and fullfsync. It is one
  file **at rest**; temporary journal files can exist during writes or recovery.
  Active snapshots use SQLite backup, not raw copying of an open database.
- A second writer with stale state is rejected and must reopen. File coordination,
  replacement detection, moving an open document, and cloud conflict UX need
  production design. Renaming a closed file does not alter its embedded content.
- Immutable assets are supported; mutable attachments/media APIs, schema upgrades,
  large-document limits, optimized incremental checkpointing, and general export
  commands remain future work. Every edit currently stores a complete checkpoint.
- Extensions read bounded stored PNG blobs; this is a prototype, not a completed
  hostile-document security review. Ordinary SQL inspection is possible, but raw
  writes to projections cannot replace a valid Loro transaction.

The next product step is a versioned format/migration proposal. The experiment
supports switching delivery to a flat file while retaining the current authoring
and compilation model.

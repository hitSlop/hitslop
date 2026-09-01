# hitSlop

hitSlop is a native home for tiny, local-first web apps. A `.slop` is a
self-contained runtime app whose JSON, SQLite, and named media data is owned by the host.
Svelte is the first authoring SDK; the runtime contract is framework-neutral.

```text
apps/
├── catalog/        TanStack Start catalog and private R2 gateway
├── apple/          one Xcode project plus the app-local Apple Swift package
└── registry/       Convex publishers, templates, releases, and creation counts
packages/
├── cli/            @hitslop/cli (`slop`)
├── runtime/        framework-neutral browser bridge
├── schema/         Zod, generated JSON Schema, and generated Swift models
└── svelte/         Svelte 5 JSON, SQLite, and image helpers
```

## Author a slop

```sh
bun install
bunx @hitslop/cli init my-widget --template svelte-counter
cd my-widget
bun install
slop dev
slop build
slop install
slop publish
```

`slop dev` uses isolated lazy stores under `.hitslop/dev/stores/`. `slop build`
emits a source-free `dist/<slug>.slop`. Install and publish capture a full
`QuickLook/Preview.png` and derive a static, maximum-512px
`QuickLook/Thumbnail.png`; pass `--thumbnail <png>` to supply custom Finder
artwork. Publish signs one immutable ZIP artifact.

`slop install` writes a read-only catalog master at
`~/.hitslop/templates/<slug>.slop`. Create and test writable documents through
**My Templates** in hitSlop, or by opening that master — the app copies it to a
path you choose. Document stores are created only in the copy, so station
choices, uploaded media, and other personal state never seed the next document.

Static captures set `data-slop-capture="static"` on the document root. Mark
editing-only controls with `data-slop-export="hide"`; the host omits them from
PNG, PDF, Quick Look, and catalog imagery. Preview imagery keeps the manifest
viewport, while PNG/PDF exports use the current width and full document height.
PNG exports render at deterministic 2x resolution; PDFs retain selectable text
and WebKit vector rendering on one full-height page.
Keep content that must export in normal document flow rather than a nested
scroll region.

The manifest is intentionally small:

```json
{
  "$schema": "https://hitslop.app/schemas/v1/manifest.schema.json",
  "slug": "tiny-counter",
  "title": "Tiny Counter",
  "description": "Counts a very small thing.",
  "categories": ["utilities", "personal"],
  "presentation": { "width": 560, "height": 420 }
}
```

Categories are controlled IDs and a manifest has one or two: `productivity`,
`utilities`, `finance`, `media`, `games`, `developer-tools`, `education`,
`business`, `personal`, or `other`.

Runtime packages contain generated visuals and optional host data:

```text
my-widget.slop/
├── manifest.json
├── app.html
├── assets/                    optional immutable assets
├── stores/
│   ├── data.json              optional, created lazily
│   ├── data.sqlite            optional, created lazily
│   └── media/                 optional named media, created lazily
├── QuickLook/
│   ├── Preview.png            host-generated Quick Look/catalog image
│   └── Thumbnail.png          immutable author-controlled artwork
└── Icon\r                     optional macOS-local Finder metadata
```

A slop may use JSON, SQLite, named media, any combination, or none. Named media accepts supported
images and bounded ZIP archives, is content-sniffed by the host, and is created lazily. The manifest does not declare
storage. There is no document identity, release lineage, author, tags, runtime
version, entry path, editable stylesheet, or seed data in the package format.
On macOS, hitSlop derives Finder's hidden custom-icon metadata from
`Thumbnail.png` after creating or opening a local document. That metadata is
never part of a template or published artifact.

Publisher ownership is external to the manifest. `slop publish` creates a local
Ed25519 identity; the registry makes `(publisher key, slug)` unique. Use
`slop identity show`, `set-name`, `export`, and `import` to manage that identity.

## Work on this repository

```sh
bun install
bun run build
bun run check
bun run test
swift test --package-path apps/apple/Packages/HitSlopApple
swift build --package-path apps/apple/Packages/HitSlopApple --product hitslop-native
```

After changing Zod, run `bun run schema:generate`. JSON Schema is the portable
boundary; the generator derives both the committed schema and Swift Codable
models from it. CI rejects generated drift.

See [docs/architecture.md](docs/architecture.md) for the complete runtime,
publishing, cache, and iCloud boundaries.

## Release the macOS app

The app is distributed directly with Developer ID and Sparkle. Versioning lives
in `apps/apple/project.yml` under `hitSlop-macOS`: `MARKETING_VERSION` is user-facing semver,
and `CURRENT_PROJECT_VERSION` is a monotonic build integer.

```sh
scripts/install-macos-release.sh
scripts/package-macos-release.sh
```

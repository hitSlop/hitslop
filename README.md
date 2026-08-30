# hitSlop

hitSlop is a native macOS home for tiny, local-first web apps. A `.slop` is a
self-contained runtime package with host-owned JSON or SQLite data.
Svelte is the first authoring SDK, but the runtime contract is framework-free.

```text
apps/
├── catalog/        TanStack Start catalog + private R2 gateway
├── macos/          thin app, Quick Look, and native Swift packages
└── registry/       Convex catalog, releases, and anonymous telemetry
packages/
├── cli/            @hitslop/cli (`slop`)
├── runtime/        framework-neutral host bridge
├── schema/         Zod source, JSON Schema, generated Swift Codable models
└── svelte/         Svelte 5 JSON/SQLite helpers
examples/slops/     six maintained, publishable Svelte templates
archive/templates/  paused templates kept for later repair
```

## Develop a slop

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

`slop dev` opens a normal browser with a mock `window.slop` bridge and isolated
stores under `.hitslop/dev/`. `slop dev --native` opens the same dev server in
the native host. `slop build` emits a source-free runtime directory under
`dist/<slug>.slop`; publishing assigns the next release number automatically.
In an interactive terminal, `slop init` asks for the manifest title,
description, author, and one or two categories; flags and `--yes` support CI.

`slop install` builds and validates the template, captures a fresh native
preview, and installs it at `~/.hitslop/templates/<slug>/`. The macOS catalog
discovers these local templates without Convex and duplicates the installed
seed when you create a document. Existing installs require confirmation or
`--force`; `--screenshot cover.png` supplies a preview without invoking the
native screenshot helper.

The runtime contract is intentionally small:

```text
my-widget.slop/
├── manifest.json              metadata, stores, window, document identity
├── app.html                   generated single-file web app
├── style.css                  optional user-editable overrides
├── assets/                    optional guest-readable assets
├── stores/<id>.json|sqlite    host-owned local data
└── QuickLook/                 host-generated Preview.png + Thumbnail.png
```

There is no runtime/version field, authored store path, `document.json`, or
`build/` directory. The host adds document identity to the copied manifest.

The CLI package is `@hitslop/cli`; installing it exposes the `slop` executable.
The unscoped `slop` npm name is owned by another project, so the one-shot form is
`bunx @hitslop/cli` (or `npx @hitslop/cli`).

## Work on this repository

```sh
bun install
bun run build
bun run check
bun run test
```

Initialize or reconnect the Convex deployment from the registry app:

```sh
cd apps/registry
bunx convex dev
```

This repository is already connected to the `hitslop` development deployment.
Secrets are documented in [.env.example](.env.example) and
[apps/catalog/.dev.vars.example](apps/catalog/.dev.vars.example); real values
stay in ignored `.env.local`/`.dev.vars` files and Convex environment variables.

See [docs/architecture.md](docs/architecture.md) for the package, R2 cache,
release, and document-update boundaries.

The full implementation record is in
[docs/v1-refactor.md](docs/v1-refactor.md).

## Native packages

The latest native dependency floors are Convex Swift `0.8.1`, ZIPFoundation
`0.9.20`, and Swift Argument Parser `1.8.2`.

```sh
swift test --package-path apps/macos/packages/HitSlopCore
swift build --package-path apps/macos/packages/HitSlopRegistry
swift build --package-path apps/macos/packages/HitSlopHost
swift build --package-path apps/macos/packages/HitSlopNativeCLI

cd apps/macos/hitSlop
xcodegen generate
xcodebuild -scheme hitSlop -configuration Debug build
```

## Release the macOS app

Direct Developer ID distribution — there is no Mac App Store listing. Sparkle
checks `https://github.com/hitSlop/hitslop/releases/latest/download/appcast.xml`.

Versioning lives in `apps/macos/hitSlop/project.yml`:

| Field | Meaning |
| --- | --- |
| `MARKETING_VERSION` | User-facing semver (`1.0.0`). Git tag is `v1.0.0`. |
| `CURRENT_PROJECT_VERSION` | Monotonic integer Sparkle compares. Never reuse. |

```sh
# Local unsigned-to-Developer-ID install (this Mac only)
scripts/install-macos-release.sh

# Universal signed, notarized DMG (needs App Store Connect API key)
scripts/package-macos-release.sh
```

Pushing a `v*` tag on the default branch runs `.github/workflows/macos-release.yml`,
which publishes the DMG, zip, and Sparkle appcast to GitHub Releases. Signing
uses **Mushroom DAO Holdings Corp.** (`78UAXU8QG8`). You do not need an App Store
Connect app record for this; notarization uses the API key only.

GitHub Actions secrets: `MACOS_CERTIFICATE`, `MACOS_CERTIFICATE_PASSWORD`,
`KEYCHAIN_PASSWORD`, `ASC_API_KEY_P8`, `ASC_API_KEY_ID`, `ASC_API_ISSUER_ID`,
`SPARKLE_PRIVATE_KEY`.

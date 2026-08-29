# hitSlop

hitSlop is a native macOS home for tiny, local-first web apps. A `.slop` is a
self-contained `hitslop/1` runtime package with host-owned JSON or SQLite data.
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
examples/slops/     four maintained, publishable Svelte templates
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
slop publish
```

`slop dev` opens a normal browser with a mock `window.slop` bridge and isolated
stores under `.hitslop/dev/`. `slop dev --native` opens the same dev server in
the native host. `slop build` emits a source-free runtime directory under
`dist/<slug>.slop`; publishing assigns the next release number automatically.
In an interactive terminal, `slop init` asks for the manifest title,
description, author, and one or two categories; flags and `--yes` support CI.

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

# Releasing

## Version policy

The macOS release candidate is `1.0.5` (build `23`). The npm platform packages
use `0.3.x` for JSON persistence improvements and the adapter error callback
change. The iOS app is archived.
Do not force unrelated products to share one version.

## Local gate first

Run `bun run test:local` and inspect its artifacts before creating release builds
or publishing npm packages. See [Local testing](local-testing.md). It uses Debug
native binaries and temporary local services; packing tarballs does not publish them.

## Release gate

From a clean checkout with Bun **1.4.0** (the root `packageManager` version) and
Xcode installed. Use that exact Bun version for generation and release checks:
the bundled bridge's minified output changes between Bun versions.

```sh
bun install --frozen-lockfile
bun run release:check
```

The gate checks repository hygiene, generated schema drift, the public npm
packages, the Cloudflare Worker's hostile-package boundary, a clean-room tarball install,
and Swift tests/build. On macOS it also builds and renders with a relocated Release
helper after removing its SwiftPM build directory, verifying both embedded
resource bundles. CI runs the same first-launch boundary.

Backlog examples are deliberately excluded. `bun run examples:check` must pass
for the active Quick Checklist example. The npm gate tests both a fresh starter
and Quick Checklist from packed dependencies.

Inspect `git status --short` afterward. Generated package `dist/` directories
are cleaned before every build so stale deleted exports cannot enter npm.

## npm packages

Run the focused npm foundation gate before publishing. It validates and packs
the five public packages, installs their real tarballs outside the monorepo,
tests the Cloudflare package-ingress boundary, and creates a fresh Svelte project
through the complete init/check/build/validate path. Generated-file drift fails
the gate instead of being silently regenerated:

```sh
bun run release:npm:check
```

On macOS, set `HITSLOP_NATIVE_CLI` to a freshly built helper to also run the
starter save/reopen test and capture preview, icon, PNG, and PDF from packed
packages. All documents are disposable copies. Set `HITSLOP_KEEP_RELEASE_TEMP=1`
to retain the printed temporary directory for visual inspection and debugging.

Publish in dependency order:

1. `@hitslop/schema`
2. `@hitslop/api`
3. `@hitslop/runtime`
4. `@hitslop/svelte`
5. `@hitslop/cli`

Use `bun pm pack --dry-run` in every package before publishing. Verify the
tarball includes only `dist`, permitted templates/generated schema,
`package.json`, `README.md`, and `LICENSE`; confirm repository metadata,
MIT license, and intended `0.3.x` version.

The initial v1 format uses command/snapshot sync, SQLite/bridge/room version 3 and projection envelope version 2,
and `hitslop-publish/1`. There is no pre-release data migration. Rebuild authored
templates for the matching host; preserve unsupported old documents separately.

Tag npm releases as `npm-v<version>` and macOS releases as
`macos-v<version>`. The separate namespaces keep an npm-only release from
starting the signed macOS release workflow.

## Hosted services

Deploy the API Worker, generated schema, D1 migrations, R2 binding, and SQLite
Durable Object class from `apps/cloudflare`. Point `api.hitslop.com` at that
Worker; the static Astro Worker remains at `hitslop.com`.

Cloudflare Workers Builds connects `hitslop-landing` to `hitSlop/hitslop`, with
production branch `master`, repository root `/`, and `BUN_VERSION=1.4.0`.
The build command is:

```sh
bun run --cwd packages/schema build && bun run --cwd apps/landing check && bun run --cwd apps/landing build
```

The deploy command is `cd apps/landing && npx --no-install wrangler deploy`.
Deploy compatible Cloudflare API changes before pushing the landing update. After
pushing `master`, verify both GitHub CI and the Cloudflare deployment for that
commit. Preview builds are disabled for the MVP release.

## macOS

The initial desktop release is Apple silicon only (arm64) and requires macOS
14 or newer. The release script rejects a main executable or embedded native
helper containing any other architecture. Do not advertise an Intel download;
if Intel support becomes a product requirement, add and test it as a separate
artifact rather than silently changing the shipped binary.

Versioning lives under the macOS target in `apps/apple/project.yml`:
`MARKETING_VERSION` is user-facing semver and `CURRENT_PROJECT_VERSION` is a
monotonic build integer.

```sh
scripts/install-macos-release.sh
scripts/package-macos-release.sh
```

Developer ID, notarization, App Store Connect `AuthKey_*.p8`, provisioning
profiles, and Sparkle private keys remain outside Git. Publish Sparkle signatures
and public update metadata only. Tag the exact tested commit and attach checksums
to release artifacts.
## Local API selection

Set `HITSLOP_CATALOG_URL=http://127.0.0.1:8787` for macOS catalog and CLI
search/create, and `HITSLOP_REGISTRY_URL=http://127.0.0.1:8787` for CLI publishing.
Run `bun run cloudflare:dev` with local bindings and an ignored `.env` signing
secret. Firebase emulator configuration does not change the catalog endpoint.

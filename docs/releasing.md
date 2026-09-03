# Releasing

## Version policy

The macOS app is stable at `1.0.0`. The iOS app and npm packages remain at
`0.1.0` until their public interfaces settle. Do not force every workspace to
share one version.

## Release gate

From a clean checkout with Bun and Xcode installed:

```sh
bun install --frozen-lockfile
bun run release:check
```

The gate checks repository hygiene, generated schema drift, the public npm
packages, the catalog's hostile-package boundary, a clean-room tarball install,
and Swift tests/build. CI runs the same first-launch boundary.

Older examples are deliberately outside this gate until they are converted to
the v1 API. Run `bun run examples:check` when working on that collection; it is
allowed to remain red during the initial package launch.

Inspect `git status --short` afterward. Generated package `dist/` directories
are cleaned before every build so stale deleted exports cannot enter npm.

## npm packages

Run the focused npm foundation gate before publishing. It validates and packs
the five public packages, installs their real tarballs outside the monorepo,
tests the catalog's package-ingress boundary, and creates a fresh Svelte project
through the complete init/build/validate path:

```sh
bun run release:npm:check
```

Publish in dependency order:

1. `@hitslop/schema` and `@hitslop/runtime`
2. `@hitslop/svelte` and `@hitslop/react`
3. `@hitslop/cli`

Use `bun pm pack --dry-run` in every package before publishing. Verify the
tarball includes only `dist`, permitted templates/generated schema,
`package.json`, `README.md`, and `LICENSE`; confirm repository metadata,
MIT license, and intended `0.1.x` version.

## Hosted services

Deploy Convex schema/functions before a catalog build that requires them.
Configure production values in provider secret stores. The catalog build wrapper
checks for secret leakage and removes copied `.dev.vars` on success or failure.

## macOS

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

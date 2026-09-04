# Releasing

## Version policy

The macOS app is stable at `1.0.1`. The iOS app and npm packages remain in the
`0.1.x` line until their public interfaces settle. Do not force every workspace to
share one version.

## Release gate

From a clean checkout with Bun and Xcode installed:

```sh
bun install --frozen-lockfile
bun run release:check
```

The gate checks repository hygiene, generated schema drift, the public npm
packages, the Firebase Function's hostile-package boundary, a clean-room tarball install,
and Swift tests/build. CI runs the same first-launch boundary.

Older examples are deliberately outside this gate until they are converted to
the v1 API. Run `bun run examples:check` when working on that collection; it is
allowed to remain red during the initial package launch.

Inspect `git status --short` afterward. Generated package `dist/` directories
are cleaned before every build so stale deleted exports cannot enter npm.

## npm packages

Run the focused npm foundation gate before publishing. It validates and packs
the five public packages, installs their real tarballs outside the monorepo,
tests the Firebase package-ingress boundary, and creates a fresh Svelte project
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

Tag npm releases as `npm-v<version>` and macOS releases as
`macos-v<version>`. The separate namespaces keep an npm-only release from
starting the signed macOS release workflow.

## Hosted services

Deploy Firebase Functions, Firestore and Storage rules, generated schemas, and
Hosting together from `apps/firebase`. Firebase Hosting targets
`api.hitslop.com`; the static Astro Worker remains at `hitslop.com`.

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

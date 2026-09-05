# Releasing

## Version policy

The macOS release candidate is `1.0.3` (build `21`). The npm platform packages
use `0.2.x` for the breaking TypeBox API reset; iOS remains at `0.1.0`.
Do not force unrelated products to share one version.

## Release gate

From a clean checkout with Bun **1.4.0** (the root `packageManager` version) and
Xcode installed. Use that exact Bun version for generation and release checks:
the bundled bridge's minified output changes between Bun versions.

```sh
bun install --frozen-lockfile
bun run release:check
```

The gate checks repository hygiene, generated schema drift, the public npm
packages, the Firebase Function's hostile-package boundary, a clean-room tarball install,
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
the four public packages, installs their real tarballs outside the monorepo,
tests the Firebase package-ingress boundary, and creates a fresh Svelte project
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

1. `@hitslop/schema` and `@hitslop/runtime`
2. `@hitslop/svelte`
3. `@hitslop/cli`

Use `bun pm pack --dry-run` in every package before publishing. Verify the
tarball includes only `dist`, permitted templates/generated schema,
`package.json`, `README.md`, and `LICENSE`; confirm repository metadata,
MIT license, and intended `0.2.x` version.

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
## Local Firebase selection

Debug builds use the configured production catalog by default, with Analytics and
Crashlytics collection disabled. Register the App Check debug token printed by
Firebase when testing against production. To use local emulators, set
`HITSLOP_USE_FIREBASE_EMULATORS=1` in the Xcode run scheme: Firestore (8080),
Functions (5001), and artifact hosting (5002) then switch together. Release builds
ignore this environment switch and retain production App Check and telemetry.

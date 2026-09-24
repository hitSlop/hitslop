# Release the Mac app and npm packages

Launch includes the signed/notarized Apple silicon Mac app and matching `@hitslop/schema`, `@hitslop/document`, and `@hitslop/cli` packages. Hosted template publication, catalog services, accounts, and collaboration remain deferred. npm publication is a separate maintainer-run action after the matching Mac app is available.

## Validate one commit

Use the pinned Bun release, Xcode, and XcodeGen on macOS:

```sh
bun install --frozen-lockfile
bun install --cwd apps/landing --frozen-lockfile
bun run test:local
```

`bun run hygiene` runs only repository hygiene and does not establish release readiness.

The complete gate checks hygiene; builds runtime, helper, and all active templates; verifies generated contracts, provenance, compatibility, types, and skills; runs JS and native tests with presentation fixtures; exercises relocated helper editing/export and storage crashes; packs/tests npm artifacts outside the checkout without Node; checks/builds the public site; builds/verifies the Apple app; and exercises native process death. Any failure stops the gate. Partial or non-macOS checks are not a complete release gate.

Bundled selection comes from `examples/slops/bundled.json`. Every selected package must be present in the app with no unexpected stale starters. Generic create/schema/get/reopen/export checks run for every bundled template. Schema-specific mutation/crash probes use known fixtures separately. Packed consumer tests also compile the public getting-started tutorial; its code is an executable contract.

Inspect generated changes. Never regenerate preserved compatibility fixtures or rewrite release hashes to mask drift. See [versioning](../versioning.md). Before publishing a runtime revision, run `bun scripts/v1/runtime-release.ts` after compatibility validation, commit the ledger change, and retain `generated/v1/runtime-releases/<contract>-<revision>/` permanently with release artifacts. Restore historical releases for cross-revision tests. Ordinary builds do not seal releases.

## Package the Mac app

The deployment target is macOS 14+ on Apple silicon. App version/build values live in `apps/apple/project.yml`. Existing TCA features, local catalog, native windows/toolbar, Analytics/Crashlytics, Sparkle, and NativeCLI remain part of release.

```sh
scripts/install-macos-release.sh
scripts/package-macos-release.sh
bun scripts/v1/release-artifact.ts /path/to/hitSlop.app
```

Embedding ships the native executable and its required Runtime/Wasm resources. Verification checks matching host/helper runtime catalogs and exercises installed helpers with a system-only PATH, including PNG/PDF. Native editing needs no checkout, Node, or Bun. `HITSLOP_NATIVE_CLI` selects an explicit matching helper for authoring verification.

Developer ID, notarization, provisioning, App Store Connect, and Sparkle private keys remain outside Git. The tagged GitHub workflow runs the full local gate before signing, notarizing, verifying DMG/ZIP artifacts, and publishing the Mac release. It does not publish npm packages. Release the exact tested commit.

## Manual Mac acceptance

Record commit, version/build, OS, and results. Test macOS 14 and the current supported macOS on Apple silicon:

- Fresh offline install: every selected starter, create copy, open, Recents, and local template discovery.
- Install an unpacked external template; confirm categories and selection update when it is removed. Invalid packages report local issues without hiding valid templates.
- Type then close, reorder rows, commit IME, and quit with multiple documents.
- Failed save retains ownership; retry works and cancelled quit preserves other documents.
- Kill WebContent, reopen saved state, and continue editing.
- PNG/PDF, Finder preview/icon, keyboard focus, narrow windows, repeated open/close, and menu commands.
- GitHub and Discord remain in the native sidebar; Discord remains disabled until its URL is configured.
- Gatekeeper launch from downloaded DMG and ZIP; installed helper works without Node/Bun.
- Sparkle update from the previous signed release, verifying publisher and resulting version.

Use a disposable Release validation build to verify representative Analytics events and a symbolicated Crashlytics test crash outside the debugger. Relaunch after the crash for upload. Debug/tests do not upload telemetry. Do not ship a crash trigger. Retain the Release dSYM upload phase and verify reported version/build. Unit tests do not prove Firebase delivery.

## Publish the tested npm artifacts

`bun run packages:pack` writes tarballs under `generated/v1/npm`. `bun run test:packed` installs those exact artifacts into a temporary directory with spaces and verifies initialization, authoring, registration, themes, exports, preview resources, and durable installed skill links after package-cache removal. It derives versions from package manifests. Consumer-only overrides connect unpublished tarballs; shipped manifests contain registry versions, never workspace/file dependencies.

Keep the tested artifacts from the release commit. Confirm package versions/dependency pins and runtime provenance agree, and make the compatible signed Mac app available first. With maintainer npm authentication configured outside the repository, publish these exact files in order (substitute the tested version):

```sh
bun publish ./generated/v1/npm/hitslop-schema-VERSION.tgz --access public
bun publish ./generated/v1/npm/hitslop-document-VERSION.tgz --access public
bun publish ./generated/v1/npm/hitslop-cli-VERSION.tgz --access public
```

Wait for each package to be available before publishing dependents. Never overwrite a published version or rebuild a different artifact between verification and publication. If publication partially succeeds, inspect registry state and resume only the missing packages; do not blindly replay the sequence.

From a fresh directory, verify `bunx @hitslop/cli@VERSION init smoke`, install the generated project, and run check/dev/build/register with the compatible Mac app. Separately verify `bun install -g @hitslop/cli@VERSION` and the `slop` entry point. Confirm the default `bunx @hitslop/cli` resolves to the intended launch release. Record artifact checksums and smoke results with the release record. Packing, tests, and this cleanup never publish automatically.

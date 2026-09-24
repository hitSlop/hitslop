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

Bundled selection comes from `examples/slops/bundled.json`. Every selected package must be present in the app with no unexpected stale starters. Every package is checked for matching build bytes, valid manifest/schema/initial data, runtime requirements, immutable contents, and preview/icon artwork. Installed create/schema/get/reopen/PNG/PDF checks run on Quick Checklist and Small Expenses. Set `HITSLOP_TEMPLATE_EXHAUSTIVE=1` to run those installed checks on every bundled template. Schema-specific mutation/crash probes use known fixtures separately. Packed consumer tests also compile the public getting-started tutorial; its code is an executable contract.

### GitHub template cache and optional walkthroughs

GitHub CI and tagged releases restore completed template packages before `bun run build`. Each package has an input fingerprint and output checksum. Template changes rebuild that template; shared SDK, renderer, runtime, dependency, build-script, or toolchain changes invalidate all entries. Missing or damaged entries rebuild automatically. Inventory is regenerated each run, and removed templates are pruned. Cache snapshots are saved after a successful build, before later validation steps. A first run or evicted cache still performs a complete build.

Only the workflows set `HITSLOP_TEMPLATE_CACHE_DIR=.hitslop/template-cache`; ordinary local builds remain uncached. Unset that variable to force fresh template builds. The workflows run hygiene/build explicitly followed by `bun run test:built`; local `bun run test:local` runs the same stages together. Runtime generation, native compilation, compatibility checks, and signing are never skipped by the template cache.

Default native tests retain host/runtime, persistence, locking, attachment, file picker cancellation, and export coverage. Detailed Habit Heatmap, Pocket Sheet, and Soma Amp walkthroughs are opt-in:

```sh
HITSLOP_TEMPLATE_INTEGRATION=1 bun run swift:test
# On hardware with working WebGL/audio, also exercise Soma Amp playback and visualization:
HITSLOP_TEMPLATE_INTEGRATION=1 HITSLOP_MEDIA_TESTS=1 bun run swift:test --filter SomaAmpTests
```

These flags are off in both normal CI and tagged releases. Fast JavaScript app-logic tests remain in the default gate.

Inspect generated changes. Never regenerate preserved compatibility fixtures or rewrite release hashes to mask drift. See [versioning](../versioning.md). At shipment, after the release preparation is merged, run `bun scripts/v1/runtime-release.ts` after compatibility validation, commit the ledger change, and retain `generated/v1/runtime-releases/<contract>-<revision>/` permanently with release artifacts. Restore historical releases for cross-revision tests. Ordinary builds do not seal releases. Commit the ledger, validate that final commit, push master and wait for CI, then tag that exact commit. The release workflow rejects an unsealed runtime or a tag that disagrees with the Apple project version.

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

Keep the tested artifacts from the release commit. Confirm package versions/dependency pins and runtime provenance agree, and make the compatible signed Mac app available first. Download the three npm tarballs, `SHA256SUMS`, and `release-record.json` from the matching GitHub Release. Verify each tarball against its checksum and confirm the record identifies the tagged commit. The workflow retains the exact artifacts exercised by `test:packed`; do not repack them locally. It also archives the sealed runtime and ledger for future compatibility checks.

Authenticate locally with `npm login --registry=https://registry.npmjs.org`, then check the account with `npm whoami`. Keep credentials in your user configuration outside the repository. Publication may require an interactive 2FA challenge; Bun supports browser authentication and `--otp` for supported OTP challenges. See [npm authentication](https://docs.npmjs.com/accessing-npm-using-2fa/) and [Bun publishing](https://bun.sh/docs/pm/cli/publish). Never put tokens or OTPs in Git.

Publish the downloaded files in order (substitute the tested version and download directory):

```sh
bun publish ./generated/v1/npm/hitslop-schema-VERSION.tgz --access public
bun publish ./generated/v1/npm/hitslop-document-VERSION.tgz --access public
bun publish ./generated/v1/npm/hitslop-cli-VERSION.tgz --access public
```

Wait for each package to be available before publishing dependents. Never overwrite a published version or rebuild a different artifact between verification and publication. If publication partially succeeds, inspect registry state and resume only the missing packages; do not blindly replay the sequence.

From a fresh directory, verify `bunx @hitslop/cli@VERSION init smoke`, install the generated project, and run check/dev/build/register with the compatible Mac app. Separately verify `bun install -g @hitslop/cli@VERSION` and the `slop` entry point. Confirm the default `bunx @hitslop/cli` resolves to the intended launch release. Record artifact checksums and smoke results with the release record. Packing, tests, and this cleanup never publish automatically.

# Local release validation

Run `bun install --frozen-lockfile`, then `bun run test:local` on macOS.

The gate builds the pinned runtime and both templates, checks generated contracts and authoring types, builds the native helper, runs JS and Swift tests, verifies relocated helper editing/export without Node/Bun, exercises storage crashes, packs and tests the public CLI outside the checkout with Node absent, builds the Apple app, and tests native process death. Worker rooms, OpenAPI/Registry, account/auth, hosted discovery, archive sharing, npm publication, JSON file editing, and old command-engine tests are not release gates.

Useful individual commands: `bun run check`, `bun run test`, `bun run build`, `bun run swift:test`, `bun run test:native-helper`, `bun run test:storage`, `bun run apple:build`, and `bun run test:native-crash`.

Native tests include the actual WebView, socket, headless isolation, lost storage replies, renderer death after commit before acknowledgement, close failure, capture restoration, oversized logs, and symlink replacement. The storage-only Bun adapter is a test fixture, never a production CLI fallback.

For a signed app, run `bun scripts/v1/release-artifact.ts /path/to/hitSlop.app`. This verifies matching host/helper resources, both packaged starters, and installed create/get/apply/PNG/PDF with a system-only PATH.

## Manual release acceptance

Record the commit, app version/build, OS, and result in the release notes. Test macOS 14 and the current supported macOS on Apple silicon:

- Fresh offline install: two starters, create copy, open, and recents.
- Type and immediately close; reorder; IME commit; quit multiple documents.
- Inject save failure: retain ownership, retry, and cancel quit without losing another document.
- Kill WebContent: remove discovery, reopen saved state, then continue editing.
- PNG/PDF, Finder preview/icon, keyboard focus, narrow windows, repeated open/close.
- Gatekeeper launch from downloaded DMG and ZIP; installed helper without Bun/Node.
- Sparkle update from the previous signed release; verify publisher identity and resulting version.

The tagged GitHub workflow runs the complete gate before signing and publication. Automated checks do not substitute for the signed-app/manual acceptance record.

## CLI package release

`bun run packages:pack` produces the three tarballs in `generated/v1/npm`.
`bun run test:packed` installs those exact artifacts in a temporary directory
whose path contains spaces, checks the bunx entrypoint, authoring, registration,
themes, PNG/PDF, disposable preview, and installed skills after cache removal.
Consumer-only overrides connect unpublished tarballs; published manifests contain
only registry versions, never workspace or filesystem dependencies.

Release `@hitslop/schema`, `@hitslop/document`, then `@hitslop/cli` at the matching
version after the signed Mac app is available. Publication is a separate release
action; packing and CI never publish. Verify the public `bunx @hitslop/cli init`
and global-install workflows from a fresh directory after publication.

## Local catalog and telemetry acceptance

Unpack a valid downloaded `<slug>.slop` into `~/.hitslop/templates`. Confirm it
appears beside the bundled starters, contributes its manifest categories, and
creates a writable copy without altering the master. Remove it and refresh;
selection and categories must follow the remaining templates. Invalid packages
must produce a local issue without hiding valid templates.

Release telemetry records `app_launched`, `document_created` (source: bundled or
installed), `document_opened`, `document_duplicated`, and `document_exported`
(format: png or pdf). Cancelled pickers do not emit success events. Crashlytics
nonfatal categories are create, open, save, export, and renderer; no authored
values or raw error userInfo are forwarded. Debug/tests do not upload telemetry.

For signed release acceptance, verify representative events and a symbolicated
test crash in Firebase using a disposable validation build, outside the debugger.
Relaunch after the crash so the report uploads. Do not ship a crash trigger or
claim console delivery based only on unit tests. Preserve the existing Release
dSYM upload phase and verify the reported app version/build.

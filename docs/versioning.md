# Runtime versioning

## Initial release baseline

The initial v1 release uses contract 1, revision 1, and SDK 1.0.0. Its sealed bytes are recorded in `runtimes/releases.json` and must remain immutable. Subsequent runtime changes follow the revision and compatibility rules below. The former 1/1 hash retained locally under `generated/v1/prerelease-baselines/1-1` was an internal development baseline, not a published compatibility gate. Existing conformance fixtures remain regression tests. Ordinary builds never modify the ledger.

A slop owns its compiled app, schema and state. The host supplies the document engine. `assets/runtime.json` declares a positive integer runtimeContract and minRuntimeRevision. SDK, Loro and bridge protocol versions record provenance; they are not opening gates. Missing or invalid requirements are refused before storage opens. Unsupported contracts and insufficient revisions name the requirement and request an app update. Pre-release identities without these fields are not supported.

The runtime contract covers compiled app imports and handle semantics, descriptor interpretation and schema-key semantics, Loro data, bridge envelopes and replies, __slop methods, socket behavior, resource paths, package validation, CSP and storage bounds. The current host must satisfy every supported contract. An archived JavaScript tree alone does not establish compatibility. Authored code and bootstrap inside old documents remain unchanged.

Each consumer bundles runtimes/<contract>/{index.js,headless.js,identity.json,loro/}. Identity records runtimeContract and runtimeRevision. /__runtime__/ URLs remain stable; each WebView selects its backing directory before opening. Visible windows, recovery and engine-only headless sessions share selection. runtime-info returns current and runtimes identities. New templates require the current runtime revision; the authoring project and CLI still require matching SDK identities.

Compatible fixes and additive capabilities increase the revision. Runtime byte changes cannot reuse a recorded release identity. Changes that cannot preserve old app behavior or persisted-data readability require another contract. Dependency versions alone do not establish compatibility. Within a contract, candidate-written state must remain readable by historical revisions because existing documents retain their minimum revision. SQLite format 1 remains unchanged and is owned by Swift; future SQLite changes need a separate compatibility design. Contract-1 checkpoints may be Loro shallow snapshots; every contract-1 reader must import them.

The highest contract is built from source. Lower contracts are copied from immutable top-level runtimes/<contract> archives when needed. No historical runtime binary is committed until another contract is introduced. Published artifacts are never edited; maintenance fixes produce new revisions. All shipped contracts remain supported, with no automatic retirement. WebKit or operating-system compatibility is not guaranteed indefinitely; platform or security exceptions require an explicit product decision.

Preserved compiled fixtures and SQLite data are checked by hash. `bun run test` replays them through the compiled candidate runtime in Bun, including historical readers in separate processes; native tests retain the WebKit/host boundary. CI checks immutable fixture and ledger history against an independently selected base commit. Tests cover authored operations, CLI operations, drafts, themes, checkpointing, reopen and PNG/PDF export, plus historical readers of candidate-written data. Current examples are not historical fixtures. Keep old fixtures, expected values and release hashes unchanged and add coverage for new capabilities.

bun scripts/v1/runtime-release.ts seals the current generated runtime and emits a release directory for permanent retention with release artifacts. runtimes/releases.json records its checksum. Ordinary builds never update this ledger or fixtures. Run `bun run compatibility:restore` to restore verified older release directories under `generated/v1/runtime-releases` for cross-revision tests. Missing historical readers fail the gate. Runtime archives, generated copies, resolved dependency versions and template requirements are checked before release; host and helper catalogs must match per contract.

Before shipment, explicitly preserve new bundled template packages with `bun run fixtures:seal --write`; see [releasing](guides/releasing.md). Ordinary test/build commands never seal or rewrite fixtures.

## Type-only maintenance of sealed runtimes

Contract 1/1 runtime bytes are sealed. Even type-only edits can change esbuild's identifier
histogram and minified names. Keep the session aliases separate and verify the candidate's
`equivalentReleases` includes `1-1`; never update the release seal to accept a type cleanup.
The session implementation links here because its local aliases and narrowing casts
preserve those bytes. Native-only `export` requests are excluded from the JS session type.

At the next runtime revision, rewrite session dispatch as a discriminated switch and
remove the aliases and casts needed only for control-flow narrowing. Operation payloads
remain opaque at the wire boundary and still need an application-operation boundary.
Also deferred to that revision: type the headless entry point and share host-session
setup, and remove the duplicate flush in the theme branch. None of these executable
changes belongs in a type-only cleanup of release 1/1.

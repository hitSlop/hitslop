# Runtime files and release archives

This directory tracks sealed runtime checksums in [releases.json](releases.json).
The current runtime is built from source; its generated JS/WASM files are ignored
by Git and bundled into the distributed Mac app, native helper, and authoring CLI.
The installed app loads those files locally. It does not build or download runtimes.

## Where the files live

Paths below are relative to the repository root.

| Location | Purpose |
| --- | --- |
| `packages/document/src/` | Runtime source, the static `boot.js`/`headless.js` entries and `runtime-identity.json`; Loro JS/WASM comes from the pinned dependency. |
| `runtimes/releases.json` | Committed contract/revision identities and checksums of their sealed runtime directories. |
| `packages/cli/runtimes/<contract>/` | Generated runtime shipped in the CLI package for browser previews. |
| `apps/apple/Packages/HitSlopApple/Sources/HitSlopWasm/Resources/runtimes/<contract>/` | Generated SwiftPM resources bundled with the Mac app and native helper. |
| `generated/v1/runtime-releases/<contract>-<revision>/<contract>/` | Local preserved release bytes used for historical compatibility tests and release packaging. |

Each runtime directory contains `index.js` (the internal engine module), `boot.js`
(visible sessions), `headless.js` (engine-only sessions), `identity.json`, and `loro/`
with the Loro JavaScript and WASM files. Generated consumer copies and
`generated/` are [Git-ignored](../.gitignore), so they do not appear in GitHub's
source browser.

## Building and loading

`bun run build` builds the current contract from source and copies identical
one runtime into the CLI and native resource directories. Historical runtimes
are replay inputs only; they are never copied into installed consumers.
Ordinary builds do not seal releases or update the checksum ledger.

When opening a document, the native host reads `assets/runtime.json`, selects
the bundled contract, and checks its revision meets `minRuntimeRevision` before
opening storage. The WebView loads files through `slop://app/__runtime__/`, backed
by that selected directory. The host serves the page itself: visible sessions load
`boot.js`, which opens the document and mounts `assets/app.js` through the `ctx`
ABI; closed-document editing loads `headless.js` and never loads authored app code. Browser previews serve the CLI's runtime over localhost.
The `.slop` document contains its authored code and runtime requirements, not the
engine. See the [runtime reference](../docs/reference/runtime.md).

## Preserving and restoring releases

Explicit sealing with `bun scripts/v1/runtime-release.ts` preserves the generated
bytes under `generated/v1/runtime-releases/` and records their checksum in the
ledger. The Mac release workflow attaches `runtime-<contract>-<revision>.tar.gz`
and `runtime-releases.json` to [GitHub Releases](https://github.com/hitslop/hitslop/releases).
These are permanent release assets, not temporary CI artifacts.

On a fresh checkout, after installing dependencies, run:

```sh
bun run compatibility:restore
```

The command uses the GitHub CLI (`gh`) to download missing historical releases,
extracts them into `generated/v1/runtime-releases/`, and verifies their bytes
against the committed checksums. It reuses verified local copies and refuses
damaged ones. Historical runtimes are never regenerated from current source.
The current contract/revision is built from source instead of downloaded.

An app release does not automatically need a new runtime revision. Multiple app
releases can bundle the same sealed runtime and attach an archive of those same
bytes. Each consumer ships exactly one runtime; historical revisions remain available
for compatibility testing. See [versioning](../docs/versioning.md)
for revision and contract rules, and [releasing](../docs/guides/releasing.md) for
the release procedure.

## Upgrading Loro

A Loro upgrade changes runtime bytes, so it is always a new revision (or a new
contract if it cannot keep the three contracts in [versioning](../docs/versioning.md)).

1. Bump the exact pin in the root `package.json` and
   `runtime-identity.json`'s `loroVersion`; increment `runtimeRevision`.
2. Row and tree `$id`s are application registers, so identity does not depend on Loro's
   container ID format. Still review Loro's changelog for encoding, import and
   mergeable-container changes.
3. Record the storage-revision decision in `runtimes/storage-decisions.json` with
   `runtimeContract`, `runtimeRevision`, `fromLoroVersion`, `toLoroVersion`,
   `storageRevision` and a nonempty `reason`. Keep the floor only when historical
   readers at that floor preserve candidate-written values and identities.
   `bun run test` checks forward replay, same-storage historical readers, refusal
   below a raised floor, and current-engine convergence.
4. Never enable shallow snapshots or history pruning without a fixture exercising them
   and a sync-aware design.
5. Run the native tiers and `release:check`, then seal the new revision.

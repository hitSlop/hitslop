# hitSlop v1 platform refactor

Status: implemented on August 29, 2026. This document records the first clean
platform architecture. The previous application had not launched, so the
refactor intentionally provides no migration layer or compatibility contract
for the deleted implementation.

## Executive summary

This refactor changes hitSlop from a Swift application that owned nearly the
entire toolchain into a small platform with explicit boundaries:

- A `.slop` is a self-contained runtime web app with host-owned JSON or SQLite.
- Authoring tools and SDKs are independently publishable TypeScript packages.
- Svelte is the first supported authoring framework, not a runtime requirement.
- Zod is the model source of truth; JSON Schema is the language-neutral boundary.
- Convex owns catalog metadata, immutable releases, publisher keys, and counters.
- Cloudflare R2 owns immutable template artifacts and screenshots.
- TanStack Start provides the public catalog and the R2 upload/download gateway.
- The macOS application is a thin host, catalog browser, document factory, and
  Quick Look integration.
- Publishing is authenticated with an Ed25519 publisher keypair instead of a
  user account.
- Existing documents never update automatically when a template is republished.

The previous Swift packages, bundled Swift CLI, generated built-in `.slop`
resources, old Xcode application, and `.mjs` SDK were deleted. Four templates
were retained as normal authoring projects; the rest were moved outside the
workspace to `archive/templates/`.

## Why the architecture changed

The old structure coupled template authoring, packaging, runtime storage,
catalog UI, built-in templates, and the macOS application. That made every part
of the system inherit Swift and Svelte-specific assumptions even though a
runtime `.slop` only needs HTML, assets, a manifest, and local data.

The new structure treats the native app as one consumer of a stable document
format. This makes it possible to add a React SDK, another host, or different
authoring stacks without changing the runtime package format.

| Before | After |
| --- | --- |
| Swift application bundled the CLI and template library | npm packages own authoring, development, building, and publishing |
| Built-in templates were Swift package resources | Templates publish through the same registry as third-party templates |
| Swift types and TypeScript models could drift | Zod emits committed JSON Schema and generated Swift Codable types |
| Firebase/D1/Workers responsibilities were mixed into earlier plans | Convex owns metadata; R2 owns artifact bytes |
| Templates were duplicated from application resources | The host maintains a versioned cache in `~/.hitslop/templates` |
| Framework choices leaked into the document model | `hitslop/1` has a framework-neutral `web` runtime |
| Authors were expected to reason about versions | Convex assigns the next integer release during publish |
| Large legacy Swift packages shared overlapping responsibilities | Small native packages have core, registry, host, and CLI boundaries |

## Repository layout

The root is now a Bun workspace with conventional `apps/` and `packages/`
directories:

```text
apps/
├── catalog/                    TanStack Start catalog and R2 gateway
├── registry/                   Convex schema, functions, and HTTP endpoint
└── macos/
    ├── hitSlop/                thin Xcode app and Quick Look extensions
    └── packages/
        ├── HitSlopCore/        packages, manifests, archives, provenance
        ├── HitSlopRegistry/    Convex Swift catalog client
        ├── HitSlopHost/        WebKit bridge, stores, cache, document creation
        └── HitSlopNativeCLI/   native dev, screenshot, and PDF helper

packages/
├── cli/                        @hitslop/cli
├── runtime/                    @hitslop/runtime
├── schema/                     @hitslop/schema
└── svelte/                     @hitslop/svelte

examples/slops/                 maintained publishable templates
archive/templates/              paused templates, excluded from builds
.agents/skills/                 repository-specific Codex skills
```

Native packages are colocated under `apps/macos/packages` because they exist for
the macOS product. Framework-neutral SDKs and authoring tools live at the root
so they can be published independently.

## The `hitslop/1` runtime contract

The first format uses `format: "hitslop/1"` and `runtime: "web"`. A built
document contains only runtime material:

```text
example.slop/
├── manifest.json
├── build/index.html
├── style.css                  optional
├── assets/                    optional
├── data.json                  when declared by a JSON store
├── data.sqlite                when declared by a SQLite store
├── document.json              local provenance on created documents
└── AGENTS.md                  runtime editing guidance
```

Source code, `package.json`, `node_modules`, `.build`, Vite caches, and package
checkouts are forbidden in runtime documents. `build/index.html` is generated
and bundled into a single HTML entry point.

Svelte, React, Tailwind, Bits UI, Vite, Bun, and npm are authoring concerns.
None is required to open a built `.slop`.

## Manifest and schema pipeline

Zod 4 schemas under `packages/schema/src` are the source of truth for manifests,
document provenance, and signed publish envelopes.

```text
Zod schema
├── z.infer                      TypeScript static types
├── parse/safeParse              runtime validation
└── z.toJSONSchema               committed JSON Schema
        └── quicktype 26         generated Swift Codable models
```

The shared schema is deliberately JSON-shaped. Dates, maps, sets, transforms,
custom classes, and other values without a reliable JSON Schema representation
are kept out of cross-language data.

Manifest validation now includes:

- A portable kebab-case slug.
- Title, description, and author metadata.
- One or two unique categories.
- Up to eight unique tags.
- A bounded preferred window size and optional shape.
- A maximum of sixteen declared JSON or SQLite stores.
- Unique store IDs and paths.
- Safe relative paths with traversal rejected.
- Optional per-store byte limits.

Generation and drift checking are root scripts. Generated JSON Schema and Swift
models are committed so application builds do not require Quicktype.

## TypeScript package split

### `@hitslop/runtime`

The runtime package describes and normalizes the injected `window.slop` host
API. It has no dependency on Svelte or another view framework. It exposes:

- JSON read, write, revision, and change notification operations.
- SQLite query, execute, transaction, revision, and change operations.
- Host readiness and shared TypeScript contracts.

### `@hitslop/svelte`

The first framework SDK adds Svelte 5 reactive helpers over the neutral runtime:

- Reactive JSON stores.
- Serialized and conflict-aware JSON write queues.
- SQLite query state.
- SQL convenience helpers.

React is intentionally deferred. A future `@hitslop/react` should depend on the
same neutral runtime rather than introduce a second host protocol.

### `@hitslop/schema`

This package owns Zod validation, inferred TypeScript types, JSON Schema
generation, publish-envelope canonicalization, and generated-file drift checks.

### `@hitslop/cli`

The CLI is a TypeScript npm package built for Bun and implemented with Crust. It
installs the `slop` executable and supports:

| Command | Responsibility |
| --- | --- |
| `slop init` | Scaffold a Svelte authoring project and configure its manifest |
| `slop dev` | Run Vite with an isolated mock host/storage bridge |
| `slop dev --native` | Open the development URL in the canonical WKWebView host |
| `slop validate` | Validate a manifest against the Zod contract |
| `slop build` | Produce a source-free `dist/<slug>.slop` directory |
| `slop pack` | Produce a deterministic ZIP artifact |
| `slop screenshot` | Ask the native helper for a canonical screenshot |
| `slop publish` | Build, screenshot, sign, and upload a release |

Interactive `slop init` asks for title, description, author, and one or two
categories. Equivalent flags plus `--yes` support scripts and CI. The initial
template selector accepts `svelte` or `svelte-counter`; registry templates can
be added later without changing the manifest format.

The npm package is scoped as `@hitslop/cli` because the unscoped `slop` name is
owned by another project. `bunx @hitslop/cli` and `npx @hitslop/cli` expose the
same `slop` binary when Bun is installed.

## Development without building

`slop dev` starts a normal Vite browser session and injects a mock
`window.slop`. Declared stores are copied into `.hitslop/dev/`, which keeps
development edits away from the template's seed data.

The mock host provides:

- Atomic JSON replacement through a temporary file and rename.
- Revision hashes and conflict detection.
- SQLite queries, writes, and transactions.
- Poll-based change notifications matching the runtime API.
- `--reset` to recreate development stores from their seeds.

This gives template authors browser developer tools and fast HMR before a
runtime document exists. `--native` uses the same Vite server but renders it in
the native WKWebView for host-specific debugging.

## Building and packing

The build command validates the manifest, asks Vite to bundle the app into one
HTML file, copies only declared data and permitted runtime assets, and writes
runtime editing guidance. It rejects missing declared stores.

Packing recursively rejects symlinks, sorts paths, normalizes timestamps, and
creates a deterministic ZIP. The SHA-256 of that ZIP becomes the immutable
artifact identity stored by R2 and Convex.

## Publishing and automatic releases

Authors do not select or maintain version numbers. Publishing follows this
sequence:

```text
slop publish
  → validate and build
  → create deterministic archive and SHA-256
  → generate a canonical native screenshot when missing
  → load or create the publisher Ed25519 identity
  → sign a canonical hitslop-publish/1 envelope
  → POST artifact, manifest, screenshots, envelope, and signature
  → catalog Worker verifies signature and hashes
  → Worker writes content-addressed objects to private R2
  → Worker calls the protected Convex publish endpoint
  → Convex assigns the next integer release and updates currentReleaseId
```

The first key to publish a publisher/slug pair owns that pair. A later publish
must use the same key. Request IDs make publish finalization idempotent.

R2 keys are content-addressed rather than version-addressed:

```text
artifacts/sha256/<sha256>.slop.zip
screenshots/sha256/<sha256>.<extension>
```

Convex stores the relationship between a template, its integer release number,
and the immutable R2 keys.

## Convex registry

Convex replaces the earlier Firebase, D1, and metadata-Worker direction. It owns
metadata and coordination, not document bytes.

The schema includes:

| Table | Purpose |
| --- | --- |
| `publishers` | Publisher public keys and display names |
| `templates` | Searchable current catalog state and aggregate counters |
| `releases` | Immutable release metadata and R2 object references |
| `publishRequests` | Idempotency records for signed publishing |
| `installations` | Unique template installations by local installation ID |
| `downloads` | Unique artifact downloads by installation and release |
| `favorites` | Favorite state by installation and template |

Public queries provide search, popular, newest, category listing, template
details, and release lookup. Search results include the current artifact key and
SHA so the native host can download the exact object without another document
creation API.

Anonymous mutations record downloads, installs, and favorites. They are
idempotent for a local installation ID so ordinary retries do not inflate
counters.

## Catalog and landing page

`apps/catalog` is a TanStack Start application deployed as a Cloudflare Worker.
It provides:

- The public hitSlop landing and template catalog.
- Type-as-you-search catalog filtering.
- Lightweight category filters.
- Popular-template presentation and download links.
- Signed publish verification.
- Private R2 artifact and screenshot writes.
- A controlled R2 artifact download gateway.
- Browser-download telemetry before redirecting to the immutable artifact.

The visual direction is a warm, editorial creative-tool catalog rather than the
old category picker. The native browser uses the same “What are you working
on?” concept and adds local recent documents, popular templates, categories,
favorite controls, and create actions.

## Fresh native architecture

All legacy Swift slop packages and the old application were removed. The new
Xcode application is a thin layer over four focused Swift packages.

### `HitSlopCore`

- Decodes the generated manifest models.
- Validates runtime package contents and declared stores.
- Safely extracts archives and rejects unsafe entries.
- Verifies artifact SHA-256 values.
- Reads and writes local `hitslop-document/1` provenance.

### `HitSlopRegistry`

- Uses Convex Swift for live catalog subscriptions.
- Searches and lists templates.
- Records anonymous installs, downloads, and favorites.
- Persists the local installation ID and favorite state.
- Does not create, copy, or mutate `.slop` documents.

### `HitSlopHost`

- Hosts runtime documents in WKWebView.
- Injects the native JSON/SQLite bridge.
- Performs atomic JSON writes.
- Runs SQLite operations through one host-owned connection and transactions.
- Renders the native catalog browser.
- Owns `DocumentFactory` and the local template cache.

### `HitSlopNativeCLI`

- Opens native development URLs.
- Captures canonical WKWebView screenshots.
- Exports PDFs.
- Remains a separate companion rather than making the macOS app own the
  TypeScript authoring CLI.

### Thin application and Quick Look

The SwiftUI app chooses between the catalog and an opened document. The Xcode
project also contains fresh Quick Look preview and thumbnail extensions.

The main app is intended for direct notarized distribution and is not App
Sandboxed because the shared cache must live at `~/.hitslop/templates`. Quick
Look extensions remain sandboxed and can only read the document macOS provides.

## Template download, cache, and creation

Creating an end-user document is deliberately not a Convex operation. Convex
has already returned the current immutable artifact reference as catalog
metadata. The native `DocumentFactory` then performs the local workflow:

```text
select catalog template
  → compute ~/.hitslop/templates/<publisher-key>/<slug>/releases/<number>.slop
  → if absent, GET /api/artifact?key=<current R2 key>
  → verify archive SHA-256 and safely extract it into the cache
  → copy cached package to the user's selected destination
  → add document.json provenance to the new copy
  → record a download only on cache miss
  → record an installation for the created document
  → open the new .slop
```

Subsequent creations from the same release reuse the local cache. When a new
template release becomes current, only new creations use it. The older cached
release remains available and existing documents remain untouched.

## Existing document updates

Automatic updates are intentionally absent from v1. A template update must
never replace a user's data or silently rewrite a working document.

The future explicit update design is:

1. Download and validate the target release into the template cache.
2. Create a new sibling document from that release.
3. Copy old data only when store ID and store kind still match.
4. Validate the assembled document.
5. Atomically exchange it with the original.
6. Keep a recoverable backup.

A store-kind change requires an explicit migration mechanism. Until that exists,
the application does not expose a misleading update command.

## Template cleanup

The built-in Swift template library was deleted. Maintained templates are now
ordinary Svelte authoring projects under `examples/slops/` and must be published
through the public CLI like third-party work:

- Focus Timer
- Invoice
- Kanban Board
- Random Picker

Other templates were moved to `archive/templates/`. They are preserved for
styling and correctness work but are excluded from the workspace and release
commands. No template is privileged merely because it originated in this repo.

## Identity, authentication, and abuse controls

Publishing does not require account authentication. The CLI generates an
Ed25519 keypair, stores its private identity in macOS Keychain when available,
and falls back to an owner-only `~/.hitslop/identity.json`. Only the public key
and display name enter Convex.

Convex Auth anonymous sessions were considered and deliberately omitted from
v1. They add provider and session state without establishing a human identity,
and meaningful abuse prevention would still require CAPTCHA or rate limiting.
The current design uses:

- Public catalog reads.
- Signed publisher writes.
- A secret-protected Worker-to-Convex finalization endpoint.
- Local anonymous installation IDs for idempotent telemetry.
- No user document data in Convex.

Anonymous or normal authentication becomes worthwhile when hitSlop adds
cross-device favorites, profiles, cloud document state, or social features.
Rate limiting and CAPTCHA can be added to telemetry independently of the
document model.

## Secrets and infrastructure configuration

Public Convex deployment URLs may be committed. Secrets must remain in ignored
environment files and hosted secret stores.

The catalog expects:

- `CONVEX_URL`
- `CONVEX_SITE_URL`
- `HITSLOP_INTERNAL_SECRET`
- An `ARTIFACTS` R2 binding

Development and production R2 buckets are named:

- `hitslop-artifacts-dev`
- `hitslop-artifacts-prod`

`HITSLOP_INTERNAL_SECRET` must be identical in the catalog Worker and Convex
deployment. Example files are committed at the root and in
`apps/catalog/.dev.vars.example`; real `.env.local` and `.dev.vars` files are
ignored.

Development and production are configured independently. With the Cloudflare
Vite plugin, the production environment must be selected at build time with
`CLOUDFLARE_ENV=production`; passing `--env production` only to `wrangler
deploy` is too late because the generated deploy configuration is already
flattened. The catalog package's `deploy` script handles this and also removes
the Vite-generated copy of `.dev.vars` from `dist/server` before uploading.

Code.Storage is not part of v1. R2 already provides the immutable artifact store
needed by the publish and template-cache flows.

## Dependency refresh

The workspace was rebuilt against current package generations, including:

- Convex JavaScript `1.45.0`.
- Convex Swift `0.8.1`.
- Zod 4.
- Quicktype 26.
- React 19 and TanStack Start for the catalog.
- Svelte 5 for the first framework SDK.
- Wrangler 4 and current Cloudflare Vite integration.
- ZIPFoundation `0.9.20`.
- Swift Argument Parser `1.8.2`.

Convex Swift `0.8.1` is the current release and builds successfully. Its bundled
static library presently emits linker warnings because its object files declare
a newer macOS build version than the application's macOS 14 target. This is an
upstream binary-packaging warning, not a reason to pin hitSlop to an older
client.

## Repository skills and agent guidance

Root agent instructions were rewritten around the new boundaries. Two focused
repository skills were added:

- `hitslop-authoring` for TypeScript CLI, SDK, schema, and template work.
- `hitslop-native` for host storage, caching, screenshots, export, and Swift work.

Built runtime documents also receive a small `AGENTS.md` that explains which
files may be edited and prevents source trees or package dependencies from being
copied into a `.slop`.

## Verification completed

The refactor was checked with:

- Root TypeScript build across every workspace package.
- TypeScript and Svelte diagnostics with zero errors or warnings.
- Schema generation followed by a generated-file drift check.
- Runtime, schema, and Svelte unit tests.
- Builds of all four maintained templates into source-free `.slop` packages.
- A `slop init` and `slop validate` smoke test with explicit manifest metadata.
- Convex code generation, function bundling, type generation, and upload to the
  connected development deployment.
- A fresh XcodeGen project generation.
- A complete macOS application build.
- A native Swift CLI build.
- `git diff --check`.

## Deliberately deferred

The following are future work rather than incomplete v1 compatibility layers:

- React authoring SDK.
- Cross-device accounts or authentication.
- Explicit data-preserving document updates.
- Store-kind migration hooks.
- Rate limiting or CAPTCHA for public telemetry.
- Publishing the first maintained templates to seed the production catalog.
- Further styling and repair of archived templates.

This leaves v1 with a small, coherent promise: authors can build and publish
self-contained local-first apps, users can discover and copy immutable template
releases, and the native host owns document data without coupling the format to
Svelte, Convex, or the macOS application's internal implementation.

# hitSlop architecture

## Runtime boundary

`hitslop/1` is the first package format and `web` is its first runtime. A built
document contains `manifest.json`, one bundled `build/index.html`, optional
`style.css`/assets, and only the JSON or SQLite files declared in `stores`.
Svelte, React, Tailwind, Bits UI, Vite, Bun, and npm are authoring concerns and
are never runtime requirements.

The native host injects `window.slop` for JSON reads/atomic writes, SQLite
queries/executes/transactions, and change notifications. `@hitslop/runtime`
normalizes that contract and `@hitslop/svelte` adds reactive Svelte 5 helpers.

## Schema pipeline

Zod 4 schemas in `packages/schema/src` are the source of truth:

```text
Zod schema ── z.infer ──> TypeScript types + runtime validation
     └────── z.toJSONSchema ──> committed JSON Schema
                                  └── quicktype ──> Swift Codable models
```

Named Zod `.meta({ id, title })` values become JSON Schema `$defs` and Swift
type names (`SlopManifest`, `SlopStore`, `SlopWindowShape`). Shared values stay
JSON-shaped. CI regenerates both artifacts and fails on drift. The host decodes
the generated models; uniqueness, reserved paths, and traversal are enforced at
`slop validate` / `slop publish` and again when Convex finalizes a release. The
native host still refuses to open a store path outside the `.slop` bundle.

Manifest metadata includes author, title, description, one or two unique
categories, tags, stores, and the preferred window size and vector shape. PNG
window skins remain a future `.slopskin` package.

## CLI boundary

`@hitslop/cli` is a Bun/TypeScript package exposing `slop init`, `dev`,
`validate`, `build`, `pack`, `screenshot`, and `publish`. It owns authoring,
builds, publisher Ed25519 identity, signing, and uploads. It does not create an
end-user document from the catalog.

`hitslop-native` stays a small Swift companion for canonical WKWebView
screenshots, PDF export, and native dev windows. The npm CLI discovers it from
the installed app, `PATH`, or `HITSLOP_NATIVE_CLI`.

## Catalog, registry, and artifacts

Convex owns searchable catalog metadata, publisher public keys, immutable
release rows, current release pointers, and anonymous download/install/favorite
counts. It never receives user document data.

The TanStack Start app is both the public landing page and the Cloudflare Worker
gateway. The landing page queries Convex live through React Query
(`convexQuery` + `useSuspenseQuery`). The Worker verifies signed publish
envelopes, writes content-addressed artifacts/screenshots into private R2, then
atomically asks Convex to assign the next integer release number. Authors never
manage versions.

Swift queries Convex only for search/list/detail and anonymous telemetry. Each
catalog result includes the current immutable R2 artifact key and SHA-256. The
host downloads that key directly through the R2 gateway; document creation has
no Convex mutation.

The main macOS app is intended for direct, notarized distribution and is not App
Sandboxed so it can maintain the shared `~/.hitslop/templates` cache. Quick Look
extensions remain sandboxed and read only the document macOS gives them.

## Template cache and document creation

```text
catalog choice
  → current artifact key + SHA from search result
  → download from R2 only when that release is absent
  → verify and extract to ~/.hitslop/templates/<key>/<slug>/releases/<n>.slop
  → copy the cached package to the user-selected destination
  → write local document provenance
```

A later template release affects only newly created documents. Existing
documents are never silently updated.

## Future explicit document updates

An update must build a new sibling document from the target cached release,
copy old data only where store ID and kind still match, validate the result, and
atomically exchange it with the original while retaining a recoverable backup.
Changed store kinds require an explicit future migration mechanism. This flow
is intentionally deferred; the v1 app does not pretend an unsafe update is
available.

## Security and configuration

Publishing has no account UI. The CLI creates an Ed25519 keypair, stores the
private key in macOS Keychain (or an owner-only `~/.hitslop/identity.json`
fallback), and signs every publish envelope. Convex binds a publisher/slug to
the original public key.

Public deployment URLs may be committed. R2 credentials, Cloudflare account
configuration, and `HITSLOP_INTERNAL_SECRET` are never committed; local values
use ignored environment files and the corresponding secret is also set in the
Convex deployment.

Convex Auth anonymous sessions are intentionally not used in v1. They add
session/provider complexity without establishing a human unless paired with a
CAPTCHA. Anonymous catalog telemetry instead uses a local installation ID,
idempotent rows, and can gain rate limits without changing the document model.
Auth becomes worthwhile when favorites or document state must sync across
devices.

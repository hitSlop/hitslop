# Catalog and artifact gateway

`apps/catalog` is a TanStack Start React application deployed to Cloudflare.
It has two roles: render the public catalog and act as the security boundary
between publisher uploads, Convex metadata, and immutable R2 objects.

## Read path

The browser subscribes to public Convex catalog data. Artifact and preview
requests pass through gateway routes that resolve an allowed registry key and
stream immutable R2 bytes. Catalog selection in the Apple app still verifies
the artifact SHA-256 before caching.

## Publish path

A publisher submits `envelope`, `signature`, and `artifact`. The gateway:

1. parses the schema and enforces a five-minute envelope window;
2. verifies publisher key ID, Ed25519 signature, byte count, and SHA-256;
3. inspects the ZIP central directory before expansion;
4. rejects traversal, absolute/backslash/NUL paths, duplicates, symlinks,
   encryption, ZIP64/multi-disk, unsupported compression, and limit violations;
5. allows only runtime package paths and requires manifest/app/preview/icon;
6. validates Zod manifest data, PNG CRCs/size, and exact RGBA skin dimensions;
7. stores content-addressed artifact, preview, and icon objects with immutable caching;
8. calls the private Convex finalize endpoint with the shared internal secret.

The artifact is the source of truth. Browser-facing manifest/preview metadata is
derived from the verified signed bytes.

## Environment safety

Public browser config lives in `.env.local` from `.env.example`. Server-only
values live in an uncommitted `.dev.vars` based on `.dev.vars.example`:

- `CONVEX_URL`
- `CONVEX_SITE_URL`
- `HITSLOP_INTERNAL_SECRET`

The build wrapper always removes `dist/server/.dev.vars`, even after a failed
build, and rejects configured secret values if they appear in emitted files.

## Commands

```sh
bun run --cwd apps/catalog dev
bun run --cwd apps/catalog check
bun run --cwd apps/catalog test
bun run --cwd apps/catalog build
bun run --cwd apps/catalog deploy
```

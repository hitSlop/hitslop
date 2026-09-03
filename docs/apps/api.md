# API and artifact gateway

`apps/api` is a framework-free Cloudflare Worker deployed at
`https://api.hitslop.com`. It is the security boundary between publisher
uploads, Convex metadata, and immutable R2 objects. Convex remains an
implementation detail behind the gateway.

## Read path

The Apple app subscribes directly to public Convex catalog data. Artifact,
preview, and icon requests pass through the gateway and may resolve only exact
content-addressed R2 keys. Catalog selection still verifies the artifact
SHA-256 before caching.

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

Server-only local values live in an uncommitted `.dev.vars` based on
`.dev.vars.example`:

- `CONVEX_URL`
- `CONVEX_SITE_URL`
- `HITSLOP_INTERNAL_SECRET`

## Commands

```sh
bun run --cwd apps/api dev
bun run --cwd apps/api check
bun run --cwd apps/api test
bun run --cwd apps/api cf-typegen
bun run --cwd apps/api deploy
```

The deploy command always selects Wrangler's production environment, including
the production Convex deployment, R2 bucket, and `api.hitslop.com` custom
domain.

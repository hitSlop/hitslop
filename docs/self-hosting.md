# Self-hosting

The official hosted catalog is the default, but the publish protocol and all
services are open source. A compatible deployment needs Convex for metadata,
Cloudflare Workers/TanStack Start for the gateway/site, and an R2 binding named
`ARTIFACTS`.

## Deploy the registry

```sh
cd apps/registry
bun install
bunx convex dev
bunx convex env set HITSLOP_INTERNAL_SECRET <long-random-value>
bun run deploy
```

Record the generated `.convex.cloud` and `.convex.site` URLs.

## Configure and deploy the catalog

Copy `.env.example` to `.env.local` for the public `VITE_CONVEX_URL`. Copy
`.dev.vars.example` to `.dev.vars` for local server values. For production,
configure Cloudflare bindings/secrets rather than committing files:

- `ARTIFACTS`: R2 bucket binding
- `CONVEX_URL`: public Convex client URL
- `CONVEX_SITE_URL`: Convex HTTP actions URL
- `HITSLOP_INTERNAL_SECRET`: same random value stored in Convex

Then run `bun run --cwd apps/catalog deploy`.

## Publish to it

```sh
slop publish . --registry https://your-domain.example/api/publish
# or
HITSLOP_REGISTRY_URL=https://your-domain.example/api/publish slop publish .
```

A custom Apple build must also point its catalog/registry clients at your
deployment. Keep the package and signed-envelope schema compatible with the
tagged hitSlop version you deploy.

## Operational responsibilities

Use private R2 write access, HTTPS, Cloudflare secret storage, Convex environment
variables, object retention/backups, rate limiting, log redaction, monitoring,
and regular dependency/security updates. Rotate the shared finalizer secret on
both services together. The open-source release does not provide a managed
migration or uptime promise for third-party deployments.

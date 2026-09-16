# Self-hosting

The API runs in `apps/cloudflare`: a Worker serves the oRPC/OpenAPI contract,
D1 stores the catalog and immutable shared-document metadata, R2 stores artifacts and media,
and a SQLite Durable Object per shared document relays Loro updates.

Provision a D1 database and R2 bucket, put their bindings in `wrangler.jsonc`,
and apply the D1 migrations. Configure `FIREBASE_PROJECT_ID` for the Firebase
Auth project whose users can share documents. Set `TOKEN_KEY` as a Worker secret.
See [the backend guide](../apps/cloudflare/README.md) for local setup and tests.

```sh
bun run schema:generate
bun run --cwd packages/schema build
bun run --cwd packages/api build
cd apps/cloudflare
bunx wrangler d1 migrations apply hitslop --remote
bunx wrangler secret put TOKEN_KEY
bun run deploy
```

Attach your API hostname to the Worker. It serves both `/api/**` and the
canonical `/schemas/v1/manifest.schema.json`. The static landing site is a
separate Worker.

```sh
slop publish . --registry https://your-domain.example
slop search checklist --registry https://your-domain.example
```

Publishing authenticates an Ed25519-signed envelope and validates the complete
artifact before writing catalog state. Shared documents authenticate Firebase
ID tokens and receive scoped room credentials. Clients never query D1 directly.

For an Apple build, point `CatalogURL` at the Worker origin; for local macOS
runs, `HITSLOP_CATALOG_URL=http://127.0.0.1:8787` overrides it. Use your own
Firebase Apple app configuration for authentication and telemetry. Firebase
emulator settings do not reroute catalog or artifact traffic.

Existing Firebase catalog data is not copied automatically. Publish templates
to the new service before switching users to it. Monitor Worker failures and
storage limits and retain appropriate backups of D1, R2, and room data.

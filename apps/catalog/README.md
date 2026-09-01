# hitSlop catalog

The public TanStack Start catalog and Cloudflare artifact gateway.

The browser reads searchable template metadata from Convex. Server routes
validate signed publish ZIPs, store immutable content-addressed artifacts and
previews in R2, finalize releases through a private Convex HTTP endpoint, and
stream allowed downloads.

Public browser configuration starts from `.env.example`; server-only local
configuration starts from `.dev.vars.example`. Never commit either populated
file. The build wrapper removes copied dev vars on success or failure and scans
output for configured secret values.

```sh
bun run dev
bun run check
bun run test
bun run build
bun run deploy
```

See [Catalog and artifact gateway](../../docs/apps/catalog.md) and
[Self-hosting](../../docs/self-hosting.md).

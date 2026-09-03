# @hitslop/api

The framework-free Cloudflare Worker at `https://api.hitslop.com` is the
security boundary for signed package publishing and immutable R2 delivery.
Convex remains the metadata registry behind the Worker.

```sh
bun run dev
bun run check
bun run test
bun run cf-typegen
bun run deploy
```

Copy `.dev.vars.example` to the ignored `.dev.vars` for local development.
Set the same `HITSLOP_INTERNAL_SECRET` in Cloudflare and Convex production.

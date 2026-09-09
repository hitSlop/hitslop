# hitSlop website and docs

The Astro landing page and Starlight documentation deploy together as the
`hitslop-landing` Cloudflare Worker. The landing page is served at
`https://hitslop.com/` and the documentation at `https://hitslop.com/docs/`.

## Local development

From the repository root:

```sh
bun install
bun run landing:dev
```

Run the production checks with:

```sh
bun run --cwd apps/landing check
bun run --cwd apps/landing build
```

## Cloudflare Workers Builds

Connect the `hitSlop/hitslop` GitHub repository to the existing
`hitslop-landing` Worker with these settings:

| Setting | Value |
| --- | --- |
| Production branch | `master` |
| Root directory | `/` |
| Build command | `bun run --cwd packages/schema build && bun run --cwd apps/landing check && bun run --cwd apps/landing build` |
| Deploy command | `cd apps/landing && npx --no-install wrangler deploy` |
| Build variable | `BUN_VERSION=1.4.0` |

Cloudflare installs dependencies before running the build command and deploys
commits to `master` automatically. Non-production branch builds are currently
disabled. If previews are enabled later, use
`bun run --cwd apps/landing preview:upload` as the preview deploy command.

For a manual production deploy, run:

```sh
bun run --cwd apps/landing deploy
```

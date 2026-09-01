# Repository guide

## Workspace map

| Path | Responsibility |
| --- | --- |
| `apps/apple` | Thin iOS and macOS targets plus project/release configuration |
| `apps/apple/Packages/HitSlopApple` | Shared Swift Core, Runtime, Registry, Host, Catalog, and native CLI |
| `apps/catalog` | TanStack Start catalog and Cloudflare R2 gateway |
| `apps/registry` | Convex publishers, templates, releases, and creation counts |
| `packages/cli` | Authoring, development bridge, build, capture, identity, install, publish |
| `packages/runtime` | Framework-neutral host API and adapter building blocks |
| `packages/svelte` | Svelte 5 state adapters |
| `packages/react` | React hooks |
| `packages/schema` | Zod source, JSON Schema, publish protocol, generated Swift |
| `examples/slops` | Maintained authored examples |
| `archive/templates` | Explicitly inventoried prior art outside build paths |
| `Prototypes` | Explicitly inventoried experiments outside build paths |

## Change discipline

Read the nearest `AGENTS.md` and a slop's `manifest.json` first. Reusable
TypeScript belongs in `packages/`. Apple Swift belongs in the app-local Swift
package; AppKit stays in macOS-only targets.

Zod is authoritative. Never edit generated Swift or JSON Schema by hand.
Runtime packages never contain source, dependencies, caches, seed stores, or
editable stylesheets. Preserve this boundary in fixtures and tests.

The worktree may contain another contributor's changes. Keep patches focused,
do not reset unrelated work, and describe any generated changes.

## Common commands

```sh
bun install
bun run check
bun run test
bun run build
bun run release:check

bun slop dev examples/slops/invoice
bun slop build examples/slops/invoice

swift test --package-path apps/apple/Packages/HitSlopApple
swift build --package-path apps/apple/Packages/HitSlopApple --product hitslop-native
```

## Prior art

Only directories named in `SLOPS.todo` are retained prior art. They are
reference material, not publishable packages. Unlisted archive/prototype
directories are ignored so personal experiments cannot drift into a release.

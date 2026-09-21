# Repository guide

## Workspace map

| Path | Responsibility |
| --- | --- |
| `apps/apple` | Thin macOS target plus project/release configuration |
| `apps/apple/Packages/HitSlopApple` | Shared Swift Core, Runtime, Host, local Catalog, telemetry, and native CLI |
| `packages/document` | Shared Loro runtime, typed document handles, Svelte and capture adapters |
| `packages/schema` | TypeBox platform contracts and generated native validation |
| `packages/cli` | Authoring, disposable preview, template capture/registration, native command forwarding |
| `examples/slops` | Active Quick Checklist and Small Expenses examples |
| `deferred` | Historical tooling and tests; excluded from active contracts |
| `scripts/v1` | Current generation, checks, builds, storage and crash verification |

## Change discipline

Read the nearest `AGENTS.md` and a slop's `manifest.json` first. Reusable
TypeScript belongs in `packages/`. Apple Swift belongs in the app-local Swift
package; AppKit stays in macOS-only targets.

TypeBox is authoritative. Never edit generated Swift or JSON Schema by hand.
Runtime packages never contain source, dependencies, caches, seed stores, or
mutable document state. Preserve this boundary in fixtures and tests.

The worktree may contain another contributor's changes. Keep patches focused,
do not reset unrelated work, and describe any generated changes.

## Common commands

```sh
bun install
bun run check
bun run test
bun run build
bun run test:local
bun run examples:check

bun slop dev examples/slops/quick-checklist
bun slop build examples/slops/quick-checklist

swift test --package-path apps/apple/Packages/HitSlopApple
swift build --package-path apps/apple/Packages/HitSlopApple --product hitslop-native
```

## Prior art

Other examples live in `examples/archive`; deferred Apple targets and historical
plans live in `archive/apple` and `archive/docs`. Older templates/prototypes
are inventoried in `SLOPS.todo`. All archive directories are local reference
material, ignored by Git and excluded from the open-source checkout. Restore
individual projects into active source only after updating them to the v1 contract.

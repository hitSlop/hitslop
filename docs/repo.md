# Repository map

The root is a Bun workspace with the conventional `apps/` and `packages/`
split. Native Swift packages are colocated under `apps/macos/packages` because
they exist solely for the macOS product; framework-neutral SDKs and tooling are
top-level packages.

| Path | Responsibility |
| --- | --- |
| `apps/catalog` | TanStack Start landing/catalog and Cloudflare R2 gateway |
| `apps/registry` | Convex schema, functions, catalog queries, release metadata |
| `apps/macos/hitSlop` | Thin Xcode app and Quick Look extensions |
| `apps/macos/packages/HitSlopCore` | Manifest/package validation and safe archives |
| `apps/macos/packages/HitSlopRegistry` | Convex search/list/favorites/install client |
| `apps/macos/packages/HitSlopHost` | WebKit bridge, local stores, cache/copy factory |
| `apps/macos/packages/HitSlopNativeCLI` | Screenshot/export/native-dev helper |
| `packages/schema` | Zod model and generated language-neutral boundary |
| `packages/runtime` | Framework-neutral browser API |
| `packages/svelte` | Svelte 5 state adapters |
| `packages/cli` | Authoring, dev, build, sign, publish |
| `examples/slops` | Maintained source templates published through normal CLI |
| `archive/templates` | Broken/paused templates outside all build paths |

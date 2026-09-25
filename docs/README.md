# hitSlop documentation

hitSlop ships a macOS app and a matching Bun authoring CLI/SDK. Documents stay local; the catalog combines bundled templates, installed templates, and Recents.

| Task | Guide |
| --- | --- |
| Build or refine a mini app | [Authoring](guides/authoring.md) |
| Read, edit, theme, or export a document | [CLI](guides/cli.md) |
| Work on the repository or add templates | [Development](guides/development.md) |
| Choose checks and review test coverage | [Testing](testing.md) |
| Validate and release the app and npm packages | [Releasing](guides/releasing.md) |
| Understand package, engine, storage, and security boundaries | [Runtime reference](reference/runtime.md) |
| Preserve shipped documents across releases | [Runtime versioning](versioning.md) |
| Understand deferred capabilities | [Roadmap](roadmap.md) |

The [public tutorial](../apps/landing/src/content/docs/docs/getting-started.mdx) is for authors using the distributed tools. Repository guides cover contributor workflows and implementation contracts. Packaged agent guidance lives in [packages/cli/skills](../packages/cli/skills); repository discovery links point there.

[Restored-client measurements](benchmarks/v1/README.md) describe historical observations, not performance guarantees. Retired implementations and measurements may be kept in the local, Git-ignored `deferred/` archive. That archive is optional and is not included in fresh clones.

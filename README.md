# hitSlop

Small local apps and documents for your Mac. Create a writable document from a template, keep its state on your machine, and export PNG or PDF. The app combines a native macOS client with a host-supplied Loro runtime and opaque SQLite persistence.

## Work on the repository

Use the Bun version pinned in `package.json`, Xcode, and XcodeGen on macOS:

```sh
bun install --frozen-lockfile
bun install --cwd apps/landing --frozen-lockfile
bun run build
bun run check
bun run test
bun run swift:test
bun slop dev examples/slops/quick-checklist
```

[Development](docs/guides/development.md) covers setup, the workspace, and adding templates. All active templates are discovered for checks/builds; `examples/slops/bundled.json` selects those shipped with the app. The local catalog also discovers templates under `~/.hitslop/templates`.

The launch includes the signed Mac app and three matching npm packages: `@hitslop/document`, `@hitslop/schema`, and `@hitslop/cli`. Installed native document editing needs no Node/Bun. Hosted discovery, accounts, template publication, and collaboration remain deferred. Pre-v1 documents are unsupported; shipped v1 contracts remain supported under [runtime versioning](docs/versioning.md).

Start with the [documentation index](docs/README.md), [authoring guide](docs/guides/authoring.md), or [public tutorial](apps/landing/src/content/docs/docs/getting-started.mdx). Contributors run `bun run test:local` before release. See [releasing](docs/guides/releasing.md) for signed-app and npm publication steps.

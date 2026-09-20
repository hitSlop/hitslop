# hitSlop v1

Local mini apps with a shared Loro document runtime, native SQLite persistence, and one operation language for UI and CLI. This is a fresh prelaunch format: old documents and published templates are intentionally unsupported.

```sh
bun install
bun run build
bun run check
bun run test
bun run swift:build
bun run swift:test
bun slop dev examples/slops/quick-checklist
```

For the macOS application, run `xcodegen generate --spec apps/apple/project.yml`, then open `apps/apple/hitSlop.xcodeproj`. Register Checklist and Expenses with `bun slop register SOURCE`; the existing catalog discovers templates under `~/.hitslop/templates`. File → New from Template opens the browser. File → Export provides PNG and PDF.

```sh
bun slop build examples/slops/quick-checklist
bun slop register examples/slops/quick-checklist
bun slop schema /path/to/Document.slop
bun slop get /path/to/Document.slop
bun slop apply /path/to/Document.slop --op '{"type":"text.replace","path":["title"],"value":"Packing"}'
```

See [architecture](docs/architecture.md), [authoring](docs/authoring.md), [storage](docs/storage.md), [package format](docs/package-format.md), and [capture](docs/capture.md).

The active workspace is `packages/document`, `packages/schema`, `packages/cli`, and `examples/slops`. Apple retains the full macOS client, TCA features, local catalog, frameless windows and hover toolbar, Firebase, Sparkle, OpenAPI client generation, and Swift CLI. The new `HitSlopWasm` target supplies the document engine. Only hosted catalog loading and document sharing are disabled. Installed document editing uses `hitSlop.app/Contents/Helpers/hitslop-native`, with no Node/Bun requirement. `deferred/` retains retired command-engine tests and deferred tooling. Collaboration, media imports, migrations, history pruning, and synced folders are out of scope.

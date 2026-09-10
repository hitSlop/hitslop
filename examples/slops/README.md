# Active examples

Supported TypeBox/Svelte examples live at the top of this folder. Other projects
remain in [_backlog](_backlog/README.md) until they are promoted.

```sh
bun slop dev examples/slops/quick-checklist
bun run --cwd examples/slops check
bun run --cwd examples/slops test
bun run --cwd examples/slops build
bun run --cwd examples/slops validate
```

Build/validate discover active top-level projects with a manifest and index.html.
Promote one backlog project at a time, following Quick Checklist's schema,
store, and theme conventions. No legacy compatibility layer is provided.

Authored projects contain source; built .slop packages contain runtime assets,
not source, dependencies, or seed stores. See [Quick Checklist](quick-checklist/README.md)
for persistence and native verification commands.

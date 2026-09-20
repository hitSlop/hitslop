# Authoring

Define the shape once in schema.ts with `defineDocument` and `s` from `@hitslop/document`. Supply explicit values in initial.ts and authored theme variables in theme.ts. main.ts calls `mountDocument(App)` from `@hitslop/document/host`; components use `useDocument(definition)` and `bindText` from `@hitslop/document/svelte`.

Read `doc.current`; mutate `doc.fields.title.replace(text)` or `doc.fields.items.item(id).settled.set(true)`. Lists return `$id` identities that survive moves/reopen. `transaction(tx => ...)` edits a staging fork and accepts one delta; any rejected command poisons the entire batch, even if caught. Callbacks must be synchronous. `await doc.flush()` is the durability barrier.

The frozen v1 DSL supports string/number/boolean/enum registers, optional scalar registers, text, objects, and movable object lists. Numbers are finite, not automatically money or integers. Text uses whole-value LoroText updates, not a rich-text or concurrent-caret editor. IME drafts remain local until committed; a local composition can supersede another writer's incoming text.

`bun slop dev examples/slops/quick-checklist` creates a disposable browser preview; refresh resets state. Re-run dev after editing source. `bun slop build SOURCE` emits SOURCE/dist/SLUG.slop. `bun slop register SOURCE` installs a complete local immutable master, backing up a previous master outside the template catalog before replacing it. Preview uses the same engine and no disk-backed state server.

Use plain CSS with defineTheme tokens for owned UI; each mini app keeps its own visual identity. See Quick Checklist and Small Expenses for working examples. Their schemas intentionally remain small.

Start a new source project anywhere with `bunx @hitslop/cli init /path/to/new-source`. Run `bun install` in it, then `bun run check`, `bun run dev`, and `bun run build`. Published SDK dependencies are pinned to the CLI release. Bun is the only authoring runtime; native capture requires the matching installed Mac app.

Wrap editors in `<Slop {document}>` with optional inline `exportView` and `icon` snippets. These share the same document and mount only during capture. See [capture](capture.md). Build/register generate native previews on macOS; `slop dev` needs no native helper.

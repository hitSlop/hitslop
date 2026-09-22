# Document CLI

Swift `hitslop-native` ships in `hitSlop.app/Contents/Helpers` with the same pinned JS/WASM runtime as the app. Installed document commands need neither Bun nor a running app. PATH installation is separate; invoke the bundled executable directly. In this checkout, `bun slop` forwards macOS document commands to it.
See [development](development.md) for preparing the checkout and [releasing](releasing.md) for the launch package workflow.

```sh
bun slop schema /path/to/List.slop
bun slop get /path/to/List.slop
bun slop apply /path/to/List.slop --op '{"type":"text.replace","path":["title"],"value":"Today"}'
bun slop batch /path/to/List.slop --ops '[{"type":"text.replace","path":["title"],"value":"Tomorrow"}]'
bun slop compact /path/to/List.slop
bun slop export /path/to/List.slop --format pdf --output /path/to/List.pdf
```

`schema` prints the descriptor; reads and mutations print JSON state. Export prints its destination path. Errors go to stderr with a nonzero exit status. `get` is the canonical read command. The native executable also exposes `create --from TEMPLATE --output DOCUMENT`, `open DOCUMENT`, and template `screenshot` operations.

## Ownership and retries

The permanent `state/writer.lock` decides ownership. Closed editing runs an engine-only invisible WebKit session; it never loads authored app code. Busy documents route through their owner's Unix socket. Missing or failed discovery never permits a second writer. A small `hello` handshake returns session identity without a document snapshot; ordinary reads need no handshake.

Successful mutations acknowledge persistence. No automatic replay or public retry flags exist. After an unknown outcome, run `slop get` before issuing another edit. `get` flushes pending drafts and writes before returning; save failures return an error. One internal epoch identifies each WebView lifetime.

## Export

Open-document exports capture the live view, including current width and selected tab. The existing capture flow commits text drafts, flushes storage, mounts the authored export snippet, and restores the editor. Closed exports render a disposable saved-state snapshot using the app's initial view. For Quick Checklist that means To do; the selected tab is not persisted.

The source writer lock is held while copying a closed writable document. Managed or read-only templates remain state-free. User export destinations must be outside the source package; completed output replaces its destination atomically. Template screenshots are a separate build operation and may write QuickLook assets in their staging package.

The server waits 30 seconds for a command; the client allows 35 seconds for a response. Expired captures cannot publish their result. A lost export acknowledgement has an uncertain outcome: inspect the destination before retrying. There is no automatic mutation or export replay.

## Helper discovery and authoring

`HITSLOP_NATIVE_CLI` selects an explicit executable for both document commands and template capture. Missing/non-executable overrides fail; an executed helper is never retried through another binary. Helper discovery otherwise checks `/Applications/hitSlop.app`, then
`~/Applications/hitSlop.app`. Authoring never compiles Swift. Build and register
require an installed app supporting the required runtime contract and revision.
The authored project SDK and CLI must have matching identities.

The launch `@hitslop/cli` package owns `init`, `check`, disposable browser `dev`,
`build`, and `register`. Run `bunx @hitslop/cli init my-slop` from any directory,
then `cd my-slop && bun install`. Bun is the only JavaScript runtime required.
Native document editing is macOS-only; there is no Bun document engine fallback.

`slop theme get DOCUMENT` reports defaults, overrides, and effective values.
`slop theme set DOCUMENT --values '{"accent":"#123456"}'` changes declared tokens;
`slop theme reset DOCUMENT [--token accent]` restores defaults. Live commands use
the owner socket; closed commands use engine-only WebKit. Inspect `theme get`
after an uncertain transport result before retrying.

## Agent skills

The TypeScript CLI uses Crust for command parsing, help, and packaged agent skills. Run `bun slop --help` or `bun slop COMMAND --help` for current arguments.

```sh
bun run skills:build
bun slop skills
bun slop skills --all --scope project
bun slop skills --all --scope global
bun slop skills update --scope global
```

The build packages the authored `hitslop`, `hitslop-authoring`, `hitslop-design`, and `hitslop-document` guides plus the generated `hitslop-cli` command reference. Authored sources live in `packages/cli/skills`; `bun run build` also builds these artifacts. Rebuild after changing command metadata or authored guidance. Generated output lives in `packages/cli/.crust/root/skills` and is not tracked.

Interactive installation prompts for scope and agent targets. `--all` defaults to global scope unless `--scope` is supplied. Deselecting an installed target removes its owned link. Conflicting real directories are skipped by `--all`; interactive replacement requires explicit confirmation. Installed links target a durable versioned copy in `~/.hitslop/cli/VERSION/skills`, so clearing the bunx package cache does not break them.

`skills update` repairs existing links; it does not install absent skills or download newer content. Link repair is explicit (`autoUpdate: false`), so document and authoring commands do not rewrite repository discovery links. Old native-created links can be repaired; the old `~/.hitslop/skills` cache is left untouched.

The Mac app no longer installs or updates agent skills. Skill management requires the Bun-based TypeScript CLI; native document editing and export still require neither Bun nor the TypeScript CLI.

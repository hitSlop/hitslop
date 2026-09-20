# Document CLI

Swift `hitslop-native` ships in `hitSlop.app/Contents/Helpers` with the same pinned JS/WASM runtime as the app. Installed document commands need neither Bun nor a running app. PATH installation is separate; invoke the bundled executable directly. In this checkout, `bun slop` forwards macOS document commands to it.

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

Successful mutations acknowledge persistence. An uncertain mutation or retryable save failure reports `--id ID --epoch EPOCH`. Reuse both with exactly the same operation, or inspect state before expressing new intent. Supplying only one flag is an error. Receipts are bounded to the live session; restarting or rotating its epoch invalidates old retries. Validation errors are not instructions to retry a save.

## Export

Open-document exports capture the live view, including current width and selected tab. The existing capture flow commits text drafts, flushes storage, mounts the authored export snippet, and restores the editor. Closed exports render a disposable saved-state snapshot using the app's initial view. For Quick Checklist that means To do; the selected tab is not persisted.

The source writer lock is held while copying a closed writable document. Managed or read-only templates remain state-free. User export destinations must be outside the source package; completed output replaces its destination atomically. Template screenshots are a separate build operation and may write QuickLook assets in their staging package.

The server waits 30 seconds for a command; the client allows 35 seconds for a response. Expired captures cannot publish their result. A lost export acknowledgement has an uncertain outcome: inspect the destination before retrying. There is no automatic mutation or export replay.

## Helper discovery and authoring

`HITSLOP_NATIVE_CLI` selects an explicit executable for both document commands and template capture. Missing/non-executable overrides fail; an executed helper is never retried through another binary. Document discovery otherwise checks the checkout Debug helper, `/Applications/hitSlop.app`, then `~/Applications/hitSlop.app`. Template builds compile a matching helper unless explicitly overridden.

TypeScript owns `init`, disposable browser `dev`, `build`, and `register`. The Bun document adapter is isolated development/test infrastructure and the non-macOS path; macOS editing defaults to Swift. Hosted publication and historical `deferred/cli` commands are not part of the active CLI.

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

Interactive installation prompts for scope and agent targets. `--all` defaults to global scope unless `--scope` is supplied. Deselecting an installed target removes its owned link. Conflicting real directories are skipped by `--all`; interactive replacement requires explicit confirmation. Project links are relative, global links absolute. Keep the CLI checkout at its installed location, or run installation/update from the new location to repair links.

`skills update` repairs existing links; it does not install absent skills or download newer content. Link repair is explicit (`autoUpdate: false`), so document and authoring commands do not rewrite repository discovery links. Old native-created links can be repaired; the old `~/.hitslop/skills` cache is left untouched.

The Mac app no longer installs or updates agent skills. Skill management requires the Bun-based TypeScript CLI; native document editing and export still require neither Bun nor the TypeScript CLI.

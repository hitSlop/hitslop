# hitSlop

**A `.slop` is a Finder package.** Show Package Contents → `document.sqlite`. The UI is HTML living in that database. Clicks commit back to the same file. Hand the package to a friend, or to an AI — both speak the same document.

```
$ bun src/cli.ts pack examples/climbing
$ bun src/cli.ts open examples/climbing.slop
# HitSlop.app opens. Right-click the .slop → Show Package Contents.

$ sqlite3 examples/climbing.slop/document.sqlite "SELECT name, status FROM routes"
```

Click a tick in the window. Then:

```
$ sqlite3 examples/climbing.slop/document.sqlite "SELECT name, status FROM routes WHERE status='sent'"
```

The AI does not scrape the UI. It `SELECT`s. You do not export. You copy the file.

## Why SQLite

The JSON-package version of hitSlop proved the thesis (one file, human + AI). SQLite is the container that makes the rest of the machinery fall away: transactions instead of debounce, `UPDATE` instead of rewriting an array, `VIEW`s instead of computed properties, `sqlite3` instead of a custom RPC.

SELF showed this for executables. hitSlop is the document half: **the page is a row, the click is an `INSERT`, the file is the program.**

## Commands

```bash
bun src/cli.ts pack examples/climbing          # → examples/climbing.slop
bun src/cli.ts open examples/climbing.slop     # window (native host, or Chrome --app)
bun src/cli.ts serve examples/climbing.slop    # URL only
bun src/cli.ts query FILE "SELECT * FROM stats"
bun src/cli.ts exec  FILE "UPDATE routes SET status='sent' WHERE name='Bolt Tax'"
bun src/cli.ts schema FILE
bun src/cli.ts create "a diner guest-check for splitting lunch" lunch.slop
```

`create` needs `XAI_API_KEY` (SpaceXAI / [console.x.ai](https://console.x.ai)). Each prompt should produce a *different* looking document — not a reskinned template.

## Format

See [spec/format.md](spec/format.md). Reserved tables: `slop_meta`, `slop_view`, `slop_docs`, `slop_assets`. Everything else is yours.

A document is authored as a folder and packed:

```
examples/climbing/
  meta.json      # title, width, height
  schema.sql     # domain tables + seed
  view.html      # the UI
  docs.md        # notes for the next AI
```

## Runtime

The host injects `/slop.js`:

```js
await slop.query(sql, params?)
await slop.exec(sql, params?)
slop.onChange(() => { /* re-query; includes writes from sqlite3 */ })
```

WAL is on. The window, the CLI, and `sqlite3` can share the file.

## Requirements

- [Bun](https://bun.sh)
- macOS for the native window (`host/main.swift`). Chrome `--app` is the fallback.

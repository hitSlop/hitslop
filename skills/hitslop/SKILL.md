---
name: hitslop
description: Inspect and update .slop documents — SQLite packages with HTML views. Use when opening, querying, editing, packing, or creating a .slop file.
---

# hitSlop

A `.slop` is a Finder package. The document is `document.sqlite` inside it. HTML is the human view. SQL is the agent view. Same file as the open window (WAL).

```
Foo.slop/
  document.sqlite      # application_id SLOP
```

Do not read `view.html` to find data. Do not invent a per-document tool. Every card speaks the same verbs.

## Verbs

Let `DB="Foo.slop/document.sqlite"` (or `slop query Foo.slop` / `slop exec Foo.slop` — those resolve the package).

| Verb | How |
|---|---|
| **walk** | `ls *.slop`; `sqlite3 "$DB" ".tables"` |
| **stat** | docs + schema (always both, first) |
| **read** | `SELECT` |
| **write** | `INSERT` / `UPDATE` / `DELETE` — surgical, not a full dump |
| **create** | `cp -R` to fork; `ALTER TABLE` / `CREATE TABLE` to grow; `slop pack` / `slop create` for new |
| **watch** | if HitSlop.app has the file open, your COMMIT shows up. No extra notify API. |

### stat (do this before write)

```bash
sqlite3 "$DB" "SELECT topic, body FROM slop_docs"
sqlite3 "$DB" ".schema"
sqlite3 "$DB" "SELECT key, value FROM slop_meta"
```

`slop_docs` is the man page *in the file*. Domain tables are whatever `.schema` says, not a global template list.

### read / write

```bash
bun src/cli.ts query Foo.slop "SELECT name, status FROM routes ORDER BY sort"
bun src/cli.ts exec  Foo.slop "UPDATE routes SET status = 'sent' WHERE name = 'Bolt Tax'"

sqlite3 "$DB" "SELECT * FROM stats"
```

Use `?` parameters via the CLI when values are untrusted. Prefer `UPDATE … WHERE` over rewriting a table.

Do not `ATTACH` other files from document HTML. Agent-side `ATTACH` is for a home-stack query you mean to run.

### create

```bash
bun src/cli.ts pack examples/climbing              # authoring dir → package
bun src/cli.ts create "diner guest-check" lunch.slop   # needs XAI_API_KEY
cp -R climbing.slop mine.slop
bun src/cli.ts open mine.slop
```

Authoring dirs have `view.html` + `schema.sql` + `meta.json`. Packages have `document.sqlite`. Packing is destructive to the package, not to the authoring dir.

## Rules

- Unique UI does not mean unique API. No `tick_climb` helper.
- If `slop_docs` is empty, say so, then infer from `.schema` only.
- Format spec: `spec/format.md`. Architecture: `arch.md`.

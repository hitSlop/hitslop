---
name: hitslop
description: Inspect, update, duplicate, create, and export .slop SQLite documents. Use whenever a task involves a .slop file.
---

# hitSlop

A `.slop` is a Finder package whose durable contents are in `document.sqlite`. HTML is the human view. SQL is the agent view. The open window, the native `slop` CLI, and `sqlite3` are peers using the same file in WAL mode.

```text
Foo.slop/
  document.sqlite      # application_id = 0x534C4F50 ('SLOP')
```

Never scrape `slop_view.body` to discover document data. Never invent a template-specific tool. Every document uses the same verbs.

## Workflow

### 1. Stat before writing

Read the document's own instructions and full schema first:

```bash
slop stat Foo.slop
```

If the CLI is unavailable:

```bash
DB="Foo.slop/document.sqlite"
sqlite3 "$DB" "SELECT topic, body FROM slop_docs ORDER BY topic"
sqlite3 "$DB" ".schema"
sqlite3 "$DB" "SELECT key, value FROM slop_meta ORDER BY key"
```

`slop_docs` is the man page inside the document. Domain tables are whatever `sqlite_schema` says; they are not selected from a global template model. If docs are empty, state that and infer only from schema and data.

### 2. Read with SELECT

```bash
slop query Foo.slop "SELECT name, completed FROM habit_week ORDER BY position"
sqlite3 Foo.slop/document.sqlite "SELECT * FROM habit_week"
```

### 3. Write surgically

```bash
slop exec Foo.slop \
  "UPDATE habits SET name = ? WHERE id = ?" \
  --params '["Morning walk", 1]'
```

Use `?` parameters for values. Prefer a precise `UPDATE … WHERE`, `INSERT`, or `DELETE` over dumping and rewriting a table. `slop exec` updates `revision` and `modified_at`; an open host observes the commit and re-queries automatically.

Do not `ATTACH` or create virtual tables from document HTML. The native runtime blocks those operations. Agent-side `ATTACH` is acceptable only for an intentional local analysis across trusted documents.

### 4. Create and duplicate

Create from an installed template:

```bash
slop templates
slop pack path/to/TemplateSource --output path/to/Template.slop
slop create --template habit-tracker --output Morning.slop
slop create --template recipe-card --output Dinner.slop
```

Duplicate any document safely with SQLite's backup API:

```bash
slop duplicate Morning.slop --output Evening.slop
```

Creation and duplication mint a fresh `document_id`, reset `revision`, and preserve a consistent database snapshot. Do not use a recursive filesystem copy on a live WAL database.

The format is deliberately malleable. Grow a document using normal DDL (`ALTER TABLE`, `CREATE TABLE`, `CREATE VIEW`) and update the relevant `slop_docs` entry so the next agent can understand the change.

### 5. Export, watch, and open

```bash
slop export Morning.slop --format png --output Morning.png
slop export Morning.slop --format pdf --output Morning.pdf
slop watch Morning.slop
slop open Morning.slop
```

## Uniform verbs

| Verb | Command |
|---|---|
| walk | `slop templates`, list packages, inspect schema names |
| stat | `slop stat FILE` |
| read | `slop query FILE SQL` |
| write | `slop exec FILE SQL` |
| create | `slop create`, `slop duplicate`, or deliberate DDL |
| watch | `slop watch FILE` |

Unique interfaces do not imply unique APIs. Do not add helpers such as `tick_habit` or `add_ingredient`; discover the schema, then use SQL.

Format specification: `spec/format.md`. Architecture and multiplayer direction: `arch.md`.

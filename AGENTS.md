# hitSlop

`.slop` packages are SQLite documents. Inspect and edit them with SQL, not by scraping the HTML.

Full agent instructions: [skills/hitslop/SKILL.md](skills/hitslop/SKILL.md).

```bash
sqlite3 path/to/Foo.slop/document.sqlite "SELECT body FROM slop_docs"
sqlite3 path/to/Foo.slop/document.sqlite ".schema"
bun src/cli.ts query path/to/Foo.slop "SELECT * FROM sqlite_schema"
bun src/cli.ts exec  path/to/Foo.slop "UPDATE …"
```

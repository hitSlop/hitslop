# hitSlop

`.slop` packages are SQLite documents. Inspect and edit them with SQL, not by scraping their HTML.

Full agent instructions: [skills/hitslop/SKILL.md](skills/hitslop/SKILL.md).

```bash
slop stat path/to/Foo.slop
slop query path/to/Foo.slop "SELECT * FROM sqlite_schema"
slop exec path/to/Foo.slop "UPDATE …" --params '[…]'

sqlite3 path/to/Foo.slop/document.sqlite "SELECT topic, body FROM slop_docs"
sqlite3 path/to/Foo.slop/document.sqlite ".schema"
```

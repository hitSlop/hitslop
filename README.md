# hitSlop

hitSlop turns small, useful software into documents you can own and share. A `.slop` is a Finder package containing one SQLite database; its data, interface, documentation, and preview travel together.

There is no Save button. A click or edit is a SQLite transaction, and the document updates immediately.

## What is implemented

- A native macOS host with frameless, rounded document windows.
- A template picker that copies a template to any folder the user chooses.
- Habit Tracker and Recipe Card templates with genuinely different schemas and interfaces.
- A small hover toolbar for close, pin, duplicate, export, and share.
- PNG and PDF export from both the app and the CLI.
- Quick Look preview and thumbnail extensions backed by a cached PNG inside the database.
- A native `slop` CLI for agents and scripts. It reads and writes SQLite directly; no MCP server is required.
- Live refresh when the open document is changed by the UI, `slop`, or `sqlite3`.

## The file

```text
Morning.slop/
  document.sqlite
```

Right-click a document in Finder and choose **Show Package Contents**. The database uses SQLite `application_id = 0x534C4F50` (`SLOP`) and schema version 2.

```bash
sqlite3 Morning.slop/document.sqlite ".schema"
sqlite3 Morning.slop/document.sqlite \
  "SELECT topic, body FROM slop_docs"
```

The four reserved tables are `slop_meta`, `slop_view`, `slop_docs`, and `slop_assets`. Every other table belongs to that document. See [the format specification](spec/format.md).

## Build and run

Open [hitSlop.xcodeproj](hitSlop/hitSlop.xcodeproj) in Xcode for development, or build from the command line:

```bash
cd hitSlop
xcodebuild -project hitSlop.xcodeproj -scheme hitSlop build
xcodebuild -project hitSlop.xcodeproj -scheme slop build
swift build
swift run slop --help
```

The checked-in project is generated from [project.yml](hitSlop/project.yml) with XcodeGen. Regenerate it after changing targets:

```bash
xcodegen generate --spec hitSlop/project.yml
```

For Finder and Quick Look testing, install one stable app instead of running the DerivedData copy. The installer builds, tests, replaces `/Applications/hitSlop Prototype.app`, unregisters its temporary build providers, refreshes Quick Look, and opens the installed app:

```bash
./scripts/install-dev.sh
```

The app build embeds the CLI at `hitSlop.app/Contents/Helpers/slop`. It can be put on your path without copying the binary:

```bash
mkdir -p ~/.local/bin
ln -sfn "/Applications/hitSlop Prototype.app/Contents/Helpers/slop" ~/.local/bin/slop
```

### Finder thumbnails and Quick Look

Run `./scripts/install-dev.sh`. It builds, signs, embeds, and registers both `SlopPreview.appex` and `SlopThumbnail.appex`; you do not build the extension schemes separately unless you want to debug one with breakpoints. Running the app directly from Xcode registers a second provider from DerivedData, so reinstall with the script before testing Finder integration.

Each document's Finder icon is a screenshot of its view. The host writes `QuickLook/Thumbnail.png` inside the package and sets a custom icon when the document is created or first opened. If Finder still shows the app icon, enable **Show icon preview** in that folder's View Options, then open the document once.

Quick Look matches documents by their exact Uniform Type Identifier. Current documents must report `com.hitslop.slop`:

```bash
mdls -name kMDItemContentType ~/Desktop/Morning.slop
pluginkit -m -A -D -i com.hitslop.app.preview
pluginkit -m -A -D -i com.hitslop.app.thumbnail
```

The app and both Quick Look extensions use one document type: `com.hitslop.slop`. If Finder shows the document icon instead of its content, enable **Show icon preview** in Finder's View Options. After rebuilding an extension, relaunch Finder or create a fresh document to avoid testing a cached preview.

## CLI

The CLI is implemented with Swift Argument Parser and emits JSON on stdout with diagnostics on stderr.

```bash
slop templates
slop pack hitSlop/TemplateSources/Habit\ Tracker --output hitSlop/Templates/Habit\ Tracker.slop
slop create --template habit-tracker --output ~/Desktop/Morning.slop
slop stat ~/Desktop/Morning.slop
slop schema ~/Desktop/Morning.slop
slop query ~/Desktop/Morning.slop "SELECT * FROM habits ORDER BY position"
slop exec ~/Desktop/Morning.slop \
  "UPDATE habits SET name = ? WHERE id = ?" \
  --params '["Morning walk", 1]'
slop duplicate ~/Desktop/Morning.slop --output ~/Desktop/Evening.slop
slop export ~/Desktop/Morning.slop --format png --output ~/Desktop/Morning.png
slop export ~/Desktop/Morning.slop --format pdf --output ~/Desktop/Morning.pdf
slop watch ~/Desktop/Morning.slop
slop open ~/Desktop/Morning.slop
```

Agents should begin with `slop stat`: it returns the document's own instructions and complete SQLite schema. They then use ordinary parameterized SQL. The interface is never scraped and each template does not need its own tool.

Template source is a folder (`view.html`, `schema.sql`, `docs.md`, `meta.json`, `assets/`). Pack it with `slop pack` before the picker or `slop create` can clone it.

## Runtime for template authors

The native host loads the `/` row from `slop_view`. Checked views opt in with:

```html
<meta name="hitslop-renderer" content="sql-html-v1">
```

They use explicit SQL result cardinality. A singleton is exactly one row:

```html
<slop-row as="recipe">
  <script type="application/sql">SELECT title FROM recipe</script>
  <template><h1>{{recipe.title}}</h1></template>
</slop-row>
```

A collection is zero or more rows:

```html
<slop-each as="habit">
  <script type="application/sql">
    SELECT id, name FROM habits ORDER BY position
  </script>
  <template>
    <div id="habit-{{habit.id}}">{{habit.name}}</div>
  </template>
</slop-each>
```

`slop-row` fails unless its read-only query returns exactly one row. `slop-each` repeats its template once per result row. Placeholders must be qualified as `{{alias.column}}`. Named `data-slop-action` forms perform writes, and checked documents cannot contain authored JavaScript.

Unmarked legacy views still receive `/slop.js` and can use:

```js
await slop.query(sql, params)
await slop.exec(sql, params)
await slop.transaction([{ sql, params }, ...])
await slop.meta()
slop.assetURL("photo.png")
slop.onChange(({ revision }) => render())
await slop.ready()
```

Template source lives in [TemplateSources](hitSlop/TemplateSources); packed template databases live in [Templates](hitSlop/Templates). HTML is the human interface. Tables and views are the durable document model.

## Direction

The local document is intentionally the first primitive. A future multiplayer host should preserve the same “one identity, one SQLite database, one serialized writer” model. celld is a plausible deployment layer because each Durable Object cell is SQLite-backed and replicated to an owned bucket, but it is not required for the local prototype and should not leak into the file format.

The longer design reasoning is in [arch.md](arch.md). Agent instructions are in [skills/hitslop/SKILL.md](skills/hitslop/SKILL.md).

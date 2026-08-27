# Hypermedia SQL

Drive the human view from SQLite. The webview is a screen. The commit is the paint.

This is a direction note and POC contract, not the `.slop` format specification. The file contract remains `spec/format.md`. The product architecture remains `arch.md` until the POC proves this model.

---

## Decision

Build the first POC inside the existing Swift/AppKit/WKWebView host.

- Keep SQLite, document windows, Quick Look, custom icons, previews, and the hover `NSPanel` exactly where they are.
- Keep existing `text/html` views working through `slop.query`, `slop.exec`, and `slop:change`.
- Convert Recipe Card and Habit Tracker to checked, scriptless, SQL-backed HTML.
- Send complete HTML snapshots to the webview and morph `document.body`. Do not design a wire-diff protocol.
- Defer Deno Desktop, Electrobun, Tauri, JSX, and TypeScript authoring experiments until this rendering model is validated.

The useful simplification is moving rendering out of every document, not replacing the native shell.

---

## The smell

Each `.slop` currently ships a tiny client application: empty markup, CSS, queries, a handwritten `render()`, event listeners, and an `onChange(() => load())` loop.

Agents already skip that application and speak SQL. Humans get a second rendering program that can drift from the schema. Every template reimplements querying, escaping, event wiring, loading, and refresh behavior. Changes to the `slop_view` row itself are not picked up by the page's data reload.

Recipe Card's `<script>` is a template engine in disguise. The host should own that engine once.

---

## Sources of inspiration

### Datastar and Hyperstar

The server owns state, renders HTML, and sends a new representation. A small client morphs that representation into the live DOM so focus, selection, and scroll can survive.

Datastar is useful for its declarative action and morphing ideas, not as the template language. Hyperstar is close to the desired data flow, but its application `view(ctx)` and refresh counter should not become part of a `.slop`.

### SQLPage

SQLPage's strongest idea is that SQL produces a narrow presentation model. Query aliases are the component properties, `CASE` produces presentation-ready values, and request values are bound rather than interpolated into SQL.

Borrow:

- SQL rows as a narrow, explicitly scoped view model.
- SQL for presentation decisions such as classes, labels, and counts.
- One repeated row template per query.
- Bound form values for mutations.
- Parse and validate once, then cache the compiled plan.
- Clear errors tied to the query or template that produced them.

Do not borrow:

- A catalog of generic components selected by a `component` result column.
- `.sql` files as HTTP routes.
- Streaming component output; hitSlop intentionally sends complete snapshots.
- SQLPage's `$name` versus `:name` request-variable system.
- A large Handlebars language with helpers, raw HTML, dynamic tags, and permissive missing fields.

SQLPage builds sites from predefined components. hitSlop must preserve the opposite property: each document can have a unique visual object. The adaptation is "SQLPage inside-out": bespoke HTML owns the composition, while small regions consume rows from SQLite.

---

## Mapping

| Hypermedia concept | Today | Checked HTML POC |
|---|---|---|
| Store | Domain tables in `document.sqlite` | Same |
| Server view | Per-document JS `render()` | Shared Swift renderer |
| View model | Objects returned through the JS bridge | Qualified SQLite result columns scoped by `slop-row` or `slop-each` |
| Action | `slop.exec(sql, params)` in authored JS | Named SQL action plus HTML form fields |
| Change signal | `data_version` then `slop:change` | Host renders and delivers an HTML snapshot |
| DOM update | Per-document `innerHTML` | Host-injected Idiomorph |

Facts stay in tables. The view remains a blob in `slop_view`. Agents continue to inspect and edit the document with SQL rather than scraping rendered HTML.

---

## Opt-in

Checked HTML is explicitly enabled inside the main view:

```html
<meta name="hitslop-renderer" content="sql-html-v1">
```

The outer `slop_view` row remains `text/html`, so this experiment does not require a format-version or reserved-table change. A view without this marker is legacy HTML and follows the existing runtime path unchanged.

The marker travels with the view body. Replacing the body through SQLite therefore replaces both the template and its rendering mode atomically.

---

## Explicit result cardinality

`slop-row` binds exactly one result row. It makes singleton document state explicit and checks its invariant at runtime:

```html
<slop-row as="recipe">
  <script type="application/sql">
    SELECT title, subtitle FROM recipe
  </script>

  <template>
    <h1>{{recipe.title}}</h1>
    <p>{{recipe.subtitle}}</p>
  </template>
</slop-row>
```

Zero rows and multiple rows are errors. Singleton tables should enforce at most one row in their schema, for example with `PRIMARY KEY CHECK (id = 1)`; `slop-row` additionally verifies that the required row exists. Do not add an unordered `LIMIT 1` to hide a cardinality error.

`slop-each` is the only loop in checked HTML and binds zero or more rows:

```html
<slop-each as="ingredient">
  <script type="application/sql">
    SELECT
      id,
      name,
      ready,
      CASE ready WHEN 1 THEN 'on' ELSE '' END AS ready_class
    FROM ingredients
    ORDER BY position, id
  </script>

  <template>
    <li class="ingredient {{ingredient.ready_class}}" id="ingredient-{{ingredient.id}}">
      <span>{{ingredient.name}}</span>
    </li>
  </template>
</slop-each>
```

The host executes the query and repeats the `<template>` once per row, binding the row to the required `as` alias. Zero rows produce no HTML. Both directives are removed from the rendered snapshot, leaving ordinary HTML.

The first version supports only qualified scalar placeholders:

```html
{{ingredient.column_name}}
```

Rules:

- `slop-row` and `slop-each` regions cannot be nested inside either kind.
- The `as` alias is required, uses a simple identifier, and is scoped to the direct row template.
- The SQL must be one statement and `sqlite3_stmt_readonly` must report it as read-only.
- Render queries accept no parameters; their state comes from the document database.
- Result names and placeholder names use simple identifiers: letters or underscore followed by letters, digits, or underscores.
- Duplicate result-column names are errors.
- Every placeholder must use the enclosing alias and exist in the prepared statement's result columns.
- Placeholders outside a `slop-row` or `slop-each` template are errors.
- Extra result columns are allowed.
- Placeholders are allowed only in text nodes and quoted attribute values.
- Values are assigned through parsed DOM nodes, not string-concatenated into HTML.
- Text, integers, and floating-point values render as escaped strings. `NULL` renders as an empty string. A referenced blob is an error.
- There is no general-purpose `for`, raw-HTML placeholder, nested loop, conditional, helper, or expression language in v1.

SQL remains the expression language:

```sql
SELECT
  count(*) FILTER (WHERE ready = 1) || ' / ' || count(*) || ' ready' AS ready_label,
  CASE WHEN count(*) > 0 AND min(ready) = 1 THEN 'complete' ELSE '' END AS state_class
FROM ingredients;
```

Authors must use `ORDER BY` when row order matters.

---

## Named actions

Mutation SQL is defined once and removed from the rendered snapshot:

```html
<script type="application/sql" data-slop-action="toggle-ingredient">
  UPDATE ingredients
  SET ready = 1 - ready
  WHERE id = :id
</script>
```

Ordinary HTML forms invoke it:

```html
<form data-slop-action="toggle-ingredient">
  <input type="hidden" name="id" value="{{ingredient.id}}">
  <button type="submit" aria-label="Toggle {{ingredient.name}}">Toggle</button>
</form>
```

The injected runtime intercepts the submit and sends this shape across the existing WebKit bridge:

```json
{
  "op": "action",
  "name": "toggle-ingredient",
  "params": { "id": "3" }
}
```

The client sends an action name and data, never executable SQL. The host resolves the name against the compiled view, binds the fields to SQLite parameters, commits, increments the document revision once, and paints again.

Action rules:

- Action names are unique.
- An action is one mutating SQLite statement.
- Only `:name` parameters are supported. Positional `?`, `$name`, and `@name` parameters are rejected.
- Explicit `BEGIN`, `COMMIT`, and `ROLLBACK` are rejected; the host owns the transaction.
- `data-slop-action` is supported on `<form>` only in v1.
- Control names are static, unique within the form, and must exactly cover the action's parameters.
- Values follow normal `FormData` semantics and cross as strings. SQL uses `CAST`, constraints, or normal SQLite affinity when numeric behavior matters.
- A missing parameter is an error rather than an implicit `NULL`.
- The existing restricted SQLite authorizer remains in force.

For autosave fields, the form opts into delegated change handling:

```html
<form data-slop-action="update-recipe" data-slop-trigger="change">
  <input id="recipe-title" name="title" value="{{title}}">
  <textarea id="recipe-tip" name="tip">{{tip}}</textarea>
</form>
```

Stable element IDs are strongly recommended because they give the morph algorithm an unambiguous identity and improve focus restoration.

Contenteditable bindings, action overrides on individual buttons, multiple values for one parameter, and multi-statement actions are deferred.

---

## Checked means checked at runtime

TypeScript alone would not make this safe. Type annotations disappear at runtime, and a cast such as `rows as Recipe[]` does not prove that SQLite returned those columns or value shapes.

The useful checks come from the actual artifacts:

1. Parse the HTML with a real HTML parser.
2. Compile the custom `slop-row`, `slop-each`, and action regions.
3. Prepare every statement against the document's SQLite schema.
4. Inspect query result-column names and action parameter names.
5. Match placeholders and forms against those names.
6. Render values through DOM text and attribute APIs so escaping is contextual.
7. Reject authored executable scripts, inline `on*` handlers, and `javascript:` URLs in checked views.

Validation runs:

- during `slop pack`, after `schema.sql` has been applied;
- when a checked document first opens;
- whenever the raw `slop_view['/']` body changes.

The compiled render plan is cached while the raw view body is unchanged. This is stronger runtime safety than a TSX assertion and remains portable to a future non-Swift host.

---

## Rendering and observation

The renderer creates a complete HTML snapshot inside one read transaction so all `slop-row` and `slop-each` regions observe one consistent SQLite snapshot.

### Host-owned writes

`PRAGMA data_version` does **not** change when the same SQLite connection commits. Therefore a form action cannot wait for WAL polling:

1. Resolve and bind the named action.
2. Execute it in the host-owned write transaction.
3. Bump `slop_meta.revision` once.
4. Commit.
5. Render immediately.
6. Deliver the complete HTML snapshot to the webview.

### External writes

For `slop exec`, another app instance, or raw `sqlite3`:

1. Poll `PRAGMA data_version` on the open host connection.
2. When it changes, render even if `slop_meta.revision` did not change.
3. Read `data_version` before beginning the render. A commit that races the render then remains visible to the next poll rather than being accidentally acknowledged without painting.

The format still recommends bumping `revision` and `modified_at`, but the visual POC should not require cooperative external writers merely to notice changed facts.

### Template changes

Before each refresh, read the current raw view body and compare it with the compiled source:

- Same source: execute the cached plan, send a full snapshot, and morph `document.body`.
- Changed valid source: compile it, render it, and call `loadHTMLString` because CSS, structure, or action definitions may have changed.
- Changed invalid source: keep the last good DOM and show the existing native render-failure overlay.

The next database change or manual Retry attempts compilation again.

---

## Morphing

The host injects a vendored Idiomorph runtime. Checked documents do not import it and do not carry a client framework.

For a data-only refresh:

1. Swift renders the entire HTML document.
2. The host passes the string as a WebKit function argument, not interpolated JavaScript source.
3. The injected runtime parses the snapshot and morphs the live `<body>`.
4. Active input values, focus, and selection are preserved where possible.
5. Preview generation runs after the morph settles.

This is not a server-side HTML diff. The payload is intentionally the complete rendered HTML. Idiomorph performs only the local DOM reconciliation required to avoid destructive reloads.

The generic runtime also suppresses duplicate submissions while a form action is pending and marks the form `aria-busy="true"`.

---

## Error behavior

- An invalid checked view fails `slop pack` rather than creating a package that cannot render.
- An invalid initial view uses the existing native failure screen.
- A query or compilation error during an update preserves the last good DOM and displays the native failure overlay.
- An action binding or SQLite error does not morph the page and does not bump the revision.
- A later valid database or template change clears the overlay and resumes normal rendering.
- Headless PNG/PDF rendering uses the same compiler and renderer, so it cannot silently disagree with the interactive window.

Errors should name the render region or action, include the underlying SQLite message, and identify cardinality, alias, missing placeholder, result column, or form parameter when applicable.

---

## POC implementation slices

### 1. Shared renderer

- Add an HTML parser dependency to the shared Swift core.
- Parse `slop-row` and `slop-each` regions, row aliases, templates, action definitions, and forms.
- Prepare and validate SQL against the live document schema.
- Render a complete snapshot and cache the compiled plan by raw source body.
- Expose named action execution with bound string fields.

### 2. Host delivery

- Add the generic form-action bridge operation.
- Inject vendored Idiomorph and the delegated submit/change handler.
- Render directly after same-connection actions.
- Render on every external `data_version` change.
- Morph data-only snapshots and fully load changed templates.
- Preserve the legacy event path for unmarked views.

### 3. All render entry points

- Route the interactive window through the shared renderer.
- Route headless PNG/PDF export through the same renderer.
- Make `slop pack` validate checked views after installing the domain schema.
- Keep preview and Finder icon generation downstream of the rendered webview.

### 4. Recipe Card

- Replace its document-owned JavaScript with checked `slop-row` and `slop-each` regions.
- Use SQL aliases and `CASE` for display-ready fields.
- Use named forms for toggle, add, edit, and delete operations.
- Replace contenteditable fields with styled inputs and textareas for the first POC.
- Give repeated rows and editable controls stable IDs.

### 5. Habit Tracker

- Replace its document-owned JavaScript with checked `slop-row` and `slop-each` regions.
- Pivot the fixed seven-day week in the `habit_week` SQLite view instead of adding nested loops.
- Use named actions for toggle, add, edit, and delete operations.
- Reuse the same SQLite view for the grid, heat map, and weekly summary.

---

## Acceptance tests

### Compiler and rendering

- `slop-row` accepts exactly one row and rejects zero or multiple rows.
- Ordered and zero-row `slop-each` regions render correctly.
- Text, numbers, and `NULL` render predictably.
- Hostile database text is escaped in both text and attribute contexts.
- Missing placeholders and duplicate result columns fail validation.
- Mutating render queries, query parameters, multiple statements, nested regions, unqualified interpolation, raw interpolation, executable scripts, and referenced blobs are rejected.

### Actions

- Named fields bind safely and SQL-injection strings remain values.
- Missing, duplicate, or unexpected fields are rejected.
- A successful action commits atomically and bumps revision exactly once.
- A failed action leaves both data and revision unchanged.
- Duplicate submits are suppressed.

### Refresh behavior

- A host action renders immediately without relying on `data_version`.
- `slop exec` updates an open checked document.
- A raw external `sqlite3` write updates the view even without a revision bump.
- Data changes morph the body.
- Raw view changes cause a full reload.
- Focus, input value, selection, and scroll survive representative morphs.
- A temporarily invalid template preserves the last good page and recovers after correction.

### Compatibility

- Recipe Card and Habit Tracker contain no authored JavaScript and perform no browser-side SQL queries.
- Interactive, PNG, PDF, cached preview, and Quick Look output show the same server-rendered facts.

---

## Explicitly deferred

- Deno Desktop, Electrobun, and Tauri shell replacements.
- A TypeScript or TSX authoring SDK. It could later compile into this portable checked-HTML representation.
- Datastar or Hyperstar as a shipped client dependency.
- A generic SQLPage-style component library.
- SSE, local HTTP, or a remote wire protocol.
- Server-computed HTML diffs or fragment patches.
- Nested `slop-row`/`slop-each` contexts, template helpers, conditionals, raw HTML, and dynamic tag names.
- Multi-statement actions and user-authored client JavaScript in checked views.
- Converting additional bundled templates before these two validate the model.

---

## Success criterion

The POC succeeds when Recipe Card and Habit Tracker have no document-owned rendering program, yet:

- SQLite remains the sole source of truth;
- internal and external commits repaint the open document;
- form values are safely bound to named SQL actions;
- focus and editing state survive data refreshes;
- invalid view/schema contracts fail with precise errors;
- window, export, preview, and Quick Look all use the same renderer; and
- the native Mac document experience is unchanged.

SQLite commits HTML. The webview displays it. The Mac host is already the server.

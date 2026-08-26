# hitSlop — architecture, the bet, and what else it could be

A `.slop` is a living document. Not an app with a database behind it. The database *is* the document. The window is a host. The AI speaks SQL. You speak clicks. Same file.

That sounds small. It is not.

---

## Evaluation

**The idea is real.** HyperCard, HyperClay, Potluck, SELF, and the SQLite application-file-format paper are the same shape in different decades: one object that holds its data, its look, and enough behavior to be useful — owned by you, inspectable, copyable.

JSON-era hitSlop proved the human↔AI loop and then reinvented a database (file watch, debounce, arrayOps, schema introspection, IPC). SQLite is that machinery with the costume off. The Silo Wall window working is the proof: a click is a `COMMIT`; `sqlite3` on the same file is a second client; the host did not have to know what a “route” is.

**What it is good at**

- Personal software that should have been a file: tick lists, invoices, habit grids, split-the-bill, a climbing log.
- LLM-generated *unique* mini-docs. The model writes DDL + HTML; you get an object, not a template instance.
- Agent workflows. `SELECT` / `INSERT` beat “rewrite this 40 kB JSON blob.”
- Longevity. Data lives longer than HitSlop.app. Library of Congress already blesses SQLite.

**What it is not**

- A general app builder. Myst-scale HyperCard is a trap. If you need a linker, you wanted SELF, not this.
- Google Docs. Realtime multiplayer on a raw sqlite file over the open internet is how you get the comment from HN: *“I would never, ever, ever allow an internet-facing service binary to be self-writable.”* That warning maps 1:1 onto “anyone’s browser may `slop.exec`.”
- A replacement for every feature of the old 36-template Swift app. The fresh host deliberately starts with the document fundamentals: UTI ownership, icons, double-click, Quick Look, duplication, sharing, and export. More templates and a theme editor can return after the file model proves itself.

**The bet:** documents that *compute* should be files an AI can query. If that is true, the rest of the product is a host and a prompt.

---

## Problem

Your life is trapped in apps your AI cannot see.

A budget in a SaaS, a tick list in a notes app, a climbing log in a spreadsheet — each is either interactive and opaque, or plain text and dead. hitSlop’s original README named the false choice. The JSON package was the first way out. It still made the document a *pile of files* (the SQLite paper’s category), with WAL-like problems (debounce, torn writes) and no query language.

SELF showed the collapse for executables: admit the file is a database and `readelf` becomes `SELECT`. hitSlop is the document half. You do not need `binfmt_misc`. You need a card you can hold.

---

## How it works (now)

```
hitSlop/TemplateSources/Habit Tracker/   authoring (working tree)
  meta.json
  schema.sql                       domain tables + seed
  view.html                        the UI
  docs.md                          notes for the next AI

        template build
            │
            v
Habit Tracker.slop/                Finder package  (Show Package Contents)
  document.sqlite                  application_id = 0x534C4F50 ('SLOP')
  document.sqlite-wal              only while open, *inside* the package
  document.sqlite-shm
```

`document.sqlite` holds four reserved tables plus whatever the document invented:

| Table | Role |
|---|---|
| `slop_meta` | title, window size, provenance |
| `slop_view` | HTML (and other) bodies, keyed by path. `'/'` is the window |
| `slop_docs` | prose for humans and AIs |
| `slop_assets` | optional blobs |
| *everything else* | the document’s facts (`routes`, `log`, `stats` VIEW, …) |

The implemented host is **hitSlop.app**: AppKit/SwiftUI around WKWebView and system SQLite. It registers `.slop` as a Finder package, loads `slop_view` HTML, injects `slop.query` / `slop.exec` / `slop.transaction` / `slop.onChange`, watches external commits, maintains the cached Quick Look preview, and checkpoints on close. There is no localhost server.

The native Swift Argument Parser CLI (`slop stat`, `slop query`, `slop exec`, `slop duplicate`, `slop export`) and `sqlite3 Habit\ Tracker.slop/document.sqlite` are additional hosts. The CLI is embedded in the application bundle. WAL is how the window, the CLI, and an agent share the file without a custom RPC.

Authoring vs document: the folder with `view.html` is source. The `.slop` package is what you open, copy, and share. Packing is `slop pack` (`CREATE` + `INSERT`). “Show Package Contents” shows the database, not a second copy of the HTML (that would drift).

```
click in UI  →  UPDATE/INSERT  →  COMMIT  →  the file
sqlite3      →  UPDATE         →  COMMIT  →  onChange  →  UI re-queries
LLM          →  slop exec      →  same
```

---

## Why SQLite (not JSON, not zip, not HTML-as-DB)

The [SQLite application file format](https://sqlite.org/appfileformat.html) paper is the spec we accidentally restated:

- Single-file document metaphor (we hide WAL *inside* a Finder package so it stays true)
- Atomic commits, incremental writes, no Save
- Schema is the format documentation (`slop schema`)
- Concurrent processes
- Accessible in 2046 without HitSlop.app
- Extensible with `ALTER TABLE` / `CREATE VIEW` — Potluck’s gradual enrichment, performed as DDL

HyperClay is right that one shapeable object beats a backend. It is wrong to make the DOM the database: an AI should not grep markup to find your rent. Facts are tables. The view is a blob.

SELF is right that tooling collapses into SQL. We do not take the loader, mmap, or “the program is rows of machine code.” jdub’s follow-up is the boundary: **migrations and SIGHUP are cute for a local daemon; they are malpractice on a public writable binary.** Our equivalent of that mistake would be “put a `.slop` on S3 and let the internet `exec`.”

---

## Uniform verbs (Plan 9) and MCP

The HTML in Silo Wall is a climbing guidebook. The HTML in the next `slop create` might be a diner guest check. An agent cannot learn a new UI per document. It needs **the same verbs on every card**, the way every Plan 9 server speaks 9P — `walk`, `stat`, `read`, `write` — no matter whether the file is a disk, a window, or a process.

celld-bots already uses the useful slice of that idea: a stable path is the identity (`/rooms/general/bots/weather`). A `.slop` is the same kind of object.

### The namespace

Every document, unique UI or not, exposes the same tree. Domain tables are discovered, not special-cased.

```
/slops                              # the library (a folder of packages)
/slops/climbing                     # one document
/slops/climbing/ctl                 # slop_meta  (title, size, theme)
/slops/climbing/docs                # slop_docs  (the man page *in the file*)
/slops/climbing/schema              # sqlite_schema
/slops/climbing/view                # slop_view body
/slops/climbing/tables              # walk: routes, log, …
/slops/climbing/tables/routes       # the rows
/slops/climbing/views/stats         # computed
```

`ATTACH` is `bind` / `mount`: `/slops/life` can walk `/slops/climbing` without copying it. That is the home stack.

### The verbs

Same operations on every node. The host, the CLI, `sqlite3`, and a SKILL.md are skins over this. MCP is optional later.

| Verb | 9P cousin | Meaning on a `.slop` |
|---|---|---|
| **walk** | walk | list library; list tables |
| **stat** | stat | meta + schema + `slop_docs` |
| **read** | read | `SELECT` (or the view HTML, or a blob) |
| **write** | write | `INSERT` / `UPDATE` / `DELETE` |
| **create** | create | new document, or `CREATE TABLE` / `ALTER` (grow an organ) |
| **remove** | remove | drop a row, a table, or a package |
| **watch** | (notify) | `onChange` — the window and the agent see the same commit |

The agent’s runtime loop is then boring, which is the point:

1. **stat** the document — read `slop_docs` and `sqlite_schema`. That is how it learns *this* climbing log without a prior template.
2. **read** — `SELECT * FROM stats` / `SELECT name, status FROM routes`.
3. **write** — `UPDATE routes SET status = 'sent' WHERE name = 'Bolt Tax'`.
4. The host’s **watch** fires; the UI re-queries. No scrape, no screenshot, no special climbing-log tool.

You already did this by hand: `sqlite3` wrote Farmer’s Daughter to sent and the window updated. A SKILL.md is that loop written down so the next agent does not invent `tick_climb`.

### Skill first, not MCP

The file is already a protocol. `sqlite3` is the client. An MCP server would wrap SQL in JSON-RPC so the model can avoid the shell — but the shell is the honest interface, and every coding agent already has it.

A skill (`skills/hitslop/SKILL.md`, plus `AGENTS.md` / `CLAUDE.md` at the repo root) is better as the default:

- No extra process. No tool schema to keep in sync with `sqlite_schema`.
- Works in Claude Code, Grok, Cursor, anything that can run bash.
- The agent **stat**s by reading `slop_docs` and `.schema`, then **read**/**write**s with `slop query` / `slop exec` or `sqlite3 document.sqlite`. The open window is a WAL peer, not an API the skill has to call.
- One skill for every unique document. The HTML can look like a guidebook or a guest check; the verbs do not change.

MCP is a later adapter for clients that cannot (or should not) shell out — a hosted actor, a phone app, a browser extension. Same verbs, different transport. Do not start there. Do not generate one tool per template (`tick_climb`, `add_expense`). That is the app silo again.

```
slop schema FILE      →  stat
slop query  FILE sql  →  read
slop exec   FILE sql  →  write
slop create / duplicate → create
sqlite3 FILE/document.sqlite  →  all of the above, no CLI required
```

### What the agent is not allowed to pretend

- It does not get a unique tool because the HTML looks like a guidebook. The verbs are the interface; the HTML is for humans.
- Local agent writes via `sqlite3` are owner writes (you ran the tool). A public host is not that; do not expose `exec` on the internet.
- `slop_docs` is mandatory for generated docs. If the file cannot explain itself, **stat** is incomplete and the agent has to guess. The prompt for `slop create` should treat `docs` as load-bearing, not a nicety.

### Why this is the Plan 9 part worth stealing

Not 9P-over-TCP. Not a kernel. The slice celld-bots already named: **stable resources in a simple namespace, same protocol for every object.** HyperCard stacks were each a private universe. `.slop` files look different on screen and identical on the wire. That is how an agent lives with a hundred unique mini-docs without a hundred skills.

---

## Crazy (and less crazy) directions

Ranked from “build next” to “write a conference talk.”

### 1. Template creation now; generative creation later

The implemented product loop starts from legible starter packages. The picker (or CLI) clones a template with SQLite's backup API, gives it a fresh identity, and lets the user choose its folder.

```
slop create --template recipe-card --output lunch.slop
slop open lunch.slop
```

The later show is still an LLM that emits a *different looking object* every time. The experimental prompt in `src/create-prompt.md` can become a separate command once generated schemas, documentation, and views can be validated before they are opened. That should augment the template flow, not make creation depend on a model or API key.

### 2. Publish: local object → URL (celld / S3)

**Yes.** This is the HyperClay + SELF-httpd move, and it is the right way to get “social,” with one hard rule.

A `.slop` is already a tiny web server’s worth of state: routes are `slop_view` rows, writes are SQL. Hosting it:

| Layer | What it is |
|---|---|
| **Read replica** | Upload `document.sqlite` to S3 (or a celld durable object). `GET /` selects `slop_view`. Anyone can look. Nobody writes. This is a zine, a tick list you published, an invoice you sent. |
| **Single-writer actor** | One celld/Rivet actor *is* the document. All writes serialize through it (the actor *is* the WAL). Browsers talk HTTPS; the actor talks SQLite. This is a guestbook, a RSVP, a shared climbing log for a friend group. |
| **Fork, don’t merge** | “Make a copy” is `cp` / `INSERT…SELECT` into a new actor. GitHub-gist energy, not Figma energy. |

celld is a particularly good fit because you already think of bots as packages with per-installation SQLite that later becomes `ctx.storage`. A published `.slop` is an installation: code (the host) + durable state (the file). The document does not become a multi-tenant Postgres schema. It stays a file that happens to live behind an actor.

**Do not** put a writable sqlite on a public S3 URL and run the current `slop.exec` bridge in every visitor’s browser. That is SELF-httpd’s button on the open internet, and jdub is right. Writes need identity (who) and an authorizer (what SQL). The page connection is already ATTACH-blocked; a public host needs a grant list (`INSERT INTO log` yes, `DROP TABLE` no, `slop_view` only for the owner).

A sane first publish:

```
slop publish climbing.slop
# → https://slop.page/silo-wall     (read)
# → owner cookie can POST /exec
# → “Duplicate to my machine” downloads the package
```

Litestream / S3 is the backup and the CDN for the read replica, not the multiplayer bus.

### 3. Multiplayer without CRDTs (first)

CRDTs are how you get Google Docs. You do not have that problem yet.

- **One actor, many tabs.** SSE / WebSocket from the actor: `onChange` is already the UI hook. Ten people ticking the same crag is a serialized sqlite, which is boring and correct.
- **Fork + merge as SQL.** `sqldiff` / `INSERT OR IGNORE`. Human resolves the two cells that actually conflict. The local-first paper said conflicts were rarer than feared.
- **Home stack.** `life.slop` holds almost no data. It `ATTACH`es `budget.slop`, `climbing.slop`. Your life is a JOIN. Publish the home stack as a dashboard; keep the attached files yours.

Virtual tables (the HN “mount the filesystem as SQL” reaction, Steampipe, osquery) are how a *library* of slops becomes queryable without eating them into one megafile. A folder of cards is a directory. A query over that folder is a vtab. Do not pack busybox into one DB.

### 4. The document in a tab, no app

sqlite3 runs in WASM (`sql.js` / wa-sqlite). A host that is just static files + a wasm sqlite can open a `.slop` you dragged onto a page, or a gist. Offline, no install. HyperClay’s “it’s an HTML file” with the data not stuck in the DOM.

Pair with (2): the published URL is that page, pointed at the actor or the replica.

### 5. The document grows organs

Potluck: start messy, add structure when it pays. Here the AI is the person writing searches.

“Also track beta videos” → `ALTER TABLE routes ADD COLUMN beta TEXT` + a new widget in `slop_view`. No app update. That is the HyperCard erector set. The 36 templates become *starter packages*, not a platform constraint.

Undo belongs in the file (the SQLite paper: triggers, surviving quit). Not an in-memory Swift stack.

### 6. Plugins as rows, not dylibs

XJ6w9dTdM wanted BEFORE/AFTER hooks on ELF symbols. Translate: a `hooks` table (`after_insert_log` → SQL or a tiny script). Relink is `UPDATE slop_view`. You already reload on view change. You do not need a dynamic linker.

A Lisp/Steel runtime inside the file is optional later, for timers and OS hooks SQL cannot express. HTML already gives you a JS runtime. Use it.

### 7. Polyglot cursed objects (do not productize, do steal the energy)

HN: a PDF that is also an NES ROM; PNG-as-spreadsheet; Doom-in-CSS. A `.slop` that is also a valid HTML file (the view blob concatenated after the sqlite header with a tiny trampoline) would be a party trick and a terrible format. The *useful* version is already true: `file(1)` says SQLite, the app says document, Datasette says tables.

OS/400 “everything is a queryable object” is the serious version of that joke. Finder packages + `sqlite3` on the command line is as far as macOS will let you take it without writing a filesystem.

### 8. What to refuse

- Internet-facing self-writable hosts with unconstrained SQL from the page.
- CRDT/sync engines before two people actually want to share a tick list.
- Replacing ELF. Not our circus.
- Making the user learn SQL. They click. The AI types. The file is honest if either opens `sqlite3`.
- A canvas/WebGPU document. Structure is the whole point; pixels are opaque to the agent.

---

## Suggested sequence

The local proof is now implemented: native document host, template picker, two different starter packages, auto-save, duplication, PNG/PDF export, CLI, UTI, icon, and cached Quick Look.

1. **Use the two templates in anger.** Pay attention to which mutations feel document-like and which demand a full app.
2. **Add undo inside the file and tighten the SQLite authorizer.** Do this before treating arbitrary downloaded cards as trusted.
3. **Add validated generative creation.** Generate several documents that do not look like the starters; if they converge on SaaS dashboards, fix the authoring prompt rather than the host.
4. **Prototype `slop publish` with one single-writer celld actor**: owner writes, public reads, event broadcast, S3-backed recovery, and “Download package.”
5. **Explore a home stack** over a user-selected library, with cross-document queries mediated by the host instead of granting page HTML arbitrary `ATTACH`.

The host should stay small. The file has to stay honest.

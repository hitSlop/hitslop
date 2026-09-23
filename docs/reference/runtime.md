# Runtime reference

## Architecture and client boundaries

A `.slop` combines immutable authored app code with a structured local document. Each WebView owns one live Loro replica. The host supplies the document SDK and pinned JS/WASM engine for its selected runtime contract. Svelte observes immutable snapshots and writes typed operations. Loro events patch the snapshot incrementally: only touched containers are re-read and unchanged rows keep their identity. Remote bytes are validated in full on a staging fork before import. Commits carry an origin (`ui` or `cli`) and optional history message. Lazily created map children (optional composites, record entries) use Loro mergeable containers so concurrent creation merges. Swift persists opaque bytes; it does not interpret application fields.

```text
App → typed operations → host-supplied Loro runtime
                              ↓ update bytes
                        native storage queue → SQLite
CLI → owner's Unix socket ────┘
CLI → exclusive lock → engine-only WebKit → Swift SQLite (closed document)
```

An edit returns after in-memory acceptance. `flush()` and successful CLI mutations acknowledge local persistence. Renderer death can lose unsaved memory. There is no network acknowledgement or second document engine.

The macOS client retains Core, HitSlopWasm, Runtime, Host frameless windows and hover toolbar, TCA Features, local Catalog, Firebase Analytics/Crashlytics, Sparkle, and NativeCLI. HitSlopWasm integrates the shared engine; HitSlopRuntime connects it to the client. The installed helper needs neither Node/Bun nor a running app. Closed document operations never load authored app code.

The catalog combines immutable bundled starters, `~/.hitslop/templates`, and Recents. Users unpack external downloads before placing valid `<slug>.slop` masters in that folder. Create makes a separate writable document. Bundled and installed templates have source-specific identities; categories come from local manifests. Account UI, OpenAPI/Registry, hosted discovery, and sharing are deferred.

## Package layout

TypeBox defines the manifest and platform envelopes. Only `runtime: "hitslop-v1"` is accepted. The manifest requires author, slug, title, description, categories, and presentation.

```text
Example.slop/
  manifest.json
  app.html
  assets/                       immutable compiled code, CSS, and resources
    runtime.json                contract, minimum revision, and provenance
    theme.css                   token defaults as CSS variables
    theme.json                  declared token defaults
  state.schema.json             {format:1, root:...} descriptor, not JSON Schema
  initial.json                  immutable creation-only values
  .agents/skills/hitslop-document/SKILL.md
  QuickLook/
    Preview.png                 refreshed in writable documents
    Icon.png                    optional immutable authored icon
  state/                        writable documents only
    document.sqlite             opaque checkpoint/update bytes, format 1
    writer.lock                 permanent ownership inode
    host.lock                   live socket discovery
    theme.json                  optional token overrides
    attachments/<sha256>        optional immutable imported blobs
```

Templates contain no `state`, `stores`, source, dependencies, caches, or editable structural stylesheets. Builds add document guidance; missing or changed guidance does not prevent opening an existing document. A built or registered master is immutable and must be copied before editing. Initial values seed only a new database. Schema changes require new documents; pre-v1 packages are not migrated.

Host resources are served at stable `slop://app/__runtime__/` URLs, backed by the selected `runtimes/<contract>` directory. App bundles must not embed Loro or the document implementation. Preview uses the same runtime with disposable memory storage. No executable code is downloaded.

`assets/runtime.json` declares positive integer `runtimeContract` and `minRuntimeRevision`; SDK/Loro/protocol fields record provenance. Opening checks supported contract and minimum revision before storage opens. Authored source and CLI identities must match for compilation. Capture requires a helper supporting the requested contract/revision. See [versioning](../versioning.md) for the full compatibility contract.

## Persistence and ownership

Swift owns `state/document.sqlite`: `user_version=1`, DELETE journaling, synchronous FULL, and opaque checkpoint/update bytes. Checkpoint replacement and covered-row deletion are atomic. The exact canonical descriptor is the storage key. Generation is a storage token, not a Loro version.

One OS flock on permanent `state/writer.lock` owns each local package. Never unlink it or bypass a busy writer. `state/host.lock` is discovery only. A busy writer with unreachable discovery is an error, never permission for another writer.

Autosave runs after 200 ms. Flush commits text drafts and scalar previews, persists updates, and checkpoints at 256 updates or 4 MiB. Native load/write limits are 4,096 rows and 32 MiB aggregate checkpoint/update bytes. The engine checkpoints before appending beyond those limits. Checkpoints retain history; automatic history pruning is deferred. Oversized snapshots fail visibly while retaining pending edits. Valid existing shallow checkpoints remain readable. Oversized existing packages are refused intact; compact cannot promise recovery of unloadable packages.

After an append commits but acknowledgement is lost, the engine reloads metadata and retains the same Loro bytes. A later flush imports them idempotently. Repeating the user's operation is not idempotent. CLI mutations serialize and acknowledge persistence; no receipts, public retry identity, or automatic replay exist. After an uncertain result, use `get` before another edit. `get` flushes drafts and pending writes. `hello` supplies the WebView session epoch for mutation/export handshakes.

Prepare-close commits drafts and freezes edits. Failed saves retain ownership and native retry UI; cancel-close restores editing. Successful close removes discovery, destroys the WebView/bridge, drains storage, closes SQLite, and releases ownership. Quit prepares every document before releasing any. Close before moving or renaming packages. iCloud and other synced folders are unsupported.

Opaque imported attachments live at `state/attachments/<sha256>`, outside Loro. Imports store and fsync bytes before a synchronous typed document transaction commits the reference. Pending imports participate in flush/close and retain failed writes for native retry. The owner enforces 10 MiB per file, 100 MiB total, and 256 files, rejects links, and verifies hashes on read. Duplication copies attachments; runtime templates contain none. Unreferenced blobs remain until a future explicit garbage-collection policy.

Theme overrides are bounded host presentation state, not a document projection. The 64 KiB `state/theme.json` map contains declared token overrides. Theme commands share ownership with document operations. JavaScript validates declared names and CSS values; native code validates envelopes, isolation, and size. Arbitrary CSS override files are unsupported.

## Opening and recovery

Document windows remain hidden until runtime readiness and bounded font readiness, then reveal directly and let WebKit paint normally. There is no extra animation-frame timeout or transparent-window staging. Opens taking more than one second from the original request display cancellable native progress. Package validation, runtime selection, writer ownership and SQLite setup run on the preparation queue; cancellation disposes acquired storage before returning. Window skins reuse their validated image for that open. The hover toolbar and editor discovery are created only on first hover. Catalog launches prewarm WebKit by compiling the bundled runtime once in a throwaway WebView that serves no package files and is never handed to a document; a document open releases it. Closing cancels presentation. Startup failures reveal native error UI. Quick Look artwork serves Finder and catalog display, not an opening placeholder.

Debug `HITSLOP_STARTUP_TIMINGS=1` logs elapsed native preparation, runtime readiness, font readiness, presentation, and page-relative `hitslop:*` boot marks without document values or paths. `HITSLOP_STARTUP_BENCH=1 bun run swift:test --filter documentStartupTimings` retains the fresh-document benchmark. Use `HITSLOP_STARTUP_BENCH=1 bun run swift:test -c release --filter savedDocumentStartupTimings` for existing documents: it seeds saved edits in a separate helper process, then reopens Quick Checklist, Small Expenses, a 1,000-row checklist and a skinned fixture ten times each. Output records preparation/readiness/reveal durations and whether progress appeared. Set `HITSLOP_STARTUP_PREWARM=1` to prewarm for two seconds before measurement, `HITSLOP_STARTUP_CASE=quick-checklist` (or another case) to measure that case first in a fresh process, `HITSLOP_STARTUP_SAMPLES` for the sample count, and `HITSLOP_STARTUP_FOREGROUND=1` to activate the benchmark app. Compare the first sample separately from subsequent samples; report warmed median and p95 rather than enforcing machine-dependent CI thresholds. Caches and machine activity affect these diagnostics.

Application-render errors and save failures have separate recovery paths. Renderer recovery retains the writer lease while replacing the WebView and reopening saved bytes. Unsaved renderer memory cannot be recovered. Host and CLI exports flush before capture; expired captures cannot publish output.

## Security boundaries

Authored code can change or damage its own document. Runtime operation validation is not a separate security boundary from code sharing that page. Native code validates package isolation, symlinks, bridge envelopes, and resource sizes. Credentials never belong in authored code.

The resource scheme exposes only `app.html`, descriptor, initial values, immutable assets, and host runtime resources. Databases and discovery files are not served. Descriptor-relative no-follow reads reject nonregular files and enforce 25 MiB per resource. Immutable packages are limited to 256 entries and 50 MiB. Symlinks are rejected during opening and resource reads.

CSP permits local scripts/WASM, local and HTTPS connections/media, inline styles, and local/data/HTTPS/blob images. CORS remains enforced. Remote scripts and JavaScript eval remain blocked; fonts stay local/data. Native navigation cancels external navigation; explicit HTTP(S) links open in the system browser. Camera/microphone grants are not part of v1.

Bridge calls must originate in the main frame at `slop://app` and match generated TypeBox envelopes. Serialized requests are bounded to 48 MiB, with storage bounds checked before blob materialization. SQLite uses NOFOLLOW and `trusted_schema=OFF`. Socket request/reply bounds are 1 MiB/16 MiB, one request per connection, with bounded concurrency/timeouts. The server command deadline is 30 seconds; the client waits 35 seconds.

Export destinations must be outside the source package. Capture stages output and publishes by atomic rename before its deadline. Failures do not replace existing output. A lost acknowledgement leaves an uncertain outcome; inspect the destination before retrying.

## Capture and Finder integration

Svelte's `<Slop>` boundary registers optional lazy export/icon snippets against the existing document. Framework-neutral targets must be direct body children. Native code consumes controller geometry and its `dedicated` flag rather than a separate DOM-marker protocol.

Capture commits drafts, flushes persistence, waits for fonts, visible images, and stable layout, and blocks edits. Success and failure restore focus, selection, scroll, styles, and input rendering. Dedicated exports do not inherit native masks. Fallback capture can hide marked editing controls and replace native text inputs with wrapping text.

PNG uses 2× rendering, limited to 16,384 pixels per side and 24 megapixels. PDF retains text/vectors on a continuous page, recomposing WebKit internal pages when needed and scaling to a maximum 14,400-point dimension. Icons use a transparent 512px square.

Native PNG compression runs system zlib off the main actor. It preserves pixels, dimensions, transparency, and metadata, removes alpha only for fully opaque images, and retains the smallest successful candidate or the original. It covers template artwork, refreshed previews, Finder icon sources, and PNG exports; it does not rewrite existing packages or PDFs.

Build/register capture disposable copies, leaving masters state-free. New documents derive Finder custom icons from immutable `QuickLook/Icon.png`. Close refreshes `QuickLook/Preview.png` and optional Finder icon metadata using saved-state snapshots, without rewriting the immutable icon. Catalog/Finder display PNGs without loading the engine.

Live exports use the current editor width and selected view. Closed exports render a saved-state snapshot with the app's initial view. Quick Checklist's tab selection is not persisted, so a closed export starts in To do.

## Telemetry

Firebase configuration, Analytics, and Crashlytics remain enabled in Release; Debug collection is disabled. Auth/App Check are deferred. Events record launch, creation source, opening, duplication, and export format. Cancelled pickers do not record success. Nonfatal categories are create, open, save, export, and renderer. Reports exclude document paths, titles, contents, authored error strings, and raw error userInfo. Release validation includes actual Firebase delivery and symbolication; unit tests cannot establish those.

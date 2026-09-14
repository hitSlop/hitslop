# Apple application state

The macOS app uses TCA 1.26.2 for catalog and document coordination. iOS still uses
its existing SwiftUI models. The `.slop` bridge and document format are unchanged.

## Ownership

- `HitSlopFeatures` defines `AppFeature`, `CatalogFeature`, `DocumentFeature`, and
  their dependency clients. Feature state contains values, never native windows,
  WebKit sessions, package contents, or image buffers.
- `HitSlopCatalog` composes the application store, implements live clients, and
  connects each native window to its scoped document store. The app delegate
  forwards application events and menu commands to `SlopApplicationCoordinator`.
- `HitSlopHost` owns windows, toolbars, rendering, and native command execution.
  `HitSlopRuntime` retains ownership of the bridge and serialized storage. Neither
  target, nor `hitslop-native`, depends on TCA.

Catalog search, sort, and source selection share one state. Hosted subscriptions
are cancelled when replaced; generation checks reject queued results from an old
subscription. Local templates and recents are materialized before view rendering.
Destination-picker cancellation is a normal creation result.

Each document has an in-memory UUID and canonical file URL. Its state is inserted
before downloading begins, so repeated opens cannot create duplicate windows.
AppKit determines focus; commands capture their document identity when invoked.
A menu command and the corresponding toolbar button send the same feature action.

Export, duplicate, and close operations serialize per document. Close waits for an
active operation, then awaits the guest flush, working-copy save, and preview
snapshot preparation. State is removed only after native teardown. A save failure
keeps the document open. Quit drains creation/opening/operations before preparing
all remaining documents and applying the existing preview-refresh grace period.

Native dragging, hover, resizing, WebKit rendering, and routine bridge traffic do
not send TCA actions. Native adapters observe only their scoped document state.

## Validation

Run `swift test --package-path apps/apple/Packages/HitSlopApple` for reducer and
native integration tests. Reducer tests use controlled clocks and clients; native
close tests exercise the real WebKit flush barrier, including rejection and retry.
Run the timing-sensitive WebKit suite without concurrent full app builds.

Build both macOS configurations and the iOS simulator with the existing Xcode
schemes. Command-line Xcode builds use `-skipMacroValidation` for the reviewed,
pinned dependency graph; CI and release scripts include that flag. This does not
change the machine's global macro trust settings.

For performance comparisons, use equivalent release builds and disposable copies
of the same documents, with 1, 5, and 10 open windows. Measure idle CPU, memory,
opening, switching, and export separately; Swift package/macro compilation time
is a different cost from application runtime performance.

The optional `documentPerformance` test uses hidden native windows. Run each size
in a fresh process to avoid capture-buffer caches from earlier sizes skewing RSS:

```sh
HITSLOP_RUN_NATIVE_BENCHMARK=1 HITSLOP_BENCHMARK_COUNTS=10 swift test --package-path apps/apple/Packages/HitSlopApple -c release --filter documentPerformance
```

Repeat with counts 1 and 5. `HITSLOP_BENCHMARK` lines contain JSON measurements.
Host RSS and CPU exclude WebKit/GPU child processes. Export measures the native
capture pipeline, excluding the save panel; this does not replace interactive
window and menu smoke tests.

## TCA follow-up conventions

Feature clients use `@DependencyClient` with unimplemented test endpoints. Tests
must stub the endpoints they exercise; the explicit `CatalogClient.empty` fixture
is reserved for native tests that do not present a catalog. Live implementations
are still installed at the macOS composition root.

Catalog controls use action-sending bindings and observe state at the sidebar,
results, and detail boundaries. Clearing search is immediate; other typing uses a
180 ms controllable debounce. A category change clears the old query's entries
before subscribing. Sort refreshes preserve the current results and search.

`CatalogScanner` performs local-template and recent-document filesystem scans on
its own actor. `LocalTemplateStore.refresh()` is now asynchronous and joins an
existing scan. Its `snapshot` publishes templates and issues atomically; the
`templates` and `issues` accessors remain available. Filesystem events invalidate
older scans without rebuilding the watcher. Subscription teardown cancels the
scan and watcher. Recent URLs are captured on MainActor, then canonicalized and
scanned in the background; request generations reject obsolete responses.

Errors use `@Presents AlertState`. Native presentation preserves state until the
actual dismissal callback, queues alerts per window, and checks identity before
acknowledging a dismissal. Runtime failures remain document state and drive the
native overlay; the standalone host keeps its native fallback. A retry clears the
previous failure when it starts, so its completion cannot erase a newer failure.

The catalog benchmark compares the previous synchronous recents adapter with the
background scanner on 100 disposable packages, each containing 128 small assets:

```sh
HITSLOP_RUN_CATALOG_BENCHMARK=1 swift test --package-path apps/apple/Packages/HitSlopApple -c release --filter catalogPerformance
```

It reports total scan time and the largest interval of a 1 ms MainActor heartbeat.
These measurements describe responsiveness under a synthetic filesystem workload;
they are not frame-rate or network benchmarks. Run without concurrent app builds.

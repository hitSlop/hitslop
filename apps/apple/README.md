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

## Google account sign-in (macOS)

Account settings use Google Sign-In and Firebase Auth. Local documents do not
require authentication. Firebase's auth-state listener owns the app session;
credentials stay in the SDK-managed Keychain and never enter `.slop` packages or
the JavaScript bridge. Sign out clears both SDK sessions without deleting files.

The canonical configuration is `App/macOS/GoogleService-Info.plist`, for Firebase
project `hitslopapp` and bundle ID `com.hitslop.app`. It must include `CLIENT_ID` and
`REVERSED_CLIENT_ID`. The latter must match the URL scheme in `App/macOS/Info.plist`.
Use the iOS-type OAuth client associated with this Mac bundle ID, as required by
Google's Apple-platform SDK. Enable Google in Firebase Authentication and set the
OAuth consent branding to hitSlop. If the consent screen is in Testing, explicitly
allow the test accounts. No Android SHA-1 fingerprint is needed for the Mac app.

The Mac target uses its own `App/macOS/hitSlop.entitlements` with the application's
Keychain access group; this does not enable App Sandbox. Use an Apple-issued
signing certificate to test credential persistence. Ad-hoc/unsigned binaries are
not an authentication acceptance test. Verify Developer ID release provisioning
allows the Keychain group when packaging a release. For a direct signed test build,
set `CODE_SIGN_STYLE=Manual`, your `CODE_SIGN_IDENTITY`, and
`HITSLOP_PROVISIONING_PROFILE="hitSlop Developer ID 2029"`. The custom setting
applies the profile only to the app; setting `PROVISIONING_PROFILE_SPECIFIER` on
the entire build incorrectly applies it to Swift package resource bundles. The
release packager preserves the exported app’s entitlements when re-signing; it
must not replace them with an empty entitlement file.

Google's SDK presents authorization and handles its callback; Firebase exchanges
the resulting credential. The Firebase session restores directly from Keychain;
we do not silently sign back in from a second Google-only session after sign-out.
Real Google authorization is disabled when `HITSLOP_USE_FIREBASE_EMULATORS=1`.
Reducer tests inject session streams and sign-in outcomes without contacting Google.

Acceptance: sign in from Settings → Account, cancel and retry, relaunch and confirm
the same Firebase user, sign out and relaunch again, then open/edit/export a local
document while signed out. Verify these in a signed build; success in reducer tests
alone does not establish OAuth consent or Firebase provider configuration.

## Native sharing

The toolbar's Share command opens hitSlop's native collaboration panel. Google
sign-in enables authenticated invitations; Send a copy works without an account
and only then opens Apple's sharing picker. Duplicate and Send a copy reset the
document identity/history while retaining valid visible data, media, and theme.

The app handles `hitslop://join/<documentId>#<invite>` URLs. Joining requires an
already installed matching template and asks where to save the shared replica.
No executable package code is downloaded through a room. A Finder copy retains
the document identity; its recipient still needs room membership to sync.

Build and deploy the `shareDocument` callable and `syncRooms/**` Firestore rules
before testing live invitations. Existing App Check setup applies. Only room
members can read update records; all writes use the Auth + App Check callable.
Do not replace Firebase's Google callback URL scheme when adding `hitslop`.
The internal native transfer methods call the document-lifetime JS engine;
rebuild/register templates after changing that interface. Existing documents
keep their immutable app code and must not be patched in place.

Local validation uses `HITSLOP_PILOT_PACKAGE` with `SharingCopyTests`, plus the
existing Quick Checklist persistence/review tests. The Firebase emulator suite
covers membership, disabled invites, removal, duplicate append, and rules.
A two-account live test remains required after deployment. See
[`docs/sync-v1.md`](../../docs/sync-v1.md) for initial limits and offline behavior.

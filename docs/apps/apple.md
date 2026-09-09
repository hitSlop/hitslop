# Apple apps and Swift package

`apps/apple` contains one Xcode project with thin macOS and iOS app targets.
Shared implementation lives in
`apps/apple/Packages/HitSlopApple`, a Swift 6 package supporting macOS 14 and
iOS 17.

## Targets

- **HitSlopCore** validates packages/manifests, copies documents safely,
  and manages named media. It is platform-neutral apart from system image facilities.
- **HitSlopRuntime** hosts the WebKit scheme/bridge, JSON storage,
  working-copy/cloud coordination, document creation, and guest readiness.
- **HitSlopFirebase** configures Analytics, Crashlytics, App Check, and the
  Firebase AI Logic foundation.
- **HitSlopRegistry** is the Firestore catalog and Functions client.
- **HitSlopHost** is macOS AppKit: windows, masks, hidden rendering, Quick Look
  images, PNG/PDF export, and Finder custom icons.
- **HitSlopCatalog** is the macOS catalog UI and immutable local/hosted template
  cache.
- **HitSlopNativeCLI** exposes native validation/capture operations to the
  TypeScript CLI.

AppKit code must remain in Host, Catalog, or NativeCLI so Core/Runtime continue
to build for iOS.

## Opening a document

The host validates the package, derives a Finder icon from immutable
`QuickLook/Icon.png` where appropriate, creates an ephemeral WebView,
serves only allowed immutable resources, and wires the bridge to canonical
stores. Closing a macOS document uses a separate hidden renderer to refresh
preview assets; it does not put the interactive window into capture mode.

## Copies and caches

Every catalog path duplicates a validated immutable master to a user-selected
location. The destination becomes writable only after the copy is complete.
Cache keys include publisher, slug, and release; downloads are hash-verified
before becoming masters. Nothing under `~/.hitslop/templates` is a writable
user document.

## iOS

iOS documents use the user's iCloud container. Runtime changes are staged in a
working copy and explicitly coordinated back. Errors propagate to the UI; a
failed coordination must never be reported as saved.

## Development

```sh
swift test --package-path apps/apple/Packages/HitSlopApple
swift build --package-path apps/apple/Packages/HitSlopApple --product hitslop-native
```

The macOS app is version `1.0.4`; iOS remains `0.1.0`. Release signing,
notarization, Sparkle, and App Store credentials are local/CI secrets, never
repository files.

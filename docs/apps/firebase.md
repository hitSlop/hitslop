# Firebase backend

The public catalog backend lives in `apps/firebase` and deploys to Firebase
project `hitslopapp`.

Firebase Hosting owns `api.hitslop.com`. It serves the versioned JSON Schema
directly and rewrites `/api/**` to the `api` Function in `us-central1`.
Firestore stores publishers, catalog templates, immutable releases, and
idempotent publish requests. Cloud Storage stores only content-addressed published artifacts,
previews, and icons. It never stores a user's writable `.slop` document.

The Apple app reads public template metadata directly from Firestore. Catalog
search and category filtering happen locally over the bounded snapshot.
Aggregate creation counts use the `recordCreation` callable Function so client
rules remain read-only.

## Catalog model

`templates/{publisherKeyId}_{slug}` is the only collection the app queries for
catalog rows. Each public document contains title, description, categories,
normalized search text, manifest-owned author name and optional URL, `visibility`,
`firstPublishedAt`, lifetime `creationCount`, and a complete nested
`currentRelease` snapshot. That snapshot contains the release ID and number,
publish timestamp, manifest JSON, and content-addressed artifact, preview, and
icon descriptors.

`releases/{releaseId}` is private immutable history. `publishers/{keyId}` is a
public signing-key record without profile metadata. `publishRequests/{keyId}_{requestId}` is private
idempotency state with a seven-day `expiresAt` TTL. Firestore rules deny all
client writes and deny client reads of releases, publish requests, and hidden
templates.

Publishing is one transaction: create an immutable release, update the
template's nested current-release projection, and save the idempotency result.
It never resets `firstPublishedAt`, `creationCount`, or `visibility`. Existing
documents are immutable copies and never auto-update; future creates receive
the newest release.

The native Popular view orders public templates by `creationCount`, then
`firstPublishedAt`. New orders by `firstPublishedAt`, so updating an established
template cannot jump it to the top. Search filters the bounded query snapshot
locally. A successful native document creation calls `recordCreation`, which
increments the lifetime counter in a transaction.

The catalog is a public distribution surface, so Firestore reads and
content-addressed Storage downloads deliberately do not require App Check.
App Check belongs on native-only mutations such as `recordCreation`. Enable its
callable enforcement after verifying the configured platform provider from a
signed app. The production callable enforces it.

DeviceCheck setup requires an Apple Developer DeviceCheck key and its private
`.p8` file in the Firebase console. Do not substitute an App Store Connect API
key. Apple reports App Attest as unsupported on Mac, so the macOS client uses
Firebase's DeviceCheck provider.

Publishing deliberately keeps the public protocol independent of Firebase. The
CLI signs and uploads one `hitslop-publish/3` multipart request to
`https://api.hitslop.com/api/publish`. The Function validates the signature,
hash, ZIP structure, manifest, embedded document skill, preview, icon, and skin
before committing Storage objects and Firestore metadata. Author name and URL
are read from that signed artifact; the signing identity carries no profile.

## Development

```sh
bun install
bun run schema:generate
bun run firebase:dev
```

The Emulator Suite exposes Hosting on port 5002, Functions on 5001, Firestore
on 8080, Storage on 9199, and its UI on 4000.

## Deployment

The project must be on Blaze with Firestore in `nam5`, a US multi-region default
bucket, and Google Analytics enabled. Deploy explicitly:

```sh
bun run firebase:deploy
```

Attach `api.hitslop.com` to Firebase Hosting. Keep `hitslop.com` and the Astro
landing deployment on Cloudflare.

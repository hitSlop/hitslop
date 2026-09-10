# Firebase backend

The public catalog backend lives in `apps/firebase` and deploys to Firebase
project `hitslopapp`.

Firebase Hosting owns `api.hitslop.com`. It serves the versioned JSON Schema
directly and rewrites `/api/**` to the `api` Function in `us-central1`.
The credential-free `GET /api/catalog` endpoint returns a cacheable, versioned
projection for public web clients; preview, icon, and download URLs continue to
flow through the content-addressed artifact endpoint.
Firestore stores publishers, catalog templates, immutable releases, and
idempotent publish requests. Cloud Storage stores only content-addressed published artifacts,
previews, and icons. It never stores a user's writable `.slop` document.

The Apple app reads public template metadata directly from Firestore. Category
filtering uses Firestore `arrayContains` queries; text search happens locally
over the bounded snapshot.
Aggregate creation counts use the `recordCreation` callable Function so client
rules remain read-only.

## Catalog model

`templates/{publisherKeyId}_{slug}` is the only collection the app queries for
catalog rows. Each public document contains title, description, categories,
manifest-owned author name and optional URL, `visibility`,
`firstPublishedAt`, lifetime `creationCount`, and a complete nested
`currentRelease` snapshot. That snapshot contains the release ID and number,
publish timestamp, manifest JSON, and content-addressed artifact, preview, and
icon descriptors.

`releases/{releaseId}` is private immutable history. `publishers/{keyId}` is a
public signing-key record without profile metadata. `publishRequests/{keyId}_{requestId}` is private
idempotency state with a seven-day `expiresAt` TTL. Firestore rules deny all
client writes and deny client reads of releases, publish requests, and hidden
templates.

After Storage uploads succeed, metadata publication is one transaction: create an immutable release, update the
template's nested current-release projection, and save the idempotency result.
It never resets `firstPublishedAt`, `creationCount`, or `visibility`. Existing
documents are immutable copies and never auto-update; future creates receive
the newest release. Storage uploads are outside this transaction; a failed
metadata commit can leave unreferenced immutable objects.

The native Popular view orders public templates by `creationCount`, then
`firstPublishedAt`. New orders by `firstPublishedAt`, so updating an established
template cannot jump it to the top. Search filters the bounded query snapshot
locally, using title, description, author name, and categories computed once
when records load. There is no stored `searchText`. All four category/sort
composite indexes remain necessary; `currentRelease` has a map-level single-field
index exemption. A successful native document creation calls `recordCreation`, which
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

## Contract ownership

`packages/schema/src/registry.ts` defines TypeBox contracts for template records,
release snapshots and history, signing keys, retry records, and asset descriptors.
The backend infers its types from these contracts and validates records on reads
and writes. Portable contracts use ISO date-time strings; `registry-codec.ts`
converts these to and from native Firestore timestamps without coercing other fields.

`bun run schema:generate` emits the registry JSON Schema and Swift models in
`HitSlopRegistry`. Handwritten extensions retain manifest parsing, search, and
remote-template conversion. Shared TypeScript/Swift fixtures and generated-output
checks detect contract drift. Native category strings remain forward-compatible
and unfamiliar categories display as Other.

Both web and Apple consume the template's top-level listing metadata, which is
always derived from the signed manifest when publishing. `manifestJSON` remains
in the current snapshot for native presentation and in release history for
inspection; listing metadata does not depend on parsing it.

## Database decision

Keep Firestore for the public catalog. Each listing is a single document, and
transactions already handle publication history and retries. Firebase SQL Connect
provides PostgreSQL relations, generated Swift operations, and subscriptions, but
would introduce database provisioning and operation deployment while retaining
our custom signature/ZIP validation and Storage pipeline. Revisit this decision
when accounts, purchases, reviews, or shared collections become requirements.

References: [SQL Connect overview](https://firebase.google.com/docs/sql-connect),
[Swift SDK](https://firebase.google.com/docs/sql-connect/ios-sdk), and
[subscription refresh policies](https://firebase.google.com/docs/sql-connect/realtime).

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

The predeploy hook type-checks and bundles the Functions entry point, including
the current workspace schema. Cloud Build installs dependencies but does not
rebuild this artifact (`gcp-build` is empty). The deploy command allows 60 seconds
for local function discovery; it does not change request timeouts.

Attach `api.hitslop.com` to Firebase Hosting. Keep `hitslop.com` and the Astro
landing deployment on Cloudflare.

### Pre-release search-field cleanup

The app has not shipped; no compatibility field is retained for older builds.
With Admin application-default credentials, inspect existing records and execute
all four deployed category/sort query shapes:

```sh
cd apps/firebase
bun scripts/cleanup-catalog.ts --check
bun scripts/cleanup-catalog.ts --apply
```

The script validates the new shape before deleting only `templates.searchText`.
Run it before deploying the new backend, which rejects obsolete fields, then
deploy the backend/indexes and build the updated development app. Run `--check`
again afterward and verify `/api/catalog`. Existing release history, template
IDs, counters, publisher records, and Storage artifacts remain intact; no database
reset or republishing is needed.

# Firebase backend

The official catalog uses Firebase Hosting, second-generation Functions,
Firestore, and Cloud Storage in project `hitslopapp`. Personal `.slop` document
stores never enter Firebase.

`api.hitslop.com` keeps the public protocol stable:

- `POST /api/publish` validates one signed immutable artifact.
- `GET /api/artifact?key=...` redirects to content-addressed Storage media.
- `/schemas/v1/manifest.schema.json` is a static generated asset.

Firestore and Storage clients have read-only public catalog access. Only Admin
SDK code in Functions can publish metadata or objects. The macOS app reads the
catalog directly from Firestore and records aggregate creations through a
callable Function.

The catalog has four root collections:

- `templates` is the public, query-ready projection. It owns identity, search
  fields, `firstPublishedAt`, lifetime `creationCount`, `visibility`, and a
  nested snapshot of `currentRelease`.
- `publishers` is the public publisher profile and signing-key record.
- `releases` is private, immutable release history used by trusted backend
  tooling. Clients never need to join it to render or install a template.
- `publishRequests` is private idempotency state. Its `expiresAt` field has a
  seven-day Firestore TTL.

Publishing a new release creates a release document and atomically replaces the
template's `currentRelease` snapshot. It preserves `firstPublishedAt`,
`creationCount`, and `visibility`. Existing `.slop` documents remain pinned to
the bytes they were created from; only future creates use the new release.
"Popular" sorts by lifetime successful creates, while "New" sorts by first
publication—not by the most recent update.

App Check is enforced only on native-only callable operations, not on public
catalog reads or artifact downloads. `recordCreation` requires an App Check
token. The macOS client uses
DeviceCheck because Apple does not support App Attest on Mac; iOS uses App
Attest.

To finish macOS App Check, create an Apple DeviceCheck key in Certificates,
Identifiers & Profiles, then register that key ID and its `.p8` file for the
macOS Firebase app. This is a different credential from an App Store Connect API
key. Verify valid signed-app traffic in App Check metrics whenever credentials,
bundle identity, or signing change.

```sh
bun run firebase:dev
bun run firebase:deploy
```

The default Firestore database is `nam5`, the Storage bucket is US
multi-region, and Functions run in `us-central1`. Production requires the Blaze
plan. Run `bun run schema:generate` before deploying a schema change.

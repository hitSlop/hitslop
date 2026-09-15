# Firebase backend

The official catalog uses Firebase Hosting, second-generation Functions,
Firestore, and Cloud Storage in project `hitslopapp`. Personal `.slop` document
stores never enter Firebase.

`api.hitslop.com` keeps the public protocol stable:

- `POST /api/publish` validates one signed immutable artifact.
- `GET /api/catalog` returns the bounded public catalog used by the landing page.
- `GET /api/artifact?key=...` redirects to content-addressed Storage media.
- `/schemas/v1/manifest.schema.json` is a static generated asset.

Firestore and Storage clients have read-only public catalog access. Only Admin
SDK code in Functions can publish metadata or objects. The macOS app reads the
catalog directly from Firestore and records aggregate creations through a
callable Function.

The catalog has four root collections:

- `templates` is the public, query-ready projection. It owns listing metadata, author attribution, `firstPublishedAt`, lifetime `creationCount`, `visibility`, and a
  nested snapshot of `currentRelease`.
- `publishers` is the public signing-key record. It does not own display metadata.
- `releases` is private, immutable release history used by trusted backend
  tooling. Clients never need to join it to render or install a template.
- `publishRequests` is private idempotency state. Its `expiresAt` field has a
  seven-day Firestore TTL.

After uploading Storage objects, publishing creates a release document and atomically replaces the
template's `currentRelease` snapshot. It preserves `firstPublishedAt`,
`creationCount`, and `visibility`. Existing `.slop` documents remain pinned to
the bytes they were created from; only future creates use the new release.
"Popular" sorts by lifetime successful creates, while "New" sorts by first
publication—not by the most recent update.

Registry contracts live in `packages/schema/src/registry.ts`. TypeBox validates
portable records; the Firebase adapter converts ISO dates to native Firestore
timestamps. `bun run schema:generate` generates the Apple registry models.
The Functions build bundles the current workspace schema into its Node entry
point; cloud deployment installs dependencies without rebuilding that bundle.
Web and Apple read top-level listing fields. Native text search is derived
locally; category filtering and sorting use Firestore queries. The full
`currentRelease` map is exempt from indexing.

Storage uploads are outside the metadata transaction. A failed metadata commit
can leave unreferenced immutable objects. See [the backend guide](../../docs/apps/firebase.md)
for the model, Firestore decision, and pre-release cleanup procedure.

App Check is enforced only on native-only callable operations, not on public
catalog reads or artifact downloads. `recordCreation` requires an App Check
token. Release builds of the macOS client use
DeviceCheck because Apple does not support App Attest on Mac; iOS uses App
Attest.

To finish macOS App Check, create an Apple DeviceCheck key in Certificates,
Identifiers & Profiles, then register that key ID and its `.p8` file for the
macOS Firebase app. This is a different credential from an App Store Connect API
key. Verify valid signed-app traffic in App Check metrics whenever credentials,
bundle identity, or signing change.

Debug builds against live Firebase use the App Check debug provider. Register
each development Mac's SDK-generated debug token for the macOS Firebase app
under App Check → Manage debug tokens before testing sharing. Keep the token
out of source control. Google sign-in alone is insufficient: callable logs with
`auth: VALID` and `app: INVALID` indicate App Check rejection, even though the
client reports “Unauthenticated.” After registering a token, restart the app to
clear the provider's cached failure. Emulator builds use a separate local provider.

```sh
bun run firebase:dev
bun run firebase:deploy
```

The default Firestore database is `nam5`, the Storage bucket is US
multi-region, and Functions run in `us-central1`. Production requires the Blaze
plan. Run `bun run schema:generate` before deploying a schema change.


Catalog pagination for agents uses `GET /api/catalog?page=true` and continues
with `GET /api/catalog?cursor=<nextCursor>`. Pages contain at most 200 entries and
`nextCursor: null` marks completion. Pagination orders public documents by ID
so popularity changes do not reorder an ongoing scan. Invalid catalog entries
are skipped while the cursor still advances through the underlying documents.
The existing request without pagination retains the popular listing. Deploy
the API changes before expecting CLI searches to cover more than 200 entries.

## Private document sharing

`shareDocument` is an Auth + App Check callable. Its `action` is `create`, `info`,
`join`, `append`, `invite`, or `remove`; requests include `roomId` (the document
identity). Create supplies the initial Loro snapshot, display title, slug, and
immutable template fingerprint. Join supplies the invite token. Append supplies
a snapshot with documentId, schema fingerprint, base64 checkpoint, and version.
Invite takes `enabled`; remove takes the member `uid`. Only the owner manages
invitations/access; only current members append or read updates.

`syncRooms/{documentId}` is private server metadata. Clients can listen to its
`updates` collection only while members. The log is idempotent by checkpoint
hash and capped at 10,000 entries, 512 KiB decoded bytes per snapshot and 20
members. This first transport retains full history and uses Firebase-managed
protection, not E2E encryption. It does not store app code or media.

Run `firebase emulators:exec --only firestore --project hitslopapp 'bun test
--timeout 30000 tests/sharing.test.ts tests/rules-emulator.test.ts'` locally.
After validation and deployment approval, deploy only this callable and the
reviewed rules: `firebase deploy --only functions:shareDocument,firestore:rules
--project hitslopapp`. That command changes production; it does not publish or
migrate templates. Recipients need the exact matching template installed.

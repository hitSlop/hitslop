# Self-hosting

The official Firebase deployment is the default, but the publish protocol and
backend are open source. A compatible deployment needs Firestore, Cloud
Storage, second-generation Functions, and Hosting.

## Create the Firebase project

Use the Blaze plan, create the default Firestore database and Storage bucket,
and choose colocated regions. The official service uses Firestore `nam5`, a US
multi-region bucket, and Functions in `us-central1`.

Copy `apps/firebase`, change the project alias in `.firebaserc`, and update the
Function region if your data plane uses another region. Security rules keep
catalog metadata and immutable artifacts publicly readable while denying all
client writes.

## Deploy

```sh
cd apps/firebase
bun install
bun run deploy
```

Attach your API hostname to Firebase Hosting. Hosting serves versioned schemas
and rewrites `/api/**` to the HTTP Function.

## Publish to it

```sh
slop publish . --registry https://your-domain.example/api/publish
# or
HITSLOP_REGISTRY_URL=https://your-domain.example/api/publish slop publish .
```

The publish endpoint remains independent of Firebase clients. It authenticates
the publisher's Ed25519 envelope and validates the complete artifact before
writing catalog state.

## Apple client

A custom Apple build needs its own registered Firebase Apple app and
`GoogleService-Info.plist`. Point `CatalogURL` at the custom Hosting domain and
configure Firestore, Functions, Analytics, Crashlytics, and App Check for that
project.

## Operational responsibilities

Set budget alerts, retain provider audit logs, monitor Function errors and
Crashlytics release health, test rules in the Emulator Suite, and keep
dependencies current. Use App Check for native-only callable mutations. Public
catalog reads and artifact downloads must remain accessible to compatible
clients, while the public CLI publish endpoint is protected by the signed
publisher protocol and package validation.

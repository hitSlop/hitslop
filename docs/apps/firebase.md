# Firebase client services

Firebase remains the identity and telemetry provider: Firebase Auth issues the
ID tokens verified by the Cloudflare Worker; the Apple app configures Analytics,
Crashlytics, and App Check. These services do not require a Firebase Functions app.
Google Sign-In supplies credentials to Firebase Auth.

Catalog reads, signed publishing, creation counts, artifact downloads, media,
and document sharing use the Cloudflare API. D1 stores catalog metadata and R2
stores immutable artifacts. Swift uses Apple's generated OpenAPI client and the
TypeScript CLI uses the typed oRPC client from `packages/api`.

The old `apps/firebase` Functions, Firestore, Storage, and Hosting implementation
has been removed from the repository. Package validation and its tests now live
in `apps/cloudflare`; the Worker serves the canonical manifest schema at
`/schemas/v1/manifest.schema.json`.

This source cleanup does not delete deployed Firebase services or migrate their
existing catalog. Before retiring the old deployment, deploy the Cloudflare
Worker and bindings, point the API hostname at it, and publish the desired
catalog artifacts there. Existing Firebase accounts remain valid. No deployed
resources are changed by local builds or tests.

See [Cloudflare API](../../apps/cloudflare/README.md) and
[self-hosting](../self-hosting.md) for backend configuration.

# @hitslop/registry

Convex owns publisher identities, publisher-scoped templates, immutable release
metadata, idempotent publish requests, and successful document-creation counts.
Cloudflare R2 owns the signed immutable artifact and its derived preview.

The registry does not store artifacts, screenshots uploaded separately,
downloads, installs, favorites, device identifiers, or user documents.

Real deployment identifiers and secrets belong in ignored environment files.
Initialize or reconnect from this directory with:

```sh
bunx convex dev
```

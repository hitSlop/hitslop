# Convex registry

`apps/registry` stores public catalog metadata and finalizes publishes. It
never stores a user's local document.

## Tables

- `publishers` — Ed25519 key ID/public key, editable display name, timestamps.
- `templates` — publisher-scoped slug, searchable manifest fields, current
  release pointer, preview metadata, aggregate creation count.
- `releases` — monotonically numbered immutable artifact/preview keys, hashes,
  sizes, validated manifest, and timestamp.
- `publishRequests` — idempotency mapping from request ID to completed release.

`(publisherId, slug)` owns template identity. Slugs are not globally unique.

## Finalization

The HTTP finalizer accepts only the catalog gateway's bearer secret. It
re-validates request data, verifies publisher-key continuity and idempotency,
creates the next release, and updates the template's current release fields.
R2 holds bytes; Convex holds references and public discovery data.

## Creation counts

The Apple host increments one aggregate counter only after it successfully
creates a writable document from a catalog master. It is not a download,
install, favorite, device, or activity tracker.

## Configuration

Run `bunx convex dev` in this app to create local public URLs. Set the shared
server secret directly in Convex, not in an env file:

```sh
bunx convex env set HITSLOP_INTERNAL_SECRET <long-random-value>
```

Use the same value in the catalog's local `.dev.vars` or Cloudflare secret
store. Rotate both sides together.

# @hitslop/runtime

Framework-neutral browser bridge and document controller for hitSlop.

`@hitslop/runtime/adapter` exports `createDocumentController`, which owns
validated confirmed frames, edit sequencing, draft ancestry, subscriptions, and
the close/export flush barrier. Framework adapters must use it rather than
implementing a second persistence queue. Native Swift Loro and SQLite own durability.

The low-level API is `slop.document.open/apply/flush/releaseDraft/onChange`.
Media and window APIs remain on `slop.media` and `slop.window`. Register visible
draft flushers before calling `ready()`; teardown awaits the final flush.
A missing native document capability is an error. Browser previews explicitly
install the disposable host supplied by `slop dev`.

See [Storage](../../docs/storage.md) and [Architecture](../../docs/architecture.md).

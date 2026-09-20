# Local document storage

The WebView owns one pinned Loro replica. Swift stores opaque checkpoint/update bytes in state/document.sqlite, SQLite user_version 1, DELETE journaling, synchronous FULL. Checkpoint replacement and covered-row deletion are atomic. The exact canonical schema descriptor is the storage key. Generation is a storage token, not a Loro version.

One OS flock on the permanent state/writer.lock inode owns a package. state/host.lock contains socket discovery only. Closed editing uses an engine-only WebView without app.html. Live commands use the owner's socket. Never bypass a busy lock or delete writer.lock.

Autosave runs after 200 ms. Flush commits text drafts, persists pending updates, and checkpoints at 256 updates or 4 MiB. Native load/write bounds are 4096 rows and 32 MiB aggregate checkpoint/update bytes. The engine checkpoints before an append would exceed these bounds. Oversized snapshots fail visibly and preserve pending edits. An oversized existing package is refused intact for recovery; compact is not promised to repair packages that cannot be loaded.

If an append commits but its acknowledgement is lost, the engine reloads storage metadata and retains the same Loro bytes. A later flush imports those bytes idempotently. This does not make repeating a user operation idempotent.

CLI mutations are serialized and acknowledge persistence. get flushes drafts and writes before returning. No receipts, automatic mutation replay, or public retry identity exist. After an unknown outcome, run slop get before another edit. Each WebView lifetime has one internal epoch, including export handshake protection.

Prepare-close commits drafts and freezes edits. Cancel-close restores editing on failure. Successful close removes discovery, tears down the WebView and bridge, drains storage, closes SQLite, and releases ownership. Renderer recovery retains ownership while rebuilding the WebView from saved bytes.

Close documents before moving/renaming them. Symlinked state, iCloud, and other synced folders are unsupported. There are no mutable document JSON projections or media stores. Optional `state/theme.json` stores declared theme token overrides; it is host presentation state, not a document projection. Arbitrary CSS overrides are unsupported.

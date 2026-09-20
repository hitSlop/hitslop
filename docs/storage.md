# Local storage

`state/document.sqlite` uses SQLite user_version 1, DELETE journaling and synchronous FULL. `document` contains one checkpoint, exact canonical descriptor identity, and a generation token; `updates` contains ordered Loro byte records. Checkpoint replacement and covered-row deletion are one transaction. Generation is a local storage token, not a document revision or Loro version vector.

`state/writer.lock` has a permanent inode and an exclusive OS flock. `state/host.lock` is only live socket discovery. A failed connection never authorizes direct writes while the lock is held. Only successful ownership acquisition allows removal of stale discovery. Close drains accepted work and flushes before releasing ownership. Failed close retains the lock.

Autosave starts 200 ms after the first pending edit. Explicit flush drains queued writes. At 256 update records or 4 MiB since the checkpoint, flush checkpoints automatically. Full snapshots retain CRDT history; checkpointing bounds replay, not lifetime history. Lost acknowledgements retain pending bytes and reload generation; replaying identical Loro bytes is idempotent.

Live-session mutation receipts contain request identity and outcome, never old document snapshots. Reads are not cached. Retry windows are bounded to 256 receipts or ten minutes; once complete they rotate the session epoch. Old epochs fail, including after restart. Pending failed saves prevent rotation. A CLI failure prints retry identity; reuse both ID and epoch, or inspect state before expressing new intent. This is not cross-restart exactly-once execution.

Store and CLI reject symlinked state. Native SQLite also uses NOFOLLOW and canonical filesystem paths. Local packages must be closed before moving/renaming; missing/replaced paths fail writes. Cloud-synced locations are unsupported. Host bridge requests are bounded; individual stored records/checkpoints are capped at 32 MiB.

There is no mutable JSON file. `slop get` projects readable state, and `slop schema` explains the declarative descriptor. Optional fields are absent, not null; unknown fields and schema mismatches reject without migration.

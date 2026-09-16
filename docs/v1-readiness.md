# V1 readiness

## Contract baseline

JSON-backed apps author `S.Document` and explicit `initial.ts`. Builds emit the
v1 envelope schema and immutable initial JSON. Native Loro owns each document;
SQLite `user_version = 1` identifies the database, and `$slop.format = 1` identifies
the editable projection. Bridge, room, and publish contracts start at v1
(`hitslop-publish/1`). Product versions remain independent.

There is no pre-release data migration. Plain schemas, unversioned/unknown-version
databases, and old publish/room protocols are rejected. Unsupported document data
is preserved. SQLite crash recovery, projection receipts, unknown application
fields, and runtime-version checks are current correctness mechanisms, not legacy
migrations. D1's initial SQL and Durable Object registration are still required
to provision new services; existing hosted data is not deleted by this change.

## Removed and archived paths

- The iCloud working-copy path copied JSON/media/theme without authoritative
  SQLite state. It is archived; writable iCloud locations are rejected.
- iOS, SQLiteDocumentLab, old architecture/migration plans, and unused prototypes
  are archived outside the active build and test paths.
- Quick Checklist is the sole active example. `examples/archive` preserves other
  examples and their tests; restore them individually against v1.
- Archived assignment tracker, weekly planner, and workout planner contain old
  assignment/duration/completion adapters. Journal/date and weight helpers also
  contain legacy handling. Review those on restoration; preserve useful malformed
  input validation rather than deleting every fallback mechanically.
- The obsolete helper smoke fixture calling `slop.json.open` now uses the real
  compiled checklist. Package boundaries validate schemas explicitly and share
  ZIP preflight policy before allocating decompressed data.

## Evidence

Run [the local gate](local-testing.md). Its timestamped logs and `results.json`
are the source of truth for automated results. Inspect captures and complete the
real-app checklist before release. Production authentication, signed permissions,
notarization, updater delivery, and Release resource relocation remain separate
release checks. Nothing in this pass deploys or publishes artifacts.

The initial local pass also fixed three native boundaries: symlinked iCloud
destinations, competing SwiftUI/AppKit menu ownership, and disabled Close commands
on frameless documents. Settings remains SwiftUI content hosted by AppKit.
Helper embedding now preserves the resource-bundle layout emitted by SwiftPM,
including macOS `Contents` bundles, before signing.

On September 16, 2026, all local check stages passed after targeted fixes and
reruns on macOS arm64 with Bun 1.4.0 and Swift 6.4. This included isolated npm
installs, real local sharing rooms, native crash recovery and Checklist interaction
tests, exports, relocated Debug resources, and the landing build. A real Debug
window verified add, complete, reorder, file, restore, quit/relaunch persistence,
Settings, and File → Close. Signed permissions and production services remain
unverified; this is not a distribution-release certification.

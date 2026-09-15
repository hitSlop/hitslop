# hitSlop documentation

## Build with hitSlop

- [Authoring a slop](authoring.md) — scaffold, preview, validate, build, register,
  and publish.
- [Design and presentation](presentation.md) — Paper/Instrument/Skin, responsive
  layout, transparent windows, resizing, icon art, and static export.
- [Package format](package-format.md) — the exact source/runtime boundary.
- [Storage](storage.md) — versioned document persistence, named media, and recovery.
- [Document architecture](sync-v1.md) — the shared engine, disk format, and host errors.
- [Framework packages](packages.md) — CLI, runtime, schema, and Svelte.

## Understand the platform

- [Architecture](architecture.md) — trust boundaries and end-to-end data flow.
- [Apple apps](apps/apple.md) — Core, Runtime, Host, Catalog, Registry, and CLI.
- [Firebase backend](apps/firebase.md) — signed publishing, catalog metadata,
  immutable artifacts, and API hosting.
- [Self-hosting](self-hosting.md) — replace the official hosted services.
- [Repository guide](repository.md) — workspace map and change discipline.
- [Releasing](releasing.md) — versions, checks, npm, services, and macOS.

## Design proposals

- [Document architecture and sharing](sync-v1.md) — `S.*` schemas, Loro,
  versioned file edits, native persistence, and authenticated Firebase rooms.

## Historical decisions

[Swift to web runtime](SWIFTTOSVELTE.md) and [the v1 contract
refactor](v1-refactor.md) preserve design history. They are context, not the
current operating manual. The build and platform guides above describe current
behavior; design proposals describe possible future changes.

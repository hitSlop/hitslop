# Retain the existing template cache

The full-corpus Nx pilot failed the macOS adoption gate. Production keeps the
existing validated per-template cache and Actions cache transport. No Nx
dependencies or task adapters are adopted.

| Measured path | Existing/direct | Nx |
|---|---:|---:|
| macOS warm corpus, including cache transfer | 6.9s | 55.4s |
| macOS one-slop edit, including cache transfer | 13.5s | 64.2s |
| Linux portable compilation and verification | 94.5s uncached | 3.8s remote |

These are medians from three fresh-runner attempts, not whole-release timings.
The [pilot report](https://github.com/hitSlop/hitslop/blob/0a795b375f4a4cfabc408621f94b4d75d82fddc2/docs/nx-pilot.md)
and [machine evidence](https://github.com/hitSlop/hitslop/blob/0a795b375f4a4cfabc408621f94b4d75d82fddc2/docs/evidence/nx-corpus-2026-09-25.json)
remain on the unmerged experiment branch. The pilot workflow is disabled and its
dedicated GitHub Actions secret has been removed. Historical Cloud data is retained.

Useful fixes are independent of Nx: Svelte style hashes now depend on component
content, the three date-dependent sample seeds use fixed dates, and shared cache
inputs include the copied document skill and inherited root TypeScript config.
The fixed dates describe sample content; they do not disable live date features.

`bundled.json` still selects shipped templates; per-template input hashes select
what rebuilds. Build packages and artwork remain generated. No historical runtime,
preserved package, or release record is regenerated to increase cache hits.

Fresh initialization and preserved saved-state loading remain separate render
cases. Ignoring `state/` does not establish equivalent coverage. The render runner
now records stage timings before considering fewer helper launches. A portable
compile cache and combined PNG/PDF export are follow-ups requiring measurements;
neither is part of this change. Signing, notarization and ZIP/DMG distribution keep
their existing behavior.

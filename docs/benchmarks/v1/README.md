# Loro foundation evidence

The restored frameless window-controller harness was measured on 2026-09-19:

| Rows per window | Windows | Host + WebContent MiB | Durable title edit p95 ms |
| --- | --- | --- | --- |
| 100 | 1 | 168 | 7 |
| 100 | 10 | 900 | 9 |
| 100 | 20 | 1,406 | 13 |
| 1,000 | 1 | 230 | 66 |
| 1,000 | 10 | 1,520 | 70 |
| 1,000 | 20 | 2,933 | 82 |

This uses the real Host window controllers and hover panels in a test harness. It excludes the catalog/Firebase application baseline and GPU/network processes. These are single warm-machine samples with other development activity, not isolated performance guarantees. Raw data: [restored-client-windows.json](restored-client-windows.json). Host footprint after closing was 32–54 MiB.

The restored client passed all native test targets, native socket and closed-file WASM editing, failed-save retry, renderer death recovery, PNG/PDF capture, and native/Bun commit-phase crash probes. The packaged Xcode app was opened with an isolated local template catalog; its embedded Swift helper also read documents with Node/Bun excluded from PATH.

The table below is historical evidence from the superseded minimal host, **not the restored macOS client**.

Measured 2026-09-19 on this development Mac with Loro 1.16.1 and the direct SDK. The full local gate is `bun run test:local`; `HITSLOP_BENCH=1 bun run bench:windows` runs the opt-in window matrix. No Mirror-era performance claim is carried forward.

| Rows per window | Windows | Host + WebContent MiB | Durable title edit p95 ms |
| --- | --- | --- | --- |
| 100 | 1 | 132 | 11 |
| 100 | 10 | 765 | 14 |
| 100 | 20 | 1,352 | 28 |
| 1,000 | 1 | 249 | 42 |
| 1,000 | 10 | 1,435 | 40 |
| 1,000 | 20 | 2,900 | 42 |

These are single sequential runs on a warm machine, fully rendered rows, 100 persisted title edits per cell. Memory includes host and identified WebContent processes, excludes GPU/network processes, and is not a total application budget. Browser activity can affect timing. This is evidence for local dogfooding, not a supported window-count promise. Host footprint after closing all windows was approximately 32–64 MiB. Raw measurements and method are in [windows.json](windows.json).

Projection preserves unchanged row references to avoid rerendering every row for a title edit, but it still traverses the document. Row lookup remains linear. Large-list rendering, history growth and many-window memory remain explicit limits.

The local gate verifies TypeScript/Svelte and generated contracts, SDK operations and rollback, receipt expiry, runtime externalization, native writer exclusion, live/closed Bun CLI routing, failed-save close blocking and retry, real WebContent death while Swift survives, and PNG/PDF export. Native and Bun crash probes kill the writer before/after append/checkpoint commits; the native process test also kills the host after a CLI acknowledgement. See [storage-v1.json](storage-v1.json) and [native-crash.json](native-crash.json).

PNG output was visually inspected for both bundled examples; PDF output preserves searchable document text. Live browser editing and refresh-to-reset were manually checked. CI does not run performance measurements.

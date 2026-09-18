# Command/snapshot measurements

Captured on 17 September 2026 on macOS arm64. The original reports recorded an
Apple M1 and Bun 1.3.13; the cleanup reports use Bun 1.4.0 and Swift 6.4 on macOS
26.6.2. The browser report records its Chrome version. These are local
observations, not a cross-machine latency guarantee.

- `native-debug.json`: isolated native checkpoint and the archived Loro baseline.
- `native-release-initial.json` / `native-release-json.json`: isolated release
  WebKit → Swift → SQLite → full snapshot measurements before/after JSON parsing
  and prepared-validator improvements. Plain DOM rows, not Svelte.
- `native-release-cleanup.json`: the same isolated release harness after prepared
  document persistence and digest receipts. Three warmups, five measured commands
  per size and rendering mode. The harness still separately encodes its reply;
  it does not measure the production bridge's direct Foundation-value conversion.
- `ts-prepared.json`: prepared TypeBox validation in the original spike harness.
- `ts-production.jsonl`: production TS authority, serialized full snapshots and
  controller reconciliation. Run `bun scripts/document-benchmark.ts 30` after
  building `packages/schema`. Five warmups, thirty measured commands per size.
- `ts-cleanup.jsonl`: the same harness after receipt hashing and authority cleanup,
  using the repository's pinned Bun 1.4.0. The toolchain differs from the original
  report, so timing differences cannot be attributed solely to the implementation.
- `ts-cleanup-repeat.jsonl`: repeat on Bun 1.4.0 after the native release benchmark
  completed. The initial cleanup run was substantially slower; both are retained
  to show the variability rather than selecting only the faster result.
- `browser-before-index.json` / `browser-rendered.json`: actual Quick Checklist
  development build with 1k/5k/10k rendered Svelte rows and a disposable preview
  authority. Three warmups, five measured toggles followed by two animation frames.
  The second report includes cached identity lookup for immutable list snapshots.

Scopes differ: the TS benchmark excludes browser rendering and durable storage;
the rendered-row benchmark excludes Swift, disk and network. Do not combine these
numbers into a claimed end-to-end speedup. Full snapshots and whole-document
validation still impose costs at large document sizes.

Cleanup observations (milliseconds):

| Rows | TS original median | TS cleanup first / repeat medians | Native rendered original / cleanup medians |
| --- | ---: | ---: | ---: |
| 1,000 | 2.89 | 4.26 / 2.02 | 73 / 26 |
| 5,000 | 15.58 | 25.49 / 11.05 | 302 / 125 |
| 10,000 | 35.91 | 65.91 / 28.78 | 313 / 251 |

The TS repeat's 10k p95 was 38 ms, compared with 161 ms in the first cleanup run
and 44 ms in the original report. These runs were not a controlled before/after
experiment. Structural regression tests enforce one candidate encoding,
validator reuse, stable unchanged rows and no repeated receipt-history freezing;
the timing reports supply context, not a CI latency threshold.

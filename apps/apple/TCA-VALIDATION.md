# TCA migration validation

Measured on an Apple Silicon Mac using Apple Swift 6.3.3, in optimized native test hosts. The baseline was copied from the Git index before the migration, including the pre-existing staged package-format work.

## Initial migration runtime measurements

Each window count ran in a fresh process, three times per variant, with alternating baseline/TCA order. Values below are medians. Fixtures are small static 380×280 web apps in hidden native windows.

| Open documents | Open to guest ready, baseline → TCA | PNG export, baseline → TCA | Host RSS, baseline → TCA | Idle host CPU, baseline → TCA |
| --- | --- | --- | --- | --- |
| 1 | 482 → 483 ms | 413 → 397 ms | 93.5 → 97.4 MiB | 0.10 → 0.09% |
| 5 | 846 → 845 ms | 419 → 417 ms | 101.4 → 105.4 MiB | 0.27 → 0.21% |
| 10 | 1302 → 1374 ms | 411 → 413 ms | 111.5 → 114.8 MiB | 0.31 → 0.22% |

These samples show roughly 4 MiB of additional host memory, with similar export timing and low idle CPU. Opening ten documents measured about 71 ms slower in the TCA variant; opening one or five was essentially unchanged. Readiness is sampled, so these are exploratory measurements rather than latency guarantees.

Host RSS/CPU exclude WebKit and GPU child processes. Export measures the native capture pipeline without a save panel. Hidden-window tests do not measure interactive focus switching or establish performance for complex authored slops. The native toolbar now observes presentation values rather than replacing its SwiftUI root and repeating editor discovery on each busy-state change.

## Packaging

The macOS Release executable increased from approximately 28.3 MiB to 35.1 MiB (+6.8 MiB). TCA is absent from the native rendering helper’s target dependency graph. SwiftPM still resolves the enclosing package’s dependency graph during cold builds.

## Initial migration automated verification

- Full Swift package suite: 94 tests reported passing; the opt-in performance test is disabled during ordinary suite runs.
- macOS Debug and Release builds passed, including the embedded native rendering helper.
- iOS simulator Debug build passed.
- Eighteen fresh-process optimized measurement runs passed.
- `git diff --check` passed.

The first full suite passed before migration. A later repeat hit timing-sensitive WebKit failures while multiple full builds were running; the final suite ran without those builds and passed. Xcode emitted only the existing non-blocking AppIntents metadata-extraction warning in the final macOS builds.

## Verification limits

Computer Use could not start because its server/client versions differ; the tool requires an application relaunch. Interactive catalog/menu/window smoke testing remains outstanding. Native integration tests cover command routing, a rejected guest flush followed by retry, symlink deduplication, independent documents, and session cleanup. Real iCloud account/network failure behavior has not been manually exercised.

The opt-in benchmark and reproduction command are documented in [README.md](README.md).

## Follow-up verification — September 13, 2026

The follow-up was checked against the local TCA Search, VoiceMemos, SyncUps, UIKit,
and presentation examples, plus effect cancellation and performance documentation.
The reviewed reference files match the resolved TCA 1.26.2 checkout.

- Full Swift suite: 110 tests reported passing in 15.3 seconds. Opt-in benchmarks
  and fixture-dependent tests remain skipped during ordinary runs.
- All 22 feature tests also passed in the optimized test host.
- macOS Debug and Release builds passed; Release includes the native helper.
- iOS simulator Debug passed for its configured simulator architectures.
- No new compiler warnings remain in the final full Swift suite. Xcode retains
  its non-blocking AppIntents metadata warning.

The tests cover obsolete category results, subscription replacement, canonical
recents, atomic local snapshots, overlapping refreshes, watcher teardown, stale
scan rejection, repeated alert identity and actual observed presentation,
per-window alert queues, retry after runtime failure, and quit during both
creation and duplication. A final test assertion was corrected because AlertState
compares content rather than identity; presentation identity is asserted separately
and exercised through a real observed store and the native presenter.

Computer Use was retried and still reports a client/server version mismatch.
Interactive UI smoke testing therefore remains outstanding until ChatGPT is
relaunched. Real iCloud account/network failure behavior has not been manually
exercised in this pass.

### Follow-up performance measurements

Native measurements used the pre-follow-up optimized test host and the rebuilt
optimized host, three fresh processes per window count and version (18 runs).
The before group ran first, followed by builds and the after group. No full app
builds ran during either measurement group. These are exploratory comparisons,
not randomized or statistically controlled performance claims.

| Documents | Opening before → after, ms | Export before → after, ms | Host RSS before → after, MiB | Idle host CPU before → after, % |
| --- | --- | --- | --- | --- |
| 1 | 579 → 557 | 414 → 404 | 97.7 → 98.2 | 0.11 → 0.10 |
| 5 | 1055 → 977 | 394 → 410 | 105.6 → 105.9 | 0.23 → 0.16 |
| 10 | 1619 → 1535 | 406 → 413 | 104.3 → 115.3 | 0.40 → 0.38 |

Opening and export timing remained broadly comparable. The ten-window RSS median
rose by 11 MiB in this run; one- and five-window medians changed by less than
0.5 MiB. This sample cannot distinguish allocator/residency variability from
implementation cost, and the RSS measurement excludes WebKit/GPU child processes.
No memory reduction is claimed for this follow-up.

The catalog benchmark alternated the previous synchronous recents adapter and
the background scanner five times each. Both scanned the same 100 disposable
packages containing 128 small asset files each:

| Measurement, median across five runs | Previous main-actor scan | Background scanner |
| --- | --- | --- |
| Total scan time | 491 ms | 492 ms |
| Largest interval of a 1 ms main-actor heartbeat | 495 ms | 2.2 ms |

The improvement is responsiveness: approximately the same disk work completes
without occupying the main actor for half a second. The heartbeat is a scheduling
probe, not a measurement of rendered frame rate. All benchmark runs passed.
Raw samples from this session are in `/tmp/hitslop-tca-followup-metrics.json`;
reproduction commands and the synthetic workload are documented in README.md and
the opt-in benchmark tests.

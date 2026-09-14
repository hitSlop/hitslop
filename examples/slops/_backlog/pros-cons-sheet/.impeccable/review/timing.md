# Decision Balance review measurements

Measured on the local gallery on 2026-09-10. Each duration is the slowest of
four panes reaching readiness, including capture preparation, fonts, and images.

| Fixture | All four panes ready | Server state |
| --- | ---: | --- |
| Typical | 14.55 s | Cold |
| Empty | 2.11 s | Warm |
| Tied | 1.56 s | Warm |
| Long content | 4.79 s | Warm |

The adjacent JSON packets contain individual pane timings and measurements.
Each fixture has one final board capture; no viewport resizing was needed.
Capture execution time was not instrumented separately.

Implementation and initial infrastructure debugging were not timed separately.
During development, generated build files caused unnecessary preview reloads;
the gallery now ignores those outputs and compares source fingerprints before
marking a review stale. Recovery time was not instrumented.

Focused verification: 21 tests and 102 assertions passed in about 1.52 seconds.
A measured production build took about 1.6 seconds. Type checks, package
validation, interaction checks, and independent design review also passed;
their combined wall time was not instrumented.

These measurements establish a baseline for later slops. They do not establish
a tenfold improvement in total implementation or review time.

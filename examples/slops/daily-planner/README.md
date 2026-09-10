# Daily Planner

A slim teal day board with three priorities, raised time blocks, and day notes.
The fixed 6am–midnight ruler scrolls within a 400 × 900 window. Today opens near
the current time; scrolling or editing pauses following, and **Now** resumes it.

Drag empty time to create a block. Drag appointments to move them, or their top
and bottom handles to resize. Gestures snap to 15 minutes and save on release;
Escape cancels. Arrow keys nudge the focused block or handle. Click a block to
edit its title, times, and category. Midnight is entered as 00:00.

Notes open in a Save/Cancel dialog. Changing the date relabels the same single-day
document. Export includes all priorities, appointments, and notes in full.

```sh
bun run slops:review daily-planner
bun test examples/slops/tests/daily-planner.test.ts
bun slop build examples/slops/daily-planner
bun slop validate examples/slops/daily-planner/dist/daily-planner.slop
```

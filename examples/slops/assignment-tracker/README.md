# Assignment Tracker

A white study pad with a plum header, lilac course labels, coral deadlines, and mint completion marks. Assignments stack by urgency; open a row to edit its course, deadline, points, and notes. Draft changes commit only on Save. Due-date chips also open a calendar directly.

```sh
bun slops:review assignment-tracker
bunx svelte-check --tsconfig examples/slops/assignment-tracker/tsconfig.json
bun test examples/slops/assignment-tracker/src/due.test.ts
bun slop build examples/slops/assignment-tracker
bun slop validate examples/slops/assignment-tracker/dist/assignment-tracker.slop
```

Exports include all assignments and full notes. Missing or invalid stored dates appear in Needs a date. Grouping refreshes at local midnight and when returning to the app.

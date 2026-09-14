# Weekly Planner

A magnetic week board with colorful, movable time blocks.

- Drag an empty lane to draft a block; click a block to edit it.
- Drag blocks between days and times. Pull top/bottom edges to resize.
- Drop into Anytime to remove the scheduled start while keeping the duration.
- Use arrow keys on blocks to move across days or by 15 minutes; use up/down
  on resize handles to adjust an edge. Escape cancels an active drag.
- All edits are also available in the block dialog. Changes save on release
  or Save; Cancel discards dialog drafts.

```sh
bun run slops:review weekly-planner
bun test examples/slops/tests/weekly-planner.test.ts
bun slop build examples/slops/weekly-planner
bun slop validate examples/slops/weekly-planner/dist/weekly-planner.slop
```

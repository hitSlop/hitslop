# School Schedule

A colorful campus timetable for classes, rooms, bell times, and after-class plans.
The cobalt board shows your current stop and what’s next. Class tiles lead with
subject and room; click or press Enter to edit all details and choose a color.

Drag a class to another slot to move it; occupied slots swap classes. A preview
shows the destination before release. Escape cancels. The dialog’s day/period
controls provide the same move and swap behavior without dragging.

Edit bell times through the left rail. Overlapping periods are rejected. Deleting
a populated period and copying a day over other weekdays require confirmation.
Student details and after-class plans each have Save/Cancel dialogs. Locker
details are masked in the editor and remain included in exports as before.

The window opens at 880 × 640; narrow windows scroll horizontally with sticky
weekday and period headings. Export expands all written content.

```sh
bun run slops:review school-schedule
bun test examples/slops/tests/school-schedule.test.ts
bun slop build examples/slops/school-schedule
bun slop validate examples/slops/school-schedule/dist/school-schedule.slop
```

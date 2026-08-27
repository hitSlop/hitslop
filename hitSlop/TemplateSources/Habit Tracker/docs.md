# Habit Tracker

This document tracks habits in `habits` and daily completion marks in `habit_checks`.

- Read habits in `position` order.
- A completion is unique by `(habit_id, day)` and uses an ISO `YYYY-MM-DD` day.
- Toggle a completion with `INSERT ... ON CONFLICT ... DO UPDATE`.
- Rename or reorder a habit with a surgical `UPDATE`; do not rewrite the table.
- `habit_week` exposes one row per habit with the configured week's seven dates, completion flags, and score.

The HTML view is a `sql-html-v1` template. `<slop-row as="…">` requires exactly one result row, while `<slop-each as="…">` repeats its template for zero or more rows. Placeholders use `{{alias.column}}`. Named `data-slop-action` forms perform writes. Do not add document JavaScript.

The HTML is only the human interface. The tables and view are the source of truth.

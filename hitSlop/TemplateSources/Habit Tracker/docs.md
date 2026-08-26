# Habit Tracker

This document tracks habits in `habits` and daily completion marks in `habit_checks`.

- Read habits in `position` order.
- A completion is unique by `(habit_id, day)` and uses an ISO `YYYY-MM-DD` day.
- Toggle a completion with `INSERT ... ON CONFLICT ... DO UPDATE`.
- Rename or reorder a habit with a surgical `UPDATE`; do not rewrite the table.
- `habit_week` is a convenience view for scores during the configured week.

The HTML is only the human interface. The tables are the source of truth.

# Workout Planner

A dark training console with independent set tracking and a persistent rest dock.

- Tap an individual set, or use Log set for the next unfinished one.
- Rest starts after each set. Extend by 30 seconds or Skip; finishing an exercise
  advances after rest. Selecting an exercise overrides automatic advancement.
- Edit routine to add, edit, delete, or reorder exercises. Reset progress clears
  completion after confirmation and keeps the routine.
- Existing documents remain compatible. The active rest timer is not restored
  after closing the document.

```sh
bun run slops:review workout-planner
bun test examples/slops/tests/workout-planner.test.ts
bun slop build examples/slops/workout-planner
bun slop validate examples/slops/workout-planner/dist/workout-planner.slop
```

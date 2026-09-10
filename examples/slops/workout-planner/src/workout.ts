import type { WorkoutPlanner } from "../schema";
export type Exercise = WorkoutPlanner["exercises"][number];
export function count(value: number, min = 1, max = 12) {
  return Math.max(
    min,
    Math.min(max, Number.isFinite(value) ? Math.round(value) : min),
  );
}
export function sets(ex: Exercise) {
  return count(ex.sets);
}
export function checked(ex: Exercise): number[] {
  const values =
    ex.completedSetIndices ??
    Array.from({ length: count(ex.completedSets, 0, sets(ex)) }, (_, i) => i);
  return [
    ...new Set(
      values.filter((i) => Number.isInteger(i) && i >= 0 && i < sets(ex)),
    ),
  ].sort((a, b) => a - b);
}
export function complete(ex: Exercise) {
  return checked(ex).length === sets(ex);
}
export function toggle(ex: Exercise, index: number): boolean {
  const values = checked(ex);
  const added = !values.includes(index);
  ex.completedSetIndices = added
    ? [...values, index].sort((a, b) => a - b)
    : values.filter((i) => i !== index);
  ex.completedSets = ex.completedSetIndices.length;
  return added;
}
export function nextSet(ex: Exercise) {
  const values = checked(ex);
  return Array.from({ length: sets(ex) }, (_, i) => i).find(
    (i) => !values.includes(i),
  );
}
export function nextExercise(exercises: Exercise[], after?: string) {
  const start = exercises.findIndex((ex) => ex.id === after);
  for (let offset = 1; offset <= exercises.length; offset++) {
    const ex = exercises[(start + offset) % exercises.length];
    if (!complete(ex)) return ex.id;
  }
  return null;
}
export function resizeSets(ex: Exercise, value: number) {
  const done = checked(ex);
  ex.sets = count(value);
  ex.completedSetIndices = done.filter((i) => i < ex.sets);
  ex.completedSets = ex.completedSetIndices.length;
}
export function reset(exercises: Exercise[]) {
  for (const ex of exercises) {
    ex.completedSets = 0;
    ex.completedSetIndices = [];
  }
}
export function remaining(deadline: number, now: number) {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
export function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

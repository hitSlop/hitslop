import { expect, test } from "bun:test";
import {
  checked,
  toggle,
  nextSet,
  nextExercise,
  resizeSets,
  reset,
  type Exercise,
} from "../workout-planner/src/workout";
import { createRestClock } from "../workout-planner/src/rest";
const exercise = (): Exercise => ({
  id: "a",
  name: "Squat",
  sets: 4,
  reps: 8,
  weight: "20 kg",
  completedSets: 2,
});
test("legacy completion maps to individual sets and only the tapped set changes", () => {
  const ex = exercise();
  expect(checked(ex)).toEqual([0, 1]);
  toggle(ex, 3);
  expect(checked(ex)).toEqual([0, 1, 3]);
  expect(nextSet(ex)).toBe(2);
  toggle(ex, 0);
  expect(checked(ex)).toEqual([1, 3]);
  expect(ex.completedSets).toBe(2);
});
test("target reduction trims completion, reset preserves the routine", () => {
  const ex = exercise();
  toggle(ex, 3);
  resizeSets(ex, 2);
  expect(checked(ex)).toEqual([0, 1]);
  reset([ex]);
  expect(checked(ex)).toEqual([]);
  expect(ex.weight).toBe("20 kg");
  expect(ex.sets).toBe(2);
});
test("next exercise skips completed exercises and wraps", () => {
  const a = exercise();
  a.completedSets = 4;
  const b = { ...exercise(), id: "b" };
  expect(nextExercise([a, b])).toBe("b");
  expect(nextExercise([a, b], "b")).toBe("b");
  b.completedSets = 4;
  expect(nextExercise([a, b])).toBeNull();
});
test("rest deadline survives long pauses and extension does not restart it", () => {
  let now = 0;
  const clock = createRestClock(() => now);
  clock.start(90);
  now = 42000;
  expect(clock.read().seconds).toBe(48);
  clock.extend(30);
  expect(clock.read()).toEqual({ seconds: 78, total: 120 });
  now = 130000;
  expect(clock.read().seconds).toBe(0);
  clock.stop();
  expect(clock.read()).toEqual({ seconds: 0, total: 0 });
});

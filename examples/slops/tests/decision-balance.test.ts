import { test, expect } from "bun:test";
import {
  beamTilt,
  clampWeight,
  totalWeight,
} from "../pros-cons-sheet/src/balance";

test("displayed weights and totals agree for legacy out-of-range values", () => {
  const values = [-10, 0, 1.4, 3.6, 5, 99, NaN, Infinity];
  const factors = values.map((weight) => ({ weight }));
  expect(totalWeight(factors)).toBe(
    values.reduce((sum, weight) => sum + clampWeight(weight), 0),
  );
  expect(factors[0]?.weight).toBe(-10);
  expect(totalWeight([])).toBe(0);
});

test("beam rests at ties and moves toward the heavier side within its stops", () => {
  expect(beamTilt(0, 0)).toBe(0);
  expect(beamTilt(9, 9)).toBe(0);
  expect(beamTilt(20, 0)).toBe(-16);
  expect(beamTilt(0, 20)).toBe(16);
  expect(beamTilt(12, 8)).toBeLessThan(0);
});

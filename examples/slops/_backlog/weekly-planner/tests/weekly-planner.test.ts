import { describe, expect, test } from "bun:test";
import {
  duration,
  layout,
  minutes,
  move,
  resize,
  snap,
} from "../weekly-planner/src/schedule";
const task = (id: string, time: string, span?: number) => ({
  id,
  time,
  title: id,
  done: false,
  durationMinutes: span,
});
describe("weekly scheduling", () => {
  test("legacy tasks retain a one-hour duration and invalid times stay unscheduled", () => {
    expect(duration(task("old", "09:00"))).toBe(60);
    expect(minutes("9-ish")).toBeNull();
    expect(minutes("24:00")).toBeNull();
    expect(layout([task("old", "09:00"), task("anytime", "")])).toHaveLength(1);
  });
  test("moves snap and preserve room for the duration at boundaries", () => {
    expect(snap(608)).toBe(615);
    expect(move(-15, 60)).toBe(0);
    expect(move(1430, 120)).toBe(1320);
  });
  test("both resize edges enforce minimum span and midnight boundaries", () => {
    expect(resize(540, 600, 700, "start")).toEqual({ start: 585, end: 600 });
    expect(resize(540, 600, 400, "end")).toEqual({ start: 540, end: 555 });
    expect(resize(1380, 1440, 1500, "end")).toEqual({ start: 1380, end: 1440 });
  });
  test("overlaps occupy separate columns and later clusters recover full width", () => {
    const result = layout([
      task("a", "09:00", 120),
      task("b", "10:00", 60),
      task("c", "11:00", 60),
    ]);
    expect(result.map((item) => [item.column, item.columns])).toEqual([
      [0, 2],
      [1, 2],
      [0, 1],
    ]);
  });
});

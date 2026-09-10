import { describe, expect, test } from "bun:test";
import {
  adjustRange,
  bookedMinutesOf,
  layout,
  rangeOf,
  scrollForTime,
  toLabel,
  validDate,
  validRange,
} from "../daily-planner/src/schedule";
import type { Block } from "../daily-planner/schema";
const block = (id: string, start: string, end: string): Block => ({
  id,
  start,
  end,
  title: id,
  kind: "focus",
});
describe("daily planner", () => {
  test("keeps midnight and malformed legacy ranges bounded", () => {
    expect(toLabel(1440)).toBe("12 am");
    expect(rangeOf(block("late", "23:45", "00:00"))).toEqual({
      start: 1425,
      end: 1440,
    });
    expect(rangeOf(block("bad", "23:59", "22:00"))).toEqual({
      start: 1425,
      end: 1440,
    });
    expect(validRange("05:00", "07:00")).toBe(false);
    expect(validRange("09:00", "09:10")).toBe(false);
    expect(validRange("23:45", "00:00")).toBe(true);
    expect(validRange("09:00", "08:00")).toBe(false);
    expect(validDate("2026-02-30")).toBe(false);
    expect(validDate("2024-02-29")).toBe(true);
  });
  test("preserves duration while moving and clamps both resize edges", () => {
    const r = { start: 420, end: 540 };
    expect(adjustRange(r, "move", -180)).toEqual({ start: 360, end: 480 });
    expect(adjustRange(r, "move", 1200)).toEqual({ start: 1320, end: 1440 });
    expect(adjustRange(r, "start", 300)).toEqual({ start: 525, end: 540 });
    expect(adjustRange(r, "end", -300)).toEqual({ start: 420, end: 435 });
    expect(r).toEqual({ start: 420, end: 540 });
  });
  test("counts occupied minutes once and separates overlapping appointments", () => {
    const blocks = [
      block("a", "09:00", "11:00"),
      block("b", "10:00", "12:00"),
      block("c", "10:15", "10:30"),
      block("d", "12:00", "13:00"),
    ];
    expect(bookedMinutesOf(blocks)).toBe(240);
    expect(layout(blocks).map((b) => b.columns)).toEqual([3, 3, 3, 1]);
  });
  test("focuses near now without scrolling beyond either boundary", () => {
    expect(scrollForTime(900, 40, 600, 748)).toBe(148);
    expect(scrollForTime(600, 40, 300, 748)).toBe(70);
    expect(scrollForTime(240, 40, 600, 748)).toBe(0);
    expect(scrollForTime(1440, 40, 600, 748)).toBe(148);
    expect(scrollForTime(900, 40, 900, 748)).toBe(0);
  });
});

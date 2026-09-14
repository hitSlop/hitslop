import { describe, test, expect } from "bun:test";
import {
  moveClass,
  copyDay,
  liveStatus,
  periodError,
  validTimes,
} from "../school-schedule/src/schedule";
import { initial } from "../school-schedule/src/initial";
import type { ClassEntry, Schedule } from "../school-schedule/schema";
const at = (time: string) => new Date(`2026-09-10T${time}:00`);
describe("school schedule", () => {
  test("moves to empty slots and swaps occupied slots without losing class data", () => {
    const classes: ClassEntry[] = [
      {
        id: "a",
        day: "MON",
        periodId: "p1",
        subject: "Art",
        room: "Studio",
        teacher: "Chen",
        color: "rose",
        extra: "keep",
      },
      {
        id: "b",
        day: "TUE",
        periodId: "p2",
        subject: "Biology",
        room: "Lab",
        teacher: "Ali",
        color: "sage",
      },
    ];
    const swapped = moveClass(classes, "a", "TUE", "p2");
    expect(swapped.map((c) => [c.id, c.day, c.periodId])).toEqual([
      ["a", "TUE", "p2"],
      ["b", "MON", "p1"],
    ]);
    expect(swapped[0].extra).toBe("keep");
    expect(swapped[1].subject).toBe("Biology");
    expect(classes[0].day).toBe("MON");
    const moved = moveClass(classes, "a", "FRI", "p2");
    expect(moved[0].day).toBe("FRI");
    expect(moved[1]).toEqual(classes[1]);
  });
  test("copies a day including empty slots, preserves target IDs and leaves inputs unchanged", () => {
    const classes = initial.classes.filter(
      (c) => c.day !== "MON" || c.periodId === "p1",
    );
    let id = 0;
    const copied = copyDay(classes, "MON", () => `copy-${id++}`);
    expect(copied).toHaveLength(5);
    expect(copied.find((c) => c.day === "TUE")?.id).toBe("t-p1");
    expect(new Set(copied.map((c) => c.id)).size).toBe(5);
    expect(classes.length).toBeGreaterThan(5);
  });
  test("rejects malformed, reversed, and overlapping bell times but accepts adjacent periods", () => {
    expect(validTimes("25:00", "26:00")).toBe(false);
    expect(validTimes("10:00", "09:00")).toBe(false);
    expect(
      periodError(
        { id: "new", name: "Extra", start: "08:30", end: "09:30" },
        initial.periods,
      ),
    ).toContain("overlaps");
    expect(
      periodError(
        { id: "new", name: "Extra", start: "15:00", end: "15:30" },
        initial.periods,
      ),
    ).toBe("");
  });
  test("finds current and next classes using time order, exact boundaries, and rooms", () => {
    const data = { ...initial, periods: [...initial.periods].reverse() };
    expect(liveStatus(data, at("08:15"))).toMatchObject({
      label: "In class",
      title: "AP Biology",
      detail: "Lab B · 50 min left",
      periodId: "p1",
    });
    expect(liveStatus(data, at("09:05"))).toMatchObject({
      label: "Up next",
      title: "Honors Lit",
      detail: "Rm 112 · in 5 min",
    });
    expect(liveStatus(data, at("07:00"))).toMatchObject({
      label: "Before school",
      title: "AP Biology",
    });
  });
  test("handles free slots, activities, evenings, weekends, and empty schedules", () => {
    const data: Schedule = {
      ...initial,
      classes: initial.classes.filter((c) => c.id !== "th-p1"),
    };
    expect(liveStatus(data, at("08:30")).label).toBe("Free period");
    expect(liveStatus(initial, at("15:00")).title).toBe(
      "Math Tutoring Drop-in",
    );
    expect(liveStatus(initial, at("15:30")).label).toBe("After class");
    expect(liveStatus(initial, at("18:00")).label).toBe("All done");
    expect(liveStatus(initial, new Date("2026-09-12T09:00:00")).label).toBe(
      "Weekend",
    );
    expect(
      liveStatus({ ...initial, periods: [], activities: [] }, at("12:00"))
        .label,
    ).toBe("Open day");
  });
});

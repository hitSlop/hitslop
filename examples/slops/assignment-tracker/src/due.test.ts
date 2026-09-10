import { describe, expect, test } from "bun:test";
import {
  daysUntil,
  parseISO,
  relativeDue,
  groupAssignments,
  msUntilNextDay,
} from "./due";
const base = {
  id: "a",
  courseCode: "BIO",
  title: "Lab",
  dueDate: "",
  category: "Lab",
  points: 10,
  completed: false,
  notes: "",
};
describe("assignment deadlines", () => {
  test("rejects impossible dates without treating them as today", () => {
    for (const date of ["", "2026-02-29", "2026-04-31", "2026-13-01", "bad"]) {
      expect(parseISO(date)).toBeNull();
      expect(relativeDue(date, "2026-09-10").urgency).toBe("undated");
    }
    expect(parseISO("2024-02-29")).not.toBeNull();
    expect(parseISO("0001-01-01")).not.toBeNull();
  });
  test("groups day boundaries including the full next seven days", () => {
    expect(daysUntil("2026-03-09", "2026-03-07")).toBe(2);
    for (const [date, urgency] of [
      ["2026-09-09", "overdue"],
      ["2026-09-10", "today"],
      ["2026-09-17", "soon"],
      ["2026-09-18", "later"],
    ] as const)
      expect(relativeDue(date, "2026-09-10").urgency).toBe(urgency);
  });
  test("sorts dated work and keeps completed and undated work separate", () => {
    const groups = groupAssignments(
      [
        { ...base, id: "b", dueDate: "2026-09-12" },
        { ...base, id: "c", dueDate: "2026-09-11" },
        { ...base, id: "d" },
        { ...base, id: "e", completed: true, dueDate: "2026-09-01" },
      ],
      "2026-09-10",
    );
    expect(groups.map((g) => g.id)).toEqual(["soon", "undated", "done"]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["c", "b"]);
  });
  test("refreshes just beyond local midnight", () => {
    expect(msUntilNextDay(new Date(2026, 8, 10, 23, 59, 59, 500))).toBe(550);
  });
});

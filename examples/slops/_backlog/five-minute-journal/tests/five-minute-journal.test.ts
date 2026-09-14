import { describe, expect, test } from "bun:test";
import { CalendarDate } from "@internationalized/date";
import { Value } from "typebox/value";
import schema from "../five-minute-journal/schema";
import {
  calendarDate,
  dateString,
  displayDate,
  freshJournal,
  initialView,
} from "../five-minute-journal/src/journal";

describe("Five Minute Journal", () => {
  test("new journals are blank and independent", () => {
    const first = freshJournal();
    const second = freshJournal();
    expect(Value.Check(schema, first)).toBe(true);
    expect(first.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(first.gratitudes).toEqual(["", "", ""]);
    expect(first.intentions).toEqual(["", "", ""]);
    expect(first.highlights).toEqual(["", "", ""]);
    expect([
      first.affirmation,
      first.lesson,
      first.quote,
      first.quoteAuthor,
    ]).toEqual(["", "", "", ""]);
    expect([first.morningDone, first.eveningDone]).toEqual([false, false]);
    first.gratitudes[0] = "A good conversation";
    expect(second.gratitudes[0]).toBe("");
  });

  test("opening view follows saved completion without changing the document", () => {
    for (const [morningDone, eveningDone, expected] of [
      [false, false, "am"],
      [true, false, "pm"],
      [true, true, "all"],
      [false, true, "am"],
    ] as const) {
      const data = {
        ...freshJournal(),
        morningDone,
        eveningDone,
        extra: { note: "preserved" },
      };
      const before = JSON.stringify(data);
      expect(initialView(data)).toBe(expected);
      expect(JSON.stringify(data)).toBe(before);
      expect(Value.Check(schema, data)).toBe(true);
    }
  });

  test("calendar selections are date-only and legacy date labels are preserved", () => {
    const selected = dateString(new CalendarDate(2028, 2, 29));
    expect(selected).toBe("2028-02-29");
    expect(calendarDate(selected)?.day).toBe(29);
    expect(displayDate(selected)).toContain("2028");
    expect(calendarDate("2026-02-30")).toBeUndefined();
    expect(calendarDate("Our first day away")).toBeUndefined();
    expect(displayDate("Our first day away")).toBe("Our first day away");
    expect(displayDate("Thursday, Sep 10, 2026")).toBe(
      "Thursday, Sep 10, 2026",
    );
    expect(displayDate("")).toBe("Choose a day");
  });
});

import { expect, test } from "bun:test";
import { Document } from "../src/document";
import { MemoryStore } from "../src/memory";
import schema, { colors } from "../../../examples/slops/habit-heatmap/schema";
import initial from "../../../examples/slops/habit-heatmap/initial";
import { calendarDays, completedDays, localDate, shiftDay, streak } from "../../../examples/slops/habit-heatmap/calendar";

test("habit records stay independent and typed edits survive reopen", async () => {
  const store = new MemoryStore();
  const doc = await Document.open(schema, store, initial);
  const [pages, walk] = doc.current.habits;
  expect(Object.keys(pages!.checkins)).toHaveLength(0);
  doc.at(pages!).checkins.put("2026-09-23", 1);
  doc.at(walk!).checkins.put("2026-09-23", 1);
  doc.at(pages!).checkins.delete("2026-09-23");
  expect(doc.current.habits[0]!.checkins["2026-09-23"]).toBeUndefined();
  expect(doc.current.habits[1]!.checkins["2026-09-23"]).toBe(1);
  expect(() => doc.at(walk!).checkins.put("2026-09-24", 0)).toThrow();
  expect(() => doc.at(walk!).checkins.put("2026-09-24", 1.5)).toThrow();
  doc.change(tx => {
    tx.at(walk!).name.replace("Walk outside 😁");
    tx.at(walk!).color.set("blue");
  });
  const { id } = doc.fields.habits.insert({ name: "Stretch", color: "mint", checkins: {} });
  doc.fields.habits.item(id).checkins.put("2026-09-23", 1);
  // Same operation path used by live and engine-only native CLI editing.
  doc.apply({ type: "set", path: ["habits", { id }, "checkins", { key: "2026-09-22" }], value: 1 });
  const before = doc.current;
  await doc.close();
  const reopened = await Document.open(schema, store, initial);
  expect(reopened.current).toEqual(before);
  expect(reopened.current.habits[1]!.$id).toBe(walk!.$id);
  expect(reopened.current.habits[1]!.name).toBe("Walk outside 😁");
  expect(reopened.current.habits[3]!.checkins["2026-09-22"]).toBe(1);
  await reopened.close();
});

test("calendar columns are complete Monday-based weeks across year boundaries", () => {
  const days = calendarDays("2027-01-01");
  expect(days).toHaveLength(84);
  expect(new Set(days).size).toBe(84);
  expect(localDate(days[0]!).getDay()).toBe(1);
  expect(days.at(-1)).toBe("2027-01-03");
  expect(days.filter(day => day > "2027-01-01")).toEqual(["2027-01-02", "2027-01-03"]);
  expect(shiftDay("2028-02-28", 1)).toBe("2028-02-29");
  expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
  expect(() => localDate("2026-02-29")).toThrow();
});

test("streaks allow today to be unfinished and look beyond the displayed period", () => {
  const today = "2026-09-23";
  const records = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [shiftDay(today, -i - 1), 1]));
  expect(streak(records, today)).toBe(100);
  records[today] = 1;
  expect(streak(records, today)).toBe(101);
  delete records[shiftDay(today, -4)];
  expect(streak(records, today)).toBe(4);
  expect(completedDays({ [today]: 1, "2026-09-24": 1, "2025-01-01": 1 }, calendarDays(today), today)).toBe(1);
  expect(streak({}, today)).toBe(0);
});

test.each(["America/New_York", "Pacific/Auckland", "America/Regina"])("calendar date math survives DST in %s", timezone => {
  const module = new URL("../../../examples/slops/habit-heatmap/calendar.ts", import.meta.url).href;
  const child = Bun.spawnSync([process.execPath, "-e", `
    import {dayKey, shiftDay, calendarDays} from ${JSON.stringify(module)};
    console.log(JSON.stringify({
      local: dayKey(new Date('2026-09-23T00:30:00Z')),
      spring: shiftDay('2026-03-08', 1), fall: shiftDay('2026-11-01', 1),
      unique: new Set(calendarDays('2026-11-04')).size
    }));
  `], { env: { ...process.env, TZ: timezone } });
  expect(child.exitCode).toBe(0);
  const result = JSON.parse(child.stdout.toString());
  expect(result).toEqual({ local: timezone === "Pacific/Auckland" ? "2026-09-23" : "2026-09-22", spring: "2026-03-09", fall: "2026-11-02", unique: 84 });
});

test("all twelve habit colors persist and row removal deletes only its check-ins", async () => {
  const store = new MemoryStore();
  const doc = await Document.open(schema, store, { habits: [] });
  expect(colors).toHaveLength(12);
  for (const color of colors) doc.fields.habits.insert({ name: color, color, checkins: { "2026-09-23": 1 } });
  await doc.close();
  const reopened = await Document.open(schema, store, { habits: [] });
  expect(reopened.current.habits.map(habit => habit.color)).toEqual([...colors]);
  const removed = reopened.current.habits[4]!.$id;
  reopened.fields.habits.remove(removed);
  await reopened.close();
  const final = await Document.open(schema, store, { habits: [] });
  expect(final.current.habits).toHaveLength(11);
  expect(final.current.habits.some(habit => habit.$id === removed)).toBe(false);
  expect(final.current.habits.every(habit => habit.checkins["2026-09-23"] === 1)).toBe(true);
  await final.close();
});

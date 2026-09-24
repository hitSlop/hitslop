import { expect, test } from "bun:test";
import { Document } from "../src/document";
import { MemoryStore } from "../src/memory";
import schema from "../../../examples/slops/side-quest/schema";
import initial from "../../../examples/slops/side-quest/initial";
import { addDays, byDue, cleared, daysBetween, hp, nextBoss, span } from "../../../examples/slops/side-quest/quest";

test("study sessions knock boss HP down and persist through reopen", async () => {
  const store = new MemoryStore();
  const doc = await Document.open(schema, store, initial);
  const chem = doc.current.courses[0]!;
  const midterm = chem.quests.find((quest) => quest.kind === "boss")!;
  expect(hp(midterm)).toBe(5);
  for (let i = 0; i < 5; i++) doc.at(midterm).hits.increment();
  doc.change((tx) => tx.fields.courses.item(chem.$id).quests.item(midterm.$id).sticker.set("crown"));
  const defeated = doc.current.courses[0]!.quests.find((quest) => quest.$id === midterm.$id)!;
  expect(hp(defeated)).toBe(0);
  expect(cleared(defeated)).toBe(true);
  await doc.close();

  const reopened = await Document.open(schema, store, initial);
  const saved = reopened.current.courses[0]!.quests.find((quest) => quest.$id === midterm.$id)!;
  expect(Number(saved.hits)).toBe(8);
  expect(saved.sticker).toBe("crown");
  expect(nextBoss(reopened.current.courses, "2026-09-23")?.course.code).toBe("PSYC 110");
  await reopened.close();
});

test("quests order by due date and the next boss skips past and cleared bosses", async () => {
  const doc = await Document.open(schema, new MemoryStore(), initial);
  const cs = doc.current.courses[2]!;
  doc.at(cs).quests.insert({ title: "Pop quiz", kind: "quest", due: "2026-09-01", done: false, maxHp: 1, hits: 0, notes: "" });
  const ordered = byDue(doc.current.courses[2]!.quests).map((quest) => quest.title);
  expect(ordered[0]).toBe("Pop quiz");
  expect(nextBoss(doc.current.courses, "2026-09-23")?.quest.due).toBe("2026-10-09");
  expect(nextBoss(doc.current.courses, "2026-10-10")?.quest.due).toBe("2026-10-28");
  expect(nextBoss(doc.current.courses, "2027-01-01")).toBeUndefined();
  await doc.close();
});

test("date helpers survive month boundaries and pad the timeline", () => {
  expect(addDays("2026-09-28", 7)).toBe("2026-10-05");
  expect(daysBetween("2026-10-30", "2026-11-02")).toBe(3);
  const { start, end } = span(initial.courses, "2026-09-23");
  expect(new Date(start).getMonth()).toBe(8);
  expect(new Date(end).getMonth()).toBe(11);
});

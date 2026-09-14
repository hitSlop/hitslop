import { expect, test } from "bun:test";
import { describeChanges } from "../src/review";
import { checklist, trip } from "./fixtures";
import { syncMapping } from "@hitslop/schema/document";
test("review matches reordered list items by domain ID and omits unchanged fields", () => {
  const edited = structuredClone(trip); edited.tasks.reverse(); edited.tasks[0]!.text = "New task text";
  const proposal = describeChanges(syncMapping(checklist), trip, edited);
  expect(proposal).toContain('data.tasks[id="task-b"].text');
  expect(proposal).toContain('data.tasks order');
  expect(proposal).not.toContain('.done');
  expect(proposal).not.toContain('data.title');
});

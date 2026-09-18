import { expect, test } from "bun:test";
import { documentScope } from "../src/document-scope.ts";

test("wrapper receives an early error once and every later failure event", () => {
  const store = {},
    scope = documentScope(store);
  expect(documentScope(store)).toBe(scope);
  scope.report({ source: "document", message: "Open failed" });
  const messages: string[] = [];
  const stop = scope.subscribe((issue) => messages.push(issue.message));
  scope.report({ source: "media", message: "Import failed" });
  expect(messages).toEqual(["Open failed", "Import failed"]);
  stop();
  scope.subscribe((issue) => messages.push(issue.message))();
  expect(messages).toHaveLength(2);
});

import { expect, test } from "bun:test";
import * as S from "@hitslop/schema/document";
import { utf8Length } from "@hitslop/schema/json";
import { freeze } from "@hitslop/schema/document-protocol";
import { applyOps } from "../src/document-ops.js";

test("UTF-8 count matches TextEncoder before and after JSON serialization", () => {
  const samples = [
    "",
    "ascii",
    "é",
    "e\u0301",
    "😀",
    "\ud800",
    "\udfff",
    "\ud800a",
    "\udfff\ud800",
    "😀é\ud800",
  ];
  for (let unit = 0; unit <= 0xffff; unit++) samples.push(String.fromCharCode(unit));
  for (const value of samples) {
    expect(utf8Length(value)).toBe(new TextEncoder().encode(value).byteLength);
    expect(utf8Length(JSON.stringify(value))).toBe(
      new TextEncoder().encode(JSON.stringify(value)).byteLength,
    );
  }
});

test("path copies protect frozen inputs across list edits and failed batches", () => {
  const schema = S.Document({
    rows: S.List(S.Object({ id: S.String(), done: S.Boolean() }), "id"),
    untouched: S.Object({ text: S.String() }),
  });
  const before = freeze({
    rows: [
      { id: "a", done: false },
      { id: "b", done: false },
    ],
    untouched: { text: "keep" },
  });
  const value = { id: "c", done: false };
  const path = [{ key: "rows" }];
  const result = applyOps(schema, before, [
    { op: "insert", path, value },
    { op: "toggle", path: [...path, { item: "a" }, { key: "done" }] },
    { op: "move", path, id: "c", position: { before: "a" } },
    { op: "remove", path, id: "b" },
  ]).data as S.Static<typeof schema>;
  expect(result.rows).toEqual([
    { id: "c", done: false },
    { id: "a", done: true },
  ]);
  expect(result.untouched).toBe(before.untouched);
  value.done = true;
  expect(result.rows[0]!.done).toBe(false);
  expect(() =>
    applyOps(schema, before, [
      { op: "remove", path, id: "a" },
      { op: "move", path, id: "b", position: { after: "missing" } },
    ]),
  ).toThrow();
  expect(before.rows).toEqual([
    { id: "a", done: false },
    { id: "b", done: false },
  ]);
});

import * as S from "../src/schema.ts";
import type { ErrorCode, JSONValue, Request } from "../src/protocol.ts";

export const fixtureSchema = S.Document({
  title: S.Text(), count: S.Integer({ minimum: 0 }), active: S.Boolean(), note: S.Optional(S.String()),
  tags: S.Array(S.String()), attributes: S.Record(S.String()),
  tasks: S.List(S.Object({ id: S.String(), text: S.Text(), done: S.Boolean(), archived: S.Boolean(),
    children: S.List(S.Object({ key: S.String(), value: S.Number() }), "key"),
  }), "id"),
});
export const initial = {
  title: "Original", count: 0, active: false, tags: ["one"], attributes: { "a.b": "kept" },
  unknown: { extension: "preserved" },
  tasks: [
    { id: "a", text: "Alpha", done: false, archived: false, children: [{ key: "child", value: 1 }] },
    { id: "b", text: "Beta", done: false, archived: false, children: [] },
  ],
};
const k = (key: string) => ({ key });
const i = (item: string) => ({ item });
type Event = { request: Request | unknown; expected: { revision: number; data: JSONValue; error?: ErrorCode } };
export type Scenario = { name: string; events: Event[] };
const changed = (edit: (value: typeof initial & { note?: string }) => void): JSONValue => {
  const next = structuredClone(initial); edit(next); return next;
};
const one = (name: string, ops: unknown[], data: JSONValue = initial, error?: ErrorCode): Scenario => ({ name, events: [
  { request: { requestId: name, ops }, expected: { revision: error ? 0 : 1, data, ...(error ? { error } : {}) } },
] });
const inc: Request = { requestId: "repeat", ops: [{ op: "increment", path: [k("count")], amount: 1 }] };
export const scenarios: Scenario[] = [
  one("scalar-set", [{ op: "set", path: [k("title")], value: "Changed" }], changed(v => { v.title = "Changed"; })),
  one("record-replacement", [{ op: "set", path: [k("attributes")], value: { fresh: "value" } }], changed(v => { v.attributes = { fresh: "value" } as unknown as typeof v.attributes; })),
  one("row-replacement", [{ op: "set", path: [k("tasks"), i("a")], value: { ...initial.tasks[0]!, text: "Replaced" } }], changed(v => { v.tasks[0]!.text = "Replaced"; })),
  one("row-replacement-identity-change", [{ op: "set", path: [k("tasks"), i("a")], value: { ...initial.tasks[0]!, id: "c" } }], initial, "identity_change"),
  one("toggle", [{ op: "toggle", path: [k("active")] }], changed(v => { v.active = true; })),
  one("increment", [{ op: "increment", path: [k("count")], amount: 2 }], changed(v => { v.count = 2; })),
  one("optional-set-unset", [{ op: "set", path: [k("note")], value: "draft" }, { op: "unset", path: [k("note")] }]),
  one("record-dot-and-prototype-keys", [
    { op: "set", path: [k("attributes"), k("a.b")], value: "literal key" },
    { op: "set", path: [k("attributes"), k("__proto__")], value: "safe" },
  ], changed(v => { v.attributes["a.b"] = "literal key"; Object.defineProperty(v.attributes, "__proto__", { value: "safe", enumerable: true }); })),
  one("record-unset", [{ op: "unset", path: [k("attributes"), k("a.b")] }], changed(v => { delete (v.attributes as Record<string, string>)["a.b"]; })),
  one("atomic-array", [{ op: "set", path: [k("tags")], value: ["two", "three"] }], changed(v => { v.tags = ["two", "three"]; })),
  one("nested-list", [{ op: "increment", path: [k("tasks"), i("a"), k("children"), i("child"), k("value")], amount: 4 }], changed(v => { v.tasks[0]!.children[0]!.value = 5; })),
  one("insert-before", [{ op: "insert", path: [k("tasks")], value: { id: "c", text: "Gamma", done: false, archived: false, children: [] }, position: { before: "b" } }], changed(v => { v.tasks.splice(1, 0, { id: "c", text: "Gamma", done: false, archived: false, children: [] }); })),
  one("insert-after", [{ op: "insert", path: [k("tasks")], value: { id: "c", text: "Gamma", done: false, archived: false, children: [] }, position: { after: "b" } }], changed(v => { v.tasks.push({ id: "c", text: "Gamma", done: false, archived: false, children: [] }); })),
  one("remove", [{ op: "remove", path: [k("tasks")], id: "a" }], changed(v => { v.tasks.shift(); })),
  one("move-after", [{ op: "move", path: [k("tasks")], id: "a", position: { after: "b" } }], changed(v => { v.tasks.reverse(); })),
  one("move-before", [{ op: "move", path: [k("tasks")], id: "b", position: { before: "a" } }], changed(v => { v.tasks.reverse(); })),
  one("patch-as-batch", [{ op: "set", path: [k("tasks"), i("a"), k("done")], value: true }, { op: "set", path: [k("tasks"), i("a"), k("archived")], value: true }], changed(v => { v.tasks[0]!.done = true; v.tasks[0]!.archived = true; })),
  one("rollback", [{ op: "set", path: [k("title")], value: "Must not persist" }, { op: "increment", path: [k("count")], amount: -1 }], initial, "validation"),
  one("duplicate-id", [{ op: "insert", path: [k("tasks")], value: initial.tasks[0] }], initial, "duplicate_id"),
  one("identity-change", [{ op: "set", path: [k("tasks"), i("a"), k("id")], value: "new" }], initial, "identity_change"),
  one("missing-target", [{ op: "remove", path: [k("tasks")], id: "gone" }], initial, "missing_target"),
  one("missing-anchor", [{ op: "move", path: [k("tasks")], id: "a", position: { before: "gone" } }], initial, "missing_anchor"),
  one("required-unset", [{ op: "unset", path: [k("title")] }], initial, "invalid_operation"),
  one("unknown-field", [{ op: "set", path: [k("typo")], value: true }], initial, "invalid_path"),
  one("numeric-index", [{ op: "set", path: [k("tasks"), 0, k("done")], value: true }], initial, "invalid_request"),
  one("atomic-item", [{ op: "set", path: [k("tags"), i("one")], value: "two" }], initial, "invalid_path"),
  one("self-move", [{ op: "move", path: [k("tasks")], id: "a", position: { before: "a" } }], initial, "invalid_operation"),
  { name: "retry-and-id-reuse", events: [
    { request: inc, expected: { revision: 1, data: changed(v => { v.count = 1; }) } },
    { request: inc, expected: { revision: 1, data: changed(v => { v.count = 1; }) } },
    { request: { ...inc, ops: [{ op: "increment", path: [k("count")], amount: 9 }] }, expected: { revision: 1, data: changed(v => { v.count = 1; }), error: "request_reused" } },
  ] },
  { name: "conditional-replacement", events: [
    { request: { requestId: "replace", replace: { baseRevision: 0, data: changed(v => { v.title = "External"; }) } }, expected: { revision: 1, data: changed(v => { v.title = "External"; }) } },
    { request: { requestId: "stale", replace: { baseRevision: 0, data: initial } }, expected: { revision: 1, data: changed(v => { v.title = "External"; }), error: "stale_revision" } },
  ] },
];

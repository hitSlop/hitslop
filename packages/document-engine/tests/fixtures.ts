import * as S from "../../schema/src/document.ts";

export const identity = { documentId: "document", schemaHash: "schema", authority: "authority" };
export const lease = { id: "lease", expiresAt: 9999999999999 };
export const item = S.Object({ id: S.String(), text: S.String(), done: S.Boolean() });
export const schema = S.Document({
  tasks: S.List(item, "id"),
  count: S.Number(),
  flag: S.Boolean(),
  title: S.String(),
  optional: S.Optional(S.String()),
  record: S.Record(S.String()),
});
export const initial = {
  tasks: [
    { id: "a", text: "A", done: false },
    { id: "b", text: "B", done: true },
  ],
  count: 1,
  flag: false,
  title: "Title",
  optional: "present",
  record: {},
  extra: { kept: true },
};
const key = (name: string) => [{ key: name }];
export type Fixture = {
  name: string;
  schema: unknown;
  data: any;
  command: any;
  expected: any;
  state?: Record<string, unknown>;
  now?: number;
};
export const fixtures: Fixture[] = [];
function add(name: string, ops: any[], expected: any, code?: string) {
  fixtures.push({
    name,
    schema,
    data: initial,
    command: { ops },
    expected: code ? { code } : { data: expected },
  });
}
add("set", [{ op: "set", path: key("title"), value: "New" }], { ...initial, title: "New" });
add("toggle", [{ op: "toggle", path: key("flag") }], { ...initial, flag: true });
add("increment", [{ op: "increment", path: key("count"), amount: 2 }], { ...initial, count: 3 });
const withoutOptional = { ...initial };
delete (withoutOptional as any).optional;
add("unset", [{ op: "unset", path: key("optional") }], withoutOptional);
add(
  "insert",
  [
    {
      op: "insert",
      path: key("tasks"),
      value: { id: "c", text: "C", done: false },
      position: { before: "b" },
    },
  ],
  { ...initial, tasks: [initial.tasks[0], { id: "c", text: "C", done: false }, initial.tasks[1]] },
);
add("remove", [{ op: "remove", path: key("tasks"), id: "a" }], {
  ...initial,
  tasks: [initial.tasks[1]],
});
add("move", [{ op: "move", path: key("tasks"), id: "b", position: { before: "a" } }], {
  ...initial,
  tasks: [...initial.tasks].reverse(),
});
add(
  "identity-addressed-batch",
  [
    { op: "remove", path: key("tasks"), id: "a" },
    { op: "set", path: [{ key: "tasks" }, { item: "b" }, { key: "text" }], value: "still B" },
  ],
  { ...initial, tasks: [{ ...initial.tasks[1], text: "still B" }] },
);
for (const [name, ops, code] of [
  [
    "atomic-failure",
    [
      { op: "toggle", path: key("flag") },
      { op: "set", path: key("count"), value: "wrong" },
    ],
    "validation",
  ],
  ["missing-item", [{ op: "remove", path: key("tasks"), id: "gone" }], "missing_target"],
  [
    "missing-anchor",
    [{ op: "move", path: key("tasks"), id: "a", position: { after: "gone" } }],
    "missing_anchor",
  ],
  ["duplicate-id", [{ op: "insert", path: key("tasks"), value: initial.tasks[0] }], "duplicate_id"],
  [
    "identity-change",
    [{ op: "set", path: [{ key: "tasks" }, { item: "a" }, { key: "id" }], value: "z" }],
    "identity_change",
  ],
  ["undeclared-path", [{ op: "set", path: key("undeclared"), value: 1 }], "invalid_path"],
] as const)
  add(name, [...ops], null, code);

fixtures.push({
  name: "replace",
  schema,
  data: initial,
  command: { replace: { baseRevision: 0, data: { ...initial, title: "replacement" } } },
  expected: { data: { ...initial, title: "replacement" } },
});
fixtures.push({
  name: "stale-replace",
  schema,
  data: initial,
  command: { replace: { baseRevision: 1, data: initial } },
  expected: { code: "stale_revision" },
});
fixtures.push({
  name: "expired-lease",
  schema,
  data: initial,
  command: { ops: [{ op: "toggle", path: key("flag") }] },
  now: lease.expiresAt,
  expected: { code: "lease_expired" },
});
fixtures.push({
  name: "wrong-authority",
  schema,
  data: initial,
  command: { authority: "wrong", ops: [{ op: "toggle", path: key("flag") }] },
  expected: { code: "authority_changed" },
});
fixtures.push({
  name: "undo",
  schema,
  data: { ...initial, flag: true },
  command: { undo: { requestId: "previous", revision: 1 } },
  state: {
    snapshotRevision: 1,
    undo: {
      leaseId: "lease",
      requestId: "previous",
      revision: 1,
      snapshot: { ...identity, revision: 0, data: initial },
    },
  },
  expected: { data: initial },
});
fixtures.push({
  name: "stale-undo",
  schema,
  data: initial,
  command: { undo: { requestId: "previous", revision: 1 } },
  expected: { code: "stale_revision" },
});

const unicodeSchema = S.Document({
  ["é"]: S.String(),
  ["e\u0301"]: S.String(),
  record: S.Record(S.String()),
  tasks: S.List(item, "id"),
});
const unicodeData = JSON.parse(
  '{"é":"composed","é":"decomposed","record":{"__proto__":"ordinary","constructor":"ordinary","prototype":"ordinary","":"empty","\\ud800":"\\udfff"},"tasks":[{"id":"é","text":"one","done":false},{"id":"é","text":"two","done":false}],"unknown":"\\ud800"}',
);
fixtures.push({
  name: "unicode-and-unknown-preservation",
  schema: unicodeSchema,
  data: unicodeData,
  command: {
    ops: [
      {
        op: "set",
        path: [{ key: "tasks" }, { item: "e\u0301" }, { key: "text" }],
        value: "changed",
      },
    ],
  },
  expected: {
    data: {
      ...unicodeData,
      tasks: [unicodeData.tasks[0], { ...unicodeData.tasks[1], text: "changed" }],
    },
  },
});
fixtures.push({
  name: "prototype-name-write",
  schema: unicodeSchema,
  data: unicodeData,
  command: { ops: [{ op: "set", path: [{ key: "record" }, { key: "__proto__" }], value: "safe" }] },
  expected: { data: { ...unicodeData, record: { ...unicodeData.record, ["__proto__"]: "safe" } } },
});

fixtures.push({
  name: "surrogate-identifiers",
  schema: S.Document({ tasks: S.List(item, "id") }),
  data: { tasks: [{ id: "\ud800", text: "\udfff", done: false }] },
  command: {
    requestId: "\ud800",
    ops: [{ op: "toggle", path: [{ key: "tasks" }, { item: "\ud800" }, { key: "done" }] }],
  },
  expected: { data: { tasks: [{ id: "\ud800", text: "\udfff", done: true }] } },
});

export function workloads() {
  const schema = S.Document({ tasks: S.List(item, "id") });
  return [100, 1000, 5000, 10000, 14000].map((rows) => {
    const data = {
      tasks: Array.from({ length: rows }, (_, i) => ({
        id: String(i),
        text: "x".repeat(32),
        done: false,
      })),
    };
    return {
      name: `rows-${rows}`,
      rows,
      schemaJSON: JSON.stringify(schema),
      snapshotJSON: JSON.stringify({ ...identity, revision: 0, data }),
    };
  });
}

const referencedSchema = Object.assign(S.Document({ node: S.Atomic({ $ref: "#/$defs/node" }) }), {
  $id: "urn:hitslop:reference-fixture",
  $defs: {
    node: {
      type: "object",
      properties: {
        text: { type: "string" },
        children: { type: "array", items: { $ref: "#/$defs/node" } },
      },
      required: ["text"],
      additionalProperties: true,
    },
  },
});
for (const valid of [true, false]) {
  const value = { text: "root", children: [{ text: valid ? "child" : 3, future: true }] };
  fixtures.push({
    name: valid ? "recursive-schema-reference" : "invalid-recursive-reference",
    schema: referencedSchema,
    data: { node: { text: "before" } },
    command: { ops: [{ op: "set", path: [{ key: "node" }], value }] },
    expected: { schemaError: true },
  });
}

// Representative archived app capabilities; no archived source is part of active builds.
const archiveSchema = S.Document({
  amount: S.Union([S.Number(), S.Null()]),
  mode: S.Enum(["daily", "practice"]),
  cells: S.Record(
    S.Object({ raw: S.String(), style: S.Optional(S.Object({ bold: S.Optional(S.Boolean()) })) }),
  ),
  decks: S.List(
    S.Object({
      id: S.String(),
      cards: S.List(S.Object({ id: S.String(), text: S.String() }), "id"),
    }),
    "id",
  ),
  lines: S.Array(S.String(), { minItems: 3, maxItems: 3 }),
  sets: S.Array(S.Integer({ minimum: 0 }), { uniqueItems: true }),
  bpm: S.Integer({ minimum: 40, maximum: 240 }),
  pixels: S.Array(S.String()),
  attachment: S.Optional(S.Media()),
});
const archiveData = {
  amount: null,
  mode: "daily",
  cells: { A1: { raw: "=1+2", style: { bold: true } } },
  decks: [{ id: "d", cards: [{ id: "c", text: "Q" }] }],
  lines: ["a", "b", "c"],
  sets: [0, 2],
  bpm: 120,
  pixels: ["#fff", ""],
  future: { retained: true },
};
fixtures.push({
  name: "archive-shaped-document",
  schema: archiveSchema,
  data: archiveData,
  command: { ops: [{ op: "set", path: [{ key: "amount" }], value: 4 }] },
  expected: { data: { ...archiveData, amount: 4 } },
});
fixtures.push({
  name: "archive-array-uniqueness",
  schema: archiveSchema,
  data: archiveData,
  command: { ops: [{ op: "set", path: [{ key: "sets" }], value: [1, 1] }] },
  expected: { code: "validation" },
});

import * as S from "../../packages/schema/src/document.ts";

export type Fixture = {
  name: string;
  json: string;
  valid: boolean;
  category?: string;
  preserve?: boolean;
};
export type Group = {
  name: string;
  schema: string;
  formats: boolean;
  schemaValid: boolean;
  native: boolean;
  cases: Fixture[];
};
export type Boundary = { name: string; kind: "depth" | "bytes"; size: number; escaped?: boolean };
const json = JSON.stringify;
const item = (name: string, value: unknown, valid: boolean): Fixture => ({
  name,
  json: json(value),
  valid,
});
const raw = (name: string, value: string, valid: boolean, category?: string): Fixture => ({
  name,
  json: value,
  valid,
  category,
});

export function makeFixtures(shared: any[], bridge: unknown, checklist: unknown, initial: any) {
  const groups: Group[] = [];
  const add = (name: string, schema: unknown, cases: Fixture[], native = false) =>
    groups.push({ name, schema: json(schema), formats: true, schemaValid: true, native, cases });
  // Keep generic schemas unwrapped so reference scopes do not change. Production
  // equivalents below use an authored S.Document root and exercise its adapter.
  for (const fixture of shared)
    add(
      `shared/${fixture.name}`,
      fixture.schema,
      fixture.cases.map((c: any, i: number) => item(`case-${i + 1}`, c.value, c.valid)),
    );
  const identity = {
    documentId: "spike",
    schemaHash: "schema",
    authority: "local",
    leaseId: "lease",
    requestId: "request",
  };
  const command = {
    method: "document.execute",
    request: { ...identity, ops: [{ op: "toggle", path: [{ key: "done" }] }] },
  };
  add("bridge-current", bridge, [
    item("execute", command, true),
    item("open", { method: "document.open" }, true),
    item("media-open", { method: "media.open", sha256: "a".repeat(64) }, true),
    item("bad-ops", { ...command, request: { ...command.request, ops: [] } }, false),
    item("legacy-method", { method: "document.apply", after: {} }, false),
    item("extra-property", { method: "host.info", extra: 1 }, false),
    item("execute-again", command, true),
  ]);
  add(
    "checklist",
    checklist,
    [
      item("initial", initial, true),
      item("unknown-fields", { ...initial, future: { keep: true } }, true),
      item("invalid-title", { ...initial, title: 42 }, false),
      item("initial-again", initial, true),
    ],
    true,
  );
  add(
    "unicode-const",
    S.Document({ text: S.Literal("é") }),
    [
      item("exact", { text: "é" }, true),
      raw("decomposed", '{"text":"e\\u0301"}', false),
      item("exact-again", { text: "é" }, true),
    ],
    true,
  );
  add(
    "unicode-enum",
    S.Document({ text: { type: "string", enum: ["é", "ok"] } }),
    [
      item("exact", { text: "é" }, true),
      raw("decomposed", '{"text":"e\\u0301"}', false),
      item("other-member", { text: "ok" }, true),
    ],
    true,
  );
  add(
    "unicode-length",
    S.Document({ text: S.String({ minLength: 2, maxLength: 2 }) }),
    [
      item("ascii", { text: "ab" }, true),
      raw("combining", '{"text":"e\\u0301"}', true),
      item("one-scalar-emoji", { text: "😀" }, false),
      item("flag-two-scalars", { text: "🇨🇦" }, true),
      item("too-long", { text: "abc" }, false),
    ],
    true,
  );
  add(
    "unicode-uniqueness",
    S.Document({ values: S.Atomic({ type: "array", uniqueItems: true }) }),
    [
      raw("distinct-strings", '{"values":["é","e\\u0301"]}', true),
      item("duplicate-strings", { values: ["é", "é"] }, false),
      raw("distinct-nested-values", '{"values":[{"text":"é"},{"text":"e\\u0301"}]}', true),
      raw("distinct-nested-keys", '{"values":[{"é":1},{"e\\u0301":1}]}', true),
    ],
    true,
  );
  add(
    "unicode-keys",
    S.Document({ values: S.Record(S.Number()) }),
    [
      raw("distinct-keys", '{"values":{"é":1,"e\\u0301":2}}', true),
      raw("reverse-key-order", '{"values":{"e\\u0301":2,"é":1}}', true),
      raw("special-keys", '{"values":{"":1,"__proto__":2,"constructor":3,"a.b":4}}', true),
    ],
    true,
  );
  add(
    "unicode-required-key",
    S.Document({ é: S.Number() }),
    [raw("exact-key", '{"é":1}', true), raw("different-key", '{"e\\u0301":1}', false)],
    true,
  );
  add(
    "records",
    S.Document({ values: S.Record(S.Number()) }),
    [
      raw("newline-valid", '{"values":{"a\\nb":1}}', true),
      raw("newline-invalid", '{"values":{"a\\nb":"wrong"}}', false, "application-schema"),
      raw("carriage-return-invalid", '{"values":{"a\\rb":"wrong"}}', false, "application-schema"),
      raw("nul-invalid", '{"values":{"a\\u0000b":"wrong"}}', false),
      raw("ordinary-invalid", '{"values":{"ab":"wrong"}}', false),
    ],
    true,
  );
  add(
    "surrogates",
    S.Document({ text: S.String() }),
    [
      raw("valid-pair", '{"text":"\\ud83d\\ude00"}', true),
      raw("unpaired-high", '{"text":"\\ud800"}', true, "portability"),
      raw("unpaired-low", '{"text":"\\udc00"}', true, "portability"),
      raw("unpaired-key", '{"text":"ok","\\ud800":1}', true, "portability"),
      raw("malformed-json", '{"text":', false),
    ],
    true,
  );
  add(
    "numbers",
    S.Document({ value: S.Number() }),
    [
      raw("negative-zero", '{"value":-0}', true),
      raw("negative-zero-exponent", '{"value":-0e0}', true),
      raw("max-safe", '{"value":9007199254740991}', true),
      raw("rounded-integer", '{"value":9007199254740993}', true),
      raw("large-finite", '{"value":1e20}', true),
      raw("max-finite", '{"value":1.7976931348623157e308}', true),
      { ...raw("overflow", '{"value":1e400}', false, "portability"), preserve: false },
      raw("underflow", '{"value":1e-400}', true),
    ],
    true,
  );
  add(
    "integer-representation",
    S.Document({ value: S.Integer() }),
    [
      raw("one-point-zero", '{"value":1.0}', true),
      raw("large-integer", '{"value":1e20}', true),
      raw("fraction", '{"value":1.5}', false),
      raw("boolean", '{"value":true}', false),
    ],
    true,
  );
  const referenced = S.Document({ node: S.Atomic({ $ref: "#/$defs/node" }) }) as any;
  referenced.$defs = {
    node: {
      type: "object",
      properties: { text: { type: "string", minLength: 1 }, child: { $ref: "#/$defs/node" } },
      required: ["text"],
      additionalProperties: true,
    },
  };
  add(
    "production-references",
    referenced,
    [
      item("nested", { node: { text: "ok", child: { text: "child", future: true } } }, true),
      item("bad-nested", { node: { text: "ok", child: { text: 2 } } }, false),
      item("valid-again", { node: { text: "ok" } }, true),
    ],
    true,
  );
  add(
    "production-formats",
    S.Document({ email: S.String({ format: "email" }) }),
    [
      item("valid", { email: "a@example.com" }, true),
      item("invalid", { email: "nope" }, false),
      item("valid-again", { email: "a@example.com" }, true),
    ],
    true,
  );
  add(
    "no-defaults",
    S.Document({ count: S.Integer({ default: 3 }) }),
    [
      item("missing", { future: true }, false),
      item("wrong", { count: "3" }, false),
      item("valid", { count: 3, future: [null, true] }, true),
    ],
    true,
  );
  for (const [name, schema] of [
    ["invalid-type", '{"type":"bogus"}'],
    ["invalid-length", '{"type":"string","minLength":"bad"}'],
    ["malformed-schema", '{"type":'],
  ])
    groups.push({ name, schema, formats: true, schemaValid: false, native: false, cases: [] });
  const boundaries: Boundary[] = [60, 61, 62, 63, 64, 65].map((size) => ({
    name: `depth-${size}`,
    kind: "depth",
    size,
  }));
  for (const escaped of [false, true])
    for (const size of [1048575, 1048576, 1048577])
      boundaries.push({
        name: `bytes-${size}-${escaped ? "escaped" : "plain"}`,
        kind: "bytes",
        size,
        escaped,
      });
  return { groups, boundaries };
}

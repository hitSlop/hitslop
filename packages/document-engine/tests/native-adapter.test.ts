import { expect, test } from "bun:test";
import { runInNewContext } from "node:vm";
import { createNativeEngine } from "../src/jsc.js";
import { fixtures, identity, lease } from "./fixtures.ts";

const source = await Bun.file(
  new URL(
    "../../../apps/apple/Packages/HitSlopApple/Sources/HitSlopDocumentEngine/Resources/document-engine.js",
    import.meta.url,
  ),
).text();

test("generated bundle runs without browser globals, rejecting unsupported schema references", async () => {
  const bundled = runInNewContext(source + ";hitSlopState", {});
  const reference = fixtures.find((f) => f.name === "recursive-schema-reference")!;
  expect(
    JSON.parse(bundled.invoke("configure", [JSON.stringify(reference.schema)])),
  ).toHaveProperty("error");
});

function engine(bundled = false) {
  const host = bundled ? runInNewContext(source + ";hitSlopState", {}) : createNativeEngine();
  return (method: string, ...args: string[]) => {
    const reply = JSON.parse(host.invoke(method, args));
    if (reply.error) throw new Error(reply.error.message);
    return reply.value;
  };
}
for (const bundled of [false, true])
  for (const fixture of fixtures)
    test(`${bundled ? "emitted Apple" : "native"} ABI: ${fixture.name}`, () => {
      const call = engine(bundled);
      if (fixture.expected.schemaError) {
        expect(() => call("configure", JSON.stringify(fixture.schema))).toThrow();
        return;
      }
      call("configure", JSON.stringify(fixture.schema));
      const snapshot = {
        ...identity,
        revision: fixture.state?.snapshotRevision ?? 0,
        data: fixture.data,
      };
      const request = JSON.stringify({
        ...identity,
        requestId: fixture.name,
        leaseId: lease.id,
        ...fixture.command,
      });
      const inspected = call("request", request);
      expect(inspected.requestKey).toMatch(/^[\x00-\x7f]*$/);
      const digest = new Bun.CryptoHasher("sha256").update(inspected.canonical).digest("hex");
      const evaluated = call(
        "evaluate",
        JSON.stringify({ snapshot, lease, undo: fixture.state?.undo }),
        request,
        digest,
        String(fixture.now ?? 0),
      );
      if (fixture.expected.code) expect(evaluated.result.error?.code).toBe(fixture.expected.code);
      else {
        expect(evaluated.result.ok).toBe(true);
        expect(JSON.parse(evaluated.snapshot.data)).toEqual(fixture.expected.data);
        const projection = JSON.parse(call("projection", evaluated.snapshot.json));
        expect(projection.data).toEqual(fixture.expected.data);
        const opening = call("open", evaluated.snapshot.json, JSON.stringify(lease));
        expect(JSON.parse(opening.json).snapshot.data).toEqual(fixture.expected.data);
      }
    });
test("native dictionary keys retain normalization-distinct and surrogate identifiers", () => {
  const call = engine();
  const keys = ["é", "e\u0301", "\ud800"].map((id) =>
    call(
      "request",
      JSON.stringify({
        ...identity,
        requestId: id,
        leaseId: id,
        ops: [{ op: "toggle", path: [{ key: "flag" }] }],
      }),
    ),
  );
  expect(new Set(keys.map((value) => value.requestKey)).size).toBe(3);
  for (const value of keys) expect(value.requestKey).toMatch(/^[\x00-\x7f]*$/);
});
test("native bridge and seed reject lossy JSON before serialization", () => {
  const call = engine();
  expect(() => call("bridge", '{"method":"document.execute","request":{"value":1e999}}')).toThrow();
  const snapshot = JSON.stringify({ ...identity, revision: 0, data: { value: "MARKER" } }).replace(
    '"MARKER"',
    "1e999",
  );
  expect(() =>
    call(
      "seed",
      '{"protocol":3,"snapshot":' + snapshot + "}",
      identity.documentId,
      identity.schemaHash,
    ),
  ).toThrow();
  expect(() =>
    call("opening", '{"snapshot":' + snapshot + ',"lease":' + JSON.stringify(lease) + "}"),
  ).toThrow();
  const validSnapshot = JSON.stringify({ ...identity, revision: 0, data: {} });
  expect(() =>
    call("replace", validSnapshot, '{"value":1e999}', JSON.stringify(lease), "bad"),
  ).toThrow();
  const projection = JSON.stringify({
    $slop: { ...identity, format: 2, baseRevision: 0 },
    data: { value: "MARKER" },
  }).replace('"MARKER"', "1e999");
  expect(() => call("external", projection, validSnapshot, JSON.stringify(lease), "bad")).toThrow();
});

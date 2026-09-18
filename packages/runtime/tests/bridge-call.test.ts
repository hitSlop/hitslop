import { expect, test } from "bun:test";
import { createBridgeCall } from "../src/bridge-call.ts";

test("bridge calls validate parameters before sending and infer method results", async () => {
  const sent: unknown[] = [];
  const call = createBridgeCall(async (request) => {
    sent.push(request);
    return { ok: true, value: { sha256: "a".repeat(64), bytes: 1, mime: "image/png" } };
  });
  const result = await call("media.add", { data: "AA==", kind: "image" });
  expect(result.sha256).toBe("a".repeat(64));
  expect(sent).toEqual([{ method: "media.add", data: "AA==", kind: "image" }]);
  await expect(call("window.resize", { width: 0, height: 300 })).rejects.toThrow(
    "validation failed",
  );
  expect(sent).toHaveLength(1);
  if (false) {
    // @ts-expect-error parameters must match the selected method
    await call("document.open", { value: 1 });
    // @ts-expect-error result is a media descriptor, not a count
    const count: number = await call("media.add", {
      data: "AA==",
      kind: "image",
    });
    void count;
  }
});

test("bridge rejects malformed envelopes and mismatched successful results", async () => {
  for (const reply of [
    null,
    { ok: true },
    { ok: true, value: 4 },
    { ok: true, value: { revision: 4 } },
    { ok: false, error: { code: "invented", message: "bad" } },
  ]) {
    const call = createBridgeCall(async () => reply);
    await expect(call("media.add", { data: "AA==", kind: "image" })).rejects.toThrow(
      "validation failed",
    );
  }
});

test("bridge preserves structured native errors and valid nested JSON", async () => {
  const failed = createBridgeCall(async () => ({
    ok: false,
    error: { code: "storage_error", message: "Changed on disk" },
  }));
  await expect(failed("media.add", { data: "AA==", kind: "image" })).rejects.toMatchObject({
    code: "storage_error",
    message: "Changed on disk",
  });
  const call = createBridgeCall(async () => ({
    ok: true,
    value: {
      snapshot: {
        documentId: "doc",
        schemaHash: "schema",
        authority: "local",
        revision: 2,
        data: { tasks: [null, { extra: true }] },
      },
      lease: { id: "lease", expiresAt: 100 },
    },
  }));
  expect((await call("document.open", {})).snapshot.data).toEqual({
    tasks: [null, { extra: true }],
  });
});

test("command boundaries reject non-JSON values before sending", async () => {
  let sent = 0;
  const call = createBridgeCall(async () => {
    sent++;
    return { ok: true, value: { ok: true, revision: 1 } };
  });
  for (const value of [undefined, NaN, { nested: undefined }, new Date(), new Array(1)]) {
    await expect(
      call("document.execute", {
        request: {
          documentId: "doc",
          schemaHash: "schema",
          authority: "local",
          leaseId: "lease",
          requestId: "one",
          ops: [{ op: "set", path: [{ key: "value" }], value: value as never }],
        },
      }),
    ).rejects.toThrow();
  }
  expect(sent).toBe(0);
  await expect(
    createBridgeCall(async () => ({ ok: true, value: { snapshot: { revision: 0 } } }))(
      "document.open",
      {},
    ),
  ).rejects.toThrow();
});

test("runtime reports validate sources and message bounds before reaching the host", async () => {
  const requests: unknown[] = [];
  const call = createBridgeCall(async (request) => {
    requests.push(request);
    return { ok: true, value: null };
  });
  await call("runtime.reportError", { issue: { source: "render", message: "Could not render" } });
  await expect(
    call("runtime.reportError", { issue: { source: "document", message: "x".repeat(4097) } }),
  ).rejects.toThrow();
  expect(requests).toHaveLength(1);
});

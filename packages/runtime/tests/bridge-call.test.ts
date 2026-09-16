import { expect, test } from "bun:test";
import { createBridgeCall } from "../src/bridge-call.ts";

test("bridge calls validate parameters before sending and infer method results", async () => {
  const sent: unknown[] = [];
  const call = createBridgeCall(async (request) => {
    sent.push(request);
    return { ok: true, value: { revision: "r1" } };
  });
  const result = await call("media.write", { name: "hero", data: "AA==", mimeType: "image/png" });
  expect(result.revision).toBe("r1");
  expect(sent).toEqual([
    { method: "media.write", name: "hero", data: "AA==", mimeType: "image/png" },
  ]);
  await expect(call("window.resize", { width: 0, height: 300 })).rejects.toThrow(
    "validation failed",
  );
  expect(sent).toHaveLength(1);
  if (false) {
    // @ts-expect-error parameters must match the selected method
    await call("document.open", { value: 1 });
    // @ts-expect-error result is a revision object, not a count
    const count: number = await call("media.write", {
      name: "hero",
      data: "AA==",
      mimeType: "image/png",
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
    await expect(
      call("media.write", { name: "hero", data: "AA==", mimeType: "image/png" }),
    ).rejects.toThrow("validation failed");
  }
});

test("bridge preserves structured native errors and valid nested JSON", async () => {
  const failed = createBridgeCall(async () => ({
    ok: false,
    error: { code: "revision_conflict", message: "Changed on disk" },
  }));
  await expect(
    failed("media.write", { name: "hero", data: "AA==", mimeType: "image/png" }),
  ).rejects.toMatchObject({ code: "revision_conflict", message: "Changed on disk" });
  const call = createBridgeCall(async () => ({
    ok: true,
    value: {
      data: { tasks: [null, { extra: true }] },
      revision: "r2",
      publication: 1,
      dirty: false,
      error: null,
      projectionError: null,
    },
  }));
  expect((await call("document.open", {})).data).toEqual({ tasks: [null, { extra: true }] });
});

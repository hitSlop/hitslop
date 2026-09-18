import { expect, test } from "bun:test";
import { flush, registerFlush } from "../src/lifecycle.js";

test("flush awaits every adapter and host, then reports all failures", async () => {
  const previous = globalThis.window,
    finished: string[] = [];
  globalThis.window = {
    slop: {
      flush: async () => {
        finished.push("host");
        throw new Error("host failed");
      },
    },
  } as unknown as Window & typeof globalThis;
  const first = registerFlush("document", async () => {
    throw new Error("draft failed");
  });
  const second = registerFlush("media", async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    finished.push("media");
    throw new Error("write failed");
  });
  try {
    let failure: AggregateError | undefined;
    try {
      await flush();
    } catch (error) {
      failure = error as AggregateError;
    }
    expect(finished).toEqual(["media", "host"]);
    expect(failure?.errors).toHaveLength(3);
    expect(failure?.message).toContain("document");
    expect(failure?.message).toContain("media");
  } finally {
    first();
    second();
    globalThis.window = previous;
  }
});

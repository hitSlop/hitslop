import { describe, expect, test } from "bun:test";

describe("deployed function metadata", () => {
  test("recordCreation is deployed as a callable function", async () => {
    process.env.FIREBASE_CONFIG = JSON.stringify({
      projectId: "hitslopapp",
      storageBucket: "hitslopapp.firebasestorage.app",
    });
    const { recordCreation, recordCreationOptions } = await import("../src/index.js");
    expect(recordCreation.__endpoint.callableTrigger).toBeDefined();
    expect(recordCreation.__endpoint.platform).toBe("gcfv2");
    expect(recordCreationOptions).toEqual({ invoker: "public", enforceAppCheck: true });
  });
});

import { expect, test } from "bun:test";
import { runNativeCandidates } from "../src/native.ts";

test("native discovery skips missing helpers but not failed commands", async () => {
  await expect(runNativeCandidates(["/nonexistent/hitslop-native", process.execPath], ["--eval", "process.exit(0)"])).resolves.toBeUndefined();
  await expect(runNativeCandidates([process.execPath, "/nonexistent/never-retry"], ["--eval", "process.exit(7)"])).rejects.toThrow("status 7");
});

test("explicit helper failures never fall back", async () => {
  await expect(runNativeCandidates(["/nonexistent/hitslop-native", process.execPath], ["--eval", "process.exit(0)"], true)).rejects.toThrow("Could not launch");
});

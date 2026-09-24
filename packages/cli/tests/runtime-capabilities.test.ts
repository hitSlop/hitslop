import { expect, test } from "bun:test";
import { supportsRuntime } from "../src/runtime-capabilities";

const runtime = {
  runtimeContract: 1,
  runtimeRevision: 3,
  sdkVersion: "9.0.0",
  loroVersion: "8.0.0",
  protocolVersion: 1,
};
test("runtime selection checks contract and minimum revision, not provenance", () => {
  const capabilities = { current: runtime, runtimes: [runtime] };
  expect(supportsRuntime(capabilities, 1, 1)).toBe(true);
  expect(supportsRuntime(capabilities, 1, 3)).toBe(true);
  expect(supportsRuntime(capabilities, 1, 4)).toBe(false);
  expect(supportsRuntime(capabilities, 2, 1)).toBe(false);
  for (const invalid of [
    null,
    runtime,
    {},
    { current: runtime, runtimes: [] },
    { current: runtime, runtimes: [{ ...runtime, runtimeRevision: true }] },
  ]) {
    expect(supportsRuntime(invalid, 1, 1)).toBe(false);
  }
});

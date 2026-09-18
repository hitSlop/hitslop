import { rm } from "node:fs/promises";
import { buildWrapperFixture } from "./build-wrapper-fixture.ts";
import { resolve } from "node:path";
import { buildSlop } from "../packages/cli/src/project.ts";
import { validateRuntimePackage } from "../packages/cli/src/runtime-package.ts";

if (process.platform !== "darwin") throw new Error("Native runtime checks require macOS");
const root = resolve(import.meta.dir, "..");
const packages: Record<string, string> = {};
for (const [slug, variable] of [["quick-checklist", "HITSLOP_PILOT_PACKAGE"]] as const) {
  const { directory } = await buildSlop(resolve(root, "examples/slops", slug));
  await validateRuntimePackage(directory, { template: true });
  packages[variable] = resolve(directory);
}

const wrapper = await buildWrapperFixture();
packages.HITSLOP_WRAPPER_PACKAGE = wrapper.directory;

// Always supply the built pilot package: routine CI/local checks must not silently
// skip the real Svelte/WebKit tests. Bare `swift test` remains useful for unit work.
const child = Bun.spawn(
  ["swift", "test", "--no-parallel", "--package-path", "apps/apple/Packages/HitSlopApple"],
  {
    cwd: root,
    env: { ...process.env, ...packages },
    stdout: "inherit",
    stderr: "inherit",
  },
);
try {
  if ((await child.exited) !== 0) throw new Error("Native runtime checks failed");
} finally {
  await rm(wrapper.parent, { recursive: true, force: true });
}

import { afterEach, expect, test } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readThemeCSS } from "../src/theme.ts";
import { evaluateModule } from "../src/evaluate-module.ts";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

test("theme evaluation reloads transitive edits and recovers after errors", async () => {
  const root = await mkdtemp(join(tmpdir(), "hitslop-theme-")); roots.push(root);
  await writeFile(join(root, "theme.ts"), 'import color from "./color"; export default { css: `:root { --slop-ink: ${color}; }` };');
  await writeFile(join(root, "color.ts"), 'export default "red";');
  expect(await readThemeCSS(root)).toContain("red");
  await writeFile(join(root, "color.ts"), 'export default "blue";');
  expect(await readThemeCSS(root)).toContain("blue");
  await writeFile(join(root, "color.ts"), 'export default "red"; throw new Error("broken theme");');
  await expect(readThemeCSS(root)).rejects.toThrow("broken theme");
  await writeFile(join(root, "color.ts"), 'export default "green";');
  expect(await readThemeCSS(root)).toContain("green");
  await writeFile(join(root, "theme.ts"), "export default {};");
  await expect(readThemeCSS(root)).rejects.toThrow("defineTheme");
  await writeFile(join(root, "theme.ts"), "while (true) {}");
  await expect(evaluateModule(join(root, "theme.ts"), "theme", 200)).rejects.toThrow("timed out");
});

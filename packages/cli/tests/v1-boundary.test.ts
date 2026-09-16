import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zipSync } from "fflate";
import { inspectZip } from "@hitslop/schema";
import { scaffold, validateAuthoringProject } from "../src/project.ts";

test("v1 authoring rejects missing or invalid defaults before building", async () => {
  const root = await mkdtemp(join(tmpdir(), "v1-initial-"));
  try {
    const app = join(root, "counter");
    await scaffold(app, { author: { name: "Test" } });
    // Resolve dependencies from the fixture without installing a second tree.
    await writeFile(
      join(app, "schema.ts"),
      `import * as S from ${JSON.stringify(import.meta.resolve("@hitslop/schema/document"))}; export default S.Document({ count: S.Number() });`,
    );
    await rm(join(app, "theme.ts"));
    await writeFile(join(app, "initial.ts"), "export default { count: 'wrong' };");
    await expect(validateAuthoringProject(app)).rejects.toThrow("validation failed");
    await rm(join(app, "initial.ts"));
    await expect(validateAuthoringProject(app)).rejects.toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("ZIP policy rejects expansion bombs and inconsistent headers before decoding", () => {
  const valid = zipSync({ "photo.txt": new Uint8Array([1, 2, 3]) });
  expect(() => inspectZip(valid)).not.toThrow();
  const bomb = valid.slice();
  const view = new DataView(bomb.buffer);
  let central = -1;
  for (let i = 0; i + 46 <= bomb.length; i++)
    if (view.getUint32(i, true) === 0x02014b50) {
      central = i;
      break;
    }
  expect(central).toBeGreaterThan(0);
  view.setUint32(central + 24, 26 * 1024 * 1024, true);
  expect(() => inspectZip(bomb)).toThrow("too large");
  const mismatch = valid.slice();
  new DataView(mismatch.buffer).setUint16(8, 99, true);
  expect(() => inspectZip(mismatch)).toThrow("inconsistent ZIP headers");
});

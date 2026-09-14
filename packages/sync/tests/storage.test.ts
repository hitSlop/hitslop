import { test, expect } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import fixture from "../../schema/tests/fixtures/sync-transaction.json";
import { FileDocumentIO } from "../src/storage";
test("Node journal matches the native byte transaction fixture", async () => {
  const root = await mkdtemp(join(tmpdir(), "slop-shared-journal-"));
  try {
    const io = await FileDocumentIO.at(root);
    expect((await io.open()).generation).toBe(fixture.commit.expectedGeneration);
    const result = await io.commit(fixture.commit);
    expect(result.generation).toBe(fixture.generation);
    expect(result.externalHash).toBe(fixture.externalHash);
    await expect(io.commit(fixture.commit)).rejects.toMatchObject({code:"revision_conflict"});
  } finally { await rm(root, { recursive: true, force: true }); }
});

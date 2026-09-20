import { strict as assert } from "node:assert";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Document } from "../../packages/document/src/document";
import { SQLiteStore } from "../../packages/document/src/sqlite";
import { checklist } from "../../examples/slops/quick-checklist/schema";
import initial from "../../examples/slops/quick-checklist/initial";
const folder = await mkdtemp(join(tmpdir(), "hsl-v1-crash-")),
  results: string[] = [];
try {
  for (const phase of [
    "hold",
    "append:uncommitted",
    "append:committed",
    "checkpoint:uncommitted",
    "checkpoint:committed",
  ]) {
    const root = join(folder, phase.replace(":", "-"));
    await mkdir(root);
    const seed = await Document.open(checklist, await SQLiteStore.open(root), initial);
    seed.text(checklist.fields.title).replace("Acknowledged");
    await seed.flush();
    await seed.close();
    const marker = join(root, "paused");
    const child = Bun.spawn(
      [process.execPath, "scripts/v1/storage-child.ts", root, phase, marker],
      { stdout: "inherit", stderr: "inherit" },
    );
    try {
      const deadline = Date.now() + 10000;
      while (true) {
        try {
          await readFile(marker);
          break;
        } catch {}
        if (Date.now() > deadline || child.exitCode !== null)
          throw new Error(`Child failed to reach ${phase}`);
        await Bun.sleep(20);
      }
      await assert.rejects(() => SQLiteStore.open(root), /live writer/);
    } finally {
      child.kill("SIGKILL");
      await child.exited;
    }
    const io = await SQLiteStore.open(root),
      disk = await io.load();
    const reopened = await Document.open(checklist, io, initial);
    assert.equal(
      reopened.current.title,
      phase === "append:committed" ? "Crash edit" : "Acknowledged",
    );
    if (phase === "checkpoint:committed") assert.equal(disk.updates.length, 0);
    if (phase === "checkpoint:uncommitted") assert.ok(disk.updates.length > 0);
    await reopened.close();
    results.push(phase);
    console.log(`PASS ${phase}: crash recovery and writer exclusion`);
  }
  await mkdir(".hitslop/v1-evidence", { recursive: true });
  await writeFile(
    ".hitslop/v1-evidence/storage-v1.json",
    JSON.stringify({ passed: true, cases: results }, null, 2) + "\n",
  );
} finally {
  await rm(folder, { recursive: true, force: true });
}

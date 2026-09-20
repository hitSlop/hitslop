import { strict as assert } from "node:assert";
import { mkdtemp, mkdir, writeFile, readFile, rm, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Document } from "../../packages/document/src/document";
import { SQLiteStore } from "../../packages/document/src/sqlite";
import { MemoryStore } from "../../packages/document/src/memory";
import { schemaKey } from "../../packages/document/src/schema";
import { checklist } from "../../examples/slops/quick-checklist/schema";
import initial from "../../examples/slops/quick-checklist/initial";
const binary = resolve("apps/apple/Packages/HitSlopApple/.build/debug/hitslop-native");
const folder = await mkdtemp(join(tmpdir(), "hsl-native-crash-")),
  cases: string[] = [];
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
    const doc = await Document.open(checklist, await SQLiteStore.open(root), initial);
    doc.fields.title.replace("Acknowledged");
    await doc.flush();
    const snapshot = doc.exportSnapshot();
    await doc.close();
    const memory = new MemoryStore();
    await memory.checkpoint("0", snapshot, schemaKey(checklist.descriptor));
    const staged = await Document.open(checklist, memory, initial),
      from = staged.version();
    staged.fields.title.replace("Crash edit");
    const bytes = phase.startsWith("append:") ? staged.exportUpdates(from) : snapshot;
    await staged.close();
    const payload = join(folder, "payload.bin"),
      marker = join(root, "paused");
    await writeFile(payload, bytes);
    const child = Bun.spawn([binary, "storage-probe", root, phase, marker, payload], {
      stdout: "ignore",
      stderr: "inherit",
    });
    try {
      const deadline = Date.now() + 10000;
      while (!(await Bun.file(marker).exists())) {
        if (Date.now() > deadline || child.exitCode !== null)
          throw new Error(`Probe failed: ${phase}`);
        await Bun.sleep(20);
      }
      await assert.rejects(() => SQLiteStore.open(root), /live writer/);
    } finally {
      child.kill("SIGKILL");
      await child.exited;
    }
    const io = await SQLiteStore.open(root),
      disk = await io.load();
    const restored = await Document.open(checklist, io, initial);
    assert.equal(
      restored.current.title,
      phase === "append:committed" ? "Crash edit" : "Acknowledged",
    );
    if (phase === "checkpoint:committed") assert.equal(disk.updates.length, 0);
    if (phase === "checkpoint:uncommitted") assert.ok(disk.updates.length > 0);
    await restored.close();
    cases.push(phase);
    console.log(`PASS native ${phase}`);
  }
  // The real host owns a WebView and socket; acknowledge through CLI, then kill it.
  const root = join(folder, "Host.slop");
  await cp(
    "generated/v1/templates/Checklist.slop",
    root,
    { recursive: true },
  );
  const app = process.env.HITSLOP_APP_BINARY ?? resolve("generated/v1/app/hitSlop.app/Contents/MacOS/hitSlop");
  const host = Bun.spawn([app, root], {
    stdout: "ignore",
    stderr: "ignore",
  });
  try {
    const deadline = Date.now() + 15000;
    while (!(await Bun.file(join(root, "state/host.lock")).exists())) {
      if (Date.now() > deadline || host.exitCode !== null)
        throw new Error("Native host startup failed");
      await Bun.sleep(30);
    }
    const child = Bun.spawn(
      [
        process.execPath,
        "packages/cli/src/cli.ts",
        "apply",
        root,
        "--op",
        JSON.stringify({ type: "text.replace", path: ["title"], value: "Native acknowledged" }),
      ],
      { stdout: "pipe", stderr: "pipe", env: { ...process.env, HITSLOP_NATIVE_CLI: binary } },
    );
    const [out, error, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    assert.equal(code, 0, error);
    assert.equal(JSON.parse(out).title, "Native acknowledged");
  } finally {
    host.kill("SIGKILL");
    await host.exited;
  }
  const reopened = await Document.open(checklist, await SQLiteStore.open(root), initial);
  assert.equal(reopened.current.title, "Native acknowledged");
  await reopened.close();
  cases.push("WebView host death after CLI acknowledgement");
  await mkdir(".hitslop/v1-evidence", { recursive: true });
  await writeFile(
    ".hitslop/v1-evidence/native-crash.json",
    JSON.stringify({ passed: true, cases }, null, 2),
  );
} finally {
  await rm(folder, { recursive: true, force: true });
}

// Guards false-green replay: wrong expected data, broken authored handles, and rewritten release history.
import { test, expect } from "bun:test";
import { cp, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildRuntime } from "../../../scripts/v1/runtime";
import { runRuntime } from "../../../scripts/v1/compatibility";
import { checkHistory } from "../../../scripts/v1/compatibility-history";

test("compiled replay detects incorrect expectations and a no-op authored text handle", async () => {
  const root = await mkdtemp(join(tmpdir(), "hitslop-replay-fault-"));
  try {
    const runtimes = join(root, "runtimes");
    await buildRuntime([runtimes]);
    const document = join(root, "Document.slop");
    await cp("tests/compatibility/1-1/document", document, { recursive: true });
    const expected = await Bun.file("tests/compatibility/1-1/expected.json").json();
    const wrong = join(root, "wrong.json");
    await writeFile(wrong, JSON.stringify({ ...expected, title: "Wrong saved state" }));
    await expect(runRuntime(join(runtimes, "1"), document, wrong)).rejects.toThrow(
      `Document ${document}, read: AssertionError`,
    );
    // The same process must release ownership after a failed assertion.
    const good = await runRuntime(
      join(runtimes, "1"),
      document,
      "tests/compatibility/1-1/expected.json",
    );
    expect(good.state).toEqual(expected);
    // Mutate only a disposable compiled runtime; seals must never be regenerated.
    const runtime = join(root, "mutant");
    await cp(join(runtimes, "1"), runtime, { recursive: true });
    await cp(join(runtime, "index.js"), join(runtime, "implementation.js"));
    await writeFile(
      join(runtime, "index.js"),
      `
      export * from './implementation.js';
      import {Document} from './implementation.js';
      const open = Document.open;
      Document.open = async function(...args) {
        const doc = await open.apply(this, args);
        doc.fields = {...doc.fields, title: {...doc.fields.title, replace() {}}};
        return doc;
      };
    `,
    );
    await expect(
      runRuntime(
        runtime,
        document,
        "tests/compatibility/1-1/expected.json",
        "tests/compatibility/1-1/scenario.json",
      ),
    ).rejects.toThrow("AssertionError");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 60_000);

test("committed fixture and release rewrites fail against an independent base commit", async () => {
  const root = await mkdtemp(join(tmpdir(), "hitslop-history-fault-"));
  async function git(...args: string[]) {
    const child = Bun.spawn(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
    const [out, error, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect(code, error).toBe(0);
    return out.trim();
  }
  try {
    await git("init");
    await mkdir(join(root, "runtimes"));
    await mkdir(join(root, "tests/compatibility/example/document"), { recursive: true });
    const records = [{ runtimeContract: 1, runtimeRevision: 1, sha256: "a".repeat(64) }];
    await writeFile(join(root, "runtimes/releases.json"), JSON.stringify(records));
    await writeFile(join(root, "tests/compatibility/example/document/app.html"), "Original app");
    await git("add", ".");
    await git(
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "-m",
      "baseline",
    );
    const base = await git("rev-parse", "HEAD");
    await checkHistory(root, base);
    await writeFile(join(root, "runtimes/releases.json"), "[]");
    await git("add", ".");
    await git(
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "-m",
      "rewrite release",
    );
    await expect(checkHistory(root, base)).rejects.toThrow("Published runtime record changed");
    await writeFile(join(root, "runtimes/releases.json"), JSON.stringify(records));
    await writeFile(join(root, "tests/compatibility/example/document/app.html"), "Rebuilt app");
    await expect(checkHistory(root, base)).rejects.toThrow("Preserved fixture changed");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

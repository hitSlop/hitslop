/** Opt-in behavioral fault checks for pruning. Only disposable source copies are mutated. */
import { cp, mkdir, mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { strict as assert } from "node:assert";
const root = await mkdtemp(join(process.cwd(), ".v1-build-test-sensitivity-"));
const cases = [
  {
    name: "text-handle-noop",
    file: "handles.ts",
    before:
      'replace: (value: string) => void run({ type: "text.replace", path: frozenPath, value }),',
    after: "replace: (_value: string) => {},",
    fails: "handles retain identity across moves and reject a remote deletion and document close",
  },
  {
    name: "text-splice-noop",
    file: "handles.ts",
    before:
      'void run({ type: "text.splice", path: frozenPath, index, delete: deleteCount, insert })',
    after: "undefined",
    fails: "text binding respects code points",
  },
  {
    name: "drop-previews-on-flush",
    file: "document.ts",
    before: "if (!this.previews.size || this.closed) return;",
    after: "return;",
    fails: "previews > previews are visible, not persisted, and commit once at set or flush",
  },
  {
    name: "replace-collection-identity",
    file: "operations.ts",
    before: 'reject("assign would recreate row identity; use insert, remove and move");',
    after: "return;",
    fails: "optional row lists and trees initialize",
  },
];
const results = [];
try {
  for (const fault of cases) {
    const copy = join(root, fault.name);
    await cp("packages/document/src", join(copy, "src"), { recursive: true });
    await cp("packages/document/tests", join(copy, "tests"), { recursive: true });
    const file = join(copy, "src", fault.file),
      original = await readFile(file, "utf8");
    assert(original.includes(fault.before), `Fault insertion point changed: ${fault.name}`);
    await writeFile(file, original.replace(fault.before, fault.after));
    const child = Bun.spawn(
      [
        process.execPath,
        "test",
        ...["bindings", "handles", "storage", "vocabulary"].map((name) =>
          join(copy, "tests", `${name}.test.ts`),
        ),
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    const [out, error, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    const log = out + error;
    assert(
      code !== 0 && log.includes(`(fail) ${fault.fails}`),
      `${fault.name} was not caught by its behavior test:\n${log}`,
    );
    results.push({ fault: fault.name, caughtBy: fault.fails });
    console.log(`PASS sensitivity: ${fault.name}`);
  }
  await mkdir(".hitslop/v1-evidence", { recursive: true });
  await writeFile(
    ".hitslop/v1-evidence/test-sensitivity.json",
    JSON.stringify(results, null, 2) + "\n",
  );
} finally {
  await rm(root, { recursive: true, force: true });
}

import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
const app = resolve(process.argv[2] ?? "generated/v1/app/hitSlop.app");
const helper = join(app, "Contents/Helpers/hitslop-native");
const runtimes = [
  ...new Bun.Glob("**/runtime/headless.js").scanSync({ cwd: app, onlyFiles: true }),
].map((p) => dirname(join(app, p)));
assert.ok(runtimes.length >= 2, "Host and installed helper must both bundle their runtime");
async function digest(root: string, prefix = ""): Promise<string> {
  const hash = createHash("sha256");
  for (const name of (await readdir(join(root, prefix))).sort()) {
    const path = join(prefix, name);
    const file = Bun.file(join(root, path));
    const stat = await import("node:fs/promises").then((fs) => fs.stat(join(root, path)));
    hash.update(path);
    hash.update(
      stat.isDirectory() ? await digest(root, path) : Buffer.from(await file.arrayBuffer()),
    );
  }
  return hash.digest("hex");
}
const hashes = await Promise.all(runtimes.map((root) => digest(root)));
assert.equal(new Set(hashes).size, 1, "Host/helper SDK and WASM resources differ");
const folder = await mkdtemp(join(tmpdir(), "hitslop-release-verify-"));
try {
  const run = async (args: string[]) => {
    const child = Bun.spawn([helper, ...args], {
      cwd: folder,
      env: { HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, PATH: "/usr/bin:/bin" },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [out, error, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    assert.equal(code, 0, error);
    return out;
  };
  for (const slug of ["quick-checklist", "small-expenses"]) {
    const source = join(app, "Contents/Resources/StarterTemplates", slug + ".slop");
    const entries = await readdir(source);
    assert.ok(!entries.includes("state") && !entries.includes("stores"));
    assert.equal(
      JSON.parse(await readFile(join(source, "manifest.json"), "utf8")).runtime,
      "hitslop-v1",
    );
    const document = join(folder, slug + ".slop");
    await run(["create", "--from", source, "--output", document]);
    const initial = JSON.parse(await run(["get", document]));
    assert.ok(initial && typeof initial === "object");
    await run([
      "apply",
      document,
      "--op",
      JSON.stringify({ type: "text.replace", path: ["title"], value: "Installed helper verified" }),
    ]);
    assert.equal(JSON.parse(await run(["get", document])).title, "Installed helper verified");
    for (const format of ["png", "pdf"]) {
      const output = join(folder, slug + "." + format);
      await run(["export", document, "--format", format, "--output", output]);
      assert.ok((await readFile(output)).length > 100);
    }
  }
  console.log(
    "PASS packaged starters, matching runtimes, installed editing and export without Bun/Node",
  );
} finally {
  await rm(folder, { recursive: true, force: true });
}

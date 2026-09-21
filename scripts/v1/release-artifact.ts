import {
  verifyCopies,
  verifyCurrentRuntime,
  runtimeDestinations,
  verifyReleasedIdentities,
} from "./runtime-artifacts";
import { strict as assert } from "node:assert";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
const app = resolve(process.argv[2] ?? "generated/v1/app/hitSlop.app");
const helper = join(app, "Contents/Helpers/hitslop-native");
const roots = [
  ...new Bun.Glob("**/runtimes/*/headless.js").scanSync({ cwd: app, onlyFiles: true }),
].map((p) => dirname(dirname(join(app, p))));
const catalogs = [...new Set(roots)];
assert.ok(catalogs.length >= 2, "Host and helper must both bundle runtimes");
assert.ok(
  catalogs.some((root) => root.startsWith(join(app, "Contents/Resources") + "/")),
  "Missing app runtime catalog",
);
assert.ok(
  catalogs.some((root) => root.startsWith(join(app, "Contents/Helpers") + "/")),
  "Missing helper runtime catalog",
);
const installedCatalog = await verifyCopies([...catalogs, runtimeDestinations[0]!]);
verifyCurrentRuntime(installedCatalog);
await verifyReleasedIdentities(installedCatalog);
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
  const capabilities = JSON.parse(await run(["runtime-info"]));
  const identities = Object.values(installedCatalog)
    .map((value) => value.identity)
    .sort((a, b) => a.runtimeContract - b.runtimeContract);
  assert.deepEqual(capabilities, { current: identities.at(-1), runtimes: identities });
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

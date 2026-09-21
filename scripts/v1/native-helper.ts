import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import identity from "../../packages/document/src/runtime-identity.json";
import { strict as assert } from "node:assert";

const folder = await mkdtemp(join(tmpdir(), "hitslop-relocated-helper-"));
try {
  const helpers = join(folder, "hitSlop.app/Contents/Helpers");
  await mkdir(helpers, { recursive: true });
  const build = resolve("apps/apple/Packages/HitSlopApple/.build/debug");
  for (const name of ["hitslop-native", "HitSlopApple_HitSlopRuntime.bundle", "HitSlopApple_HitSlopWasm.bundle"])
    await cp(join(build, name), join(helpers, name), { recursive: true });
  const document = join(folder, "List.slop");
  await cp("generated/v1/templates/Checklist.slop", document, { recursive: true });
  const run = async (args: string[], success = true) => {
    const child = Bun.spawn([join(helpers, "hitslop-native"), ...args], {
      cwd: folder,
      env: { HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, PATH: "/usr/bin:/bin" },
      stdout: "pipe", stderr: "pipe",
    });
    const [out, error, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    if (success) assert.equal(code, 0, error);
    else {
      assert.notEqual(code, 0, "Missing relocated runtime unexpectedly fell back to checkout resources");
      assert.ok(error.includes("Relocated runtime marker"), error);
    }
    return out;
  };
  await run(["get", document]);
  await run(["apply", document, "--op", JSON.stringify({ type: "text.replace", path: ["title"], value: "Relocated native edit" })]);
  assert.equal(JSON.parse(await run(["get", document])).title, "Relocated native edit");
  for (const format of ["png", "pdf"]) {
    const output = join(folder, "export." + format);
    await run(["export", document, "--format", format, "--output", output]);
    const bytes = await readFile(output);
    assert.ok(bytes.length > 100);
    assert.equal(bytes.subarray(0, format === "png" ? 8 : 4).toString("hex"), format === "png" ? "89504e470d0a1a0a" : "25504446");
  }
  // A broken relocated resource must fail even while valid checkout resources exist.
  const bundle = join(helpers, "HitSlopApple_HitSlopWasm.bundle");
  const runtime = [join(bundle, `runtimes/${identity.runtimeContract}/headless.js`), join(bundle, `Contents/Resources/runtimes/${identity.runtimeContract}/headless.js`)];
  const headless = (await Promise.all(runtime.map(async path => await Bun.file(path).exists() ? path : undefined))).find(Boolean);
  assert.ok(headless, "Missing embedded runtime");
  await writeFile(headless, "webkit.messageHandlers.storage.postMessage({method:'failed',error:'Relocated runtime marker'});");
  await run(["get", document], false);
  console.log("PASS relocated helper: closed editing, PNG/PDF export, no Bun, no checkout runtime fallback");
} finally { await rm(folder, { recursive: true, force: true }); }

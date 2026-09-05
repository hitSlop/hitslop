import { afterEach, expect, test } from "bun:test";
import { loadDataSchema } from "../src/data-schema.ts";
import { dataSchemaFromJSON } from "@hitslop/schema";
import checklistSchema from "../../../examples/slops/quick-checklist/schema.ts";

test("root TypeBox schema is exported directly as portable JSON Schema", async () => {
  const schema = await loadDataSchema(new URL("../../../examples/slops/quick-checklist/schema.ts", import.meta.url).pathname);
  expect(schema).toEqual(dataSchemaFromJSON(checklistSchema));
  expect(schema.type).toBe("object");
  expect(schema.required).toEqual(["title", "tasks"]);
  expect(JSON.stringify(schema)).not.toContain("~standard");
});

const temporary: string[] = [];
afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

test("packaging reevaluates transitive imports and recovers after invalid edits", async () => {
  const { mkdtemp, writeFile, rm, readdir } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const root = await mkdtemp(join(tmpdir(), "hitslop-direct-schema-"));
  temporary.push(root);
  const schema = join(root, "schema.ts"), field = join(root, "field.ts");
  await writeFile(schema, 'import field from "./field"; export default { type: "object", properties: { field }, required: ["field"] };');
  await writeFile(field, 'export default { type: "string" };');
  expect((await loadDataSchema(schema)).properties).toEqual({ field: { type: "string" } });
  await writeFile(field, 'export default { type: "number" };');
  expect((await loadDataSchema(schema)).properties).toEqual({ field: { type: "number" } });
  await writeFile(field, 'export default { type: "invalid" };');
  await expect(loadDataSchema(schema)).rejects.toThrow();
  await rm(field);
  await expect(loadDataSchema(schema)).rejects.toThrow("Could not evaluate");
  await writeFile(field, 'export default { type: "boolean" };');
  expect((await loadDataSchema(schema)).properties).toEqual({ field: { type: "boolean" } });
  expect(await readdir(root)).not.toContain(".hitslop");
});

async function fixture(source: string) {
  const { mkdtemp, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const root = await mkdtemp(join(tmpdir(), "hitslop schema 'quotes'-"));
  temporary.push(root);
  const path = join(root, 'schema "quoted".ts');
  await writeFile(path, source);
  return { root, path };
}

test("schema logs and old markers cannot corrupt IPC results", async () => {
  const { path } = await fixture('console.log("\\nHITSLOP_SCHEMA_RESULT:not-json"); console.error("schema diagnostic"); export default { type: "string" };');
  expect((await loadDataSchema(path)).type).toBe("string");
});

test("loader reports errors, missing results, and malformed IPC", async () => {
  for (const [source, detail] of [
    ['throw new Error("broken import");', "broken import"],
    ['export default { bad() {} };', "plain JSON"],
    ['export const named = {};', "plain JSON"],
    ['process.exit(0);', "without a result"],
    ['process.exit(7);', "status 7"],
    ['process.send({ nonsense: true }); await new Promise(() => {});', "Invalid loader response"],
  ]) {
    const { path } = await fixture(source!);
    await expect(loadDataSchema(path)).rejects.toThrow(detail!);
  }
});

test("deadline and successful results both reap schema processes", async () => {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  for (const hangs of [false, true]) {
    const { root, path } = await fixture(`
      import { writeFileSync } from "node:fs";
      import { dirname, join } from "node:path";
      writeFileSync(join(dirname(process.argv[2]), "pid"), String(process.pid));
      process.on("SIGTERM", () => {});
      setInterval(() => {}, 1000);
      ${hangs ? "while (true) {}" : 'export default { type: "string" };'}
    `);
    if (hangs) await expect(loadDataSchema(path, 1000)).rejects.toThrow("timed out after 1000ms");
    else expect((await loadDataSchema(path)).type).toBe("string");
    const pid = Number(await readFile(join(root, "pid"), "utf8"));
    expect(() => process.kill(pid, 0)).toThrow();
  }
});

test("distributed CLI resolves its sibling loader without source files", async () => {
  const { mkdtemp, writeFile, readdir } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const { join } = await import("node:path");
  const cliRoot = fileURLToPath(new URL("../", import.meta.url));
  const output = await mkdtemp(join(cliRoot, ".loader-dist-test-"));
  temporary.push(output);
  const build = await Bun.build({
    entrypoints: [join(cliRoot, "src/cli.ts"), join(cliRoot, "src/schema-loader.ts")],
    target: "bun", format: "esm", packages: "external", outdir: output,
  });
  expect(build.success).toBe(true);
  expect((await readdir(output)).sort()).toEqual(["cli.js", "schema-loader.js"]);
  const { root } = await fixture("");
  await writeFile(join(root, "schema.ts"), 'export default { type: "object" };');
  await writeFile(join(root, "manifest.json"), JSON.stringify({
    $schema: "https://api.hitslop.com/schemas/v1/manifest.schema.json",
    author: { name: "Test" }, slug: "loader-test", title: "Loader test",
    description: "A schema loading fixture", categories: ["utilities"],
    presentation: { width: 480, height: 620, shape: "rounded" },
  }));
  const child = Bun.spawn([process.execPath, join(output, "cli.js"), "validate", root], {
    cwd: root, stdout: "pipe", stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
  ]);
  expect(stderr).toBe("");
  expect(code).toBe(0);
  expect(stdout).toContain("valid");
}, 15_000);

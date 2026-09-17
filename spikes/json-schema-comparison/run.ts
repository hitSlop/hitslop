import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import checklistSchema from "../../examples/slops/quick-checklist/schema.ts";
import checklistInitial from "../../examples/slops/quick-checklist/initial.ts";
import { dataSchemaFromJSON } from "../../packages/schema/src/data.ts";

const folder = dirname(fileURLToPath(import.meta.url));
const root = resolve(folder, "../..");
const label = process.argv[2] ?? "latest";
if (!/^[a-z0-9-]+$/.test(label)) throw new Error("Run label must contain lowercase letters, digits, or hyphens");
const provenance: { path: string; sha256: string }[] = [];
async function readJSON(path: string) {
  const bytes = await readFile(resolve(root, path));
  provenance.push({ path, sha256: createHash("sha256").update(bytes).digest("hex") });
  return JSON.parse(bytes.toString());
}
type Case = { name: string; json: string; valid: boolean };
type Group = { name: string; schema: string; formats: boolean; schemaValid: boolean; cases: Case[] };
const json = JSON.stringify;
const item = (name: string, value: unknown, valid: boolean): Case => ({ name, json: json(value), valid });
const groups: Group[] = [];
const shared = await readJSON("apps/apple/Packages/HitSlopApple/Tests/HitSlopRuntimeTests/Fixtures/data-conformance.json");
for (const fixture of shared) {
  groups.push({ name: fixture.name, schema: json(fixture.schema), formats: true, schemaValid: true,
    cases: fixture.cases.map((value: any, index: number) => item(`case-${index + 1}`, value.value, value.valid)) });
}
const manifestSchema = await readJSON("apps/apple/Packages/HitSlopApple/Sources/HitSlopCore/Resources/manifest.schema.json");
const manifest = await readJSON("examples/slops/quick-checklist/manifest.json");
const bridgeSchema = await readJSON("apps/apple/Packages/HitSlopApple/Sources/HitSlopRuntime/Resources/bridge-request.schema.json");
// Use source schema exports, never copy an authored checklist schema into the spike.
const checklist = dataSchemaFromJSON(checklistSchema);
for (const path of ["examples/slops/quick-checklist/schema.ts", "examples/slops/quick-checklist/initial.ts",
  "packages/schema/src/document.ts", "packages/schema/src/data.ts",
  "apps/apple/Packages/HitSlopApple/Sources/HitSlopCore/SlopJSONValidation.swift"]) {
  provenance.push({ path, sha256: createHash("sha256").update(await readFile(resolve(root, path))).digest("hex") });
}
const { author: _author, ...missingAuthor } = manifest;
const bridge = { method: "document.apply", session: "spike", sequence: 1, base: "revision",
  after: { list: [null, true, 3, { future: "keep" }] } };
const invalidBridge = { ...bridge, sequence: "1" };
const invalidManifest = { ...manifest, presentation: { ...manifest.presentation, width: 1 } };
groups.push(
  { name: "manifest", schema: json(manifestSchema), formats: true, schemaValid: true, cases: [
    item("actual", manifest, true), item("missing-author", missingAuthor, false),
    item("invalid-width", invalidManifest, false), item("extra-property", { ...manifest, future: true }, false),
    item("invalid-author-uri", { ...manifest, author: { name: "Author", url: "https://example.com/with space" } }, false),
  ] },
  { name: "bridge", schema: json(bridgeSchema), formats: false, schemaValid: true, cases: [
    item("document-apply", bridge, true), item("wrong-sequence-type", invalidBridge, false),
    item("media-open", { method: "media.open", name: "hero-image" }, true),
    item("unknown-method", { method: "unknown" }, false),
    item("extra-property", { method: "host.info", extra: true }, false),
    item("invalid-window-size", { method: "window.resize", width: 1, height: 300 }, false),
  ] },
  { name: "checklist", schema: json(checklist), formats: true, schemaValid: true, cases: [
    item("actual-initial", checklistInitial, true),
    item("unknown-fields", { ...checklistInitial, future: { keep: true }, tasks: checklistInitial.tasks.map(t => ({ ...t, future: [1, null] })) }, true),
    item("missing-title", { tasks: [] }, false), item("wrong-title-type", { ...checklistInitial, title: 42 }, false),
    item("wrong-nested-type", { ...checklistInitial, tasks: [{ ...checklistInitial.tasks[0], done: "false" }] }, false),
    { name: "malformed-json", json: '{"title":', valid: false },
  ] },
  { name: "bridge-format-policy", schema: json({ type: "string", format: "uri" }), formats: false, schemaValid: true,
    cases: [item("formats-are-annotations", "not a uri", true)] },
);
for (const [name, schema] of [
  ["invalid-type", '{"type":"bogus"}'], ["invalid-minLength", '{"type":"string","minLength":"wrong"}'],
  ["invalid-schema-array", "[]"], ["malformed-schema-json", '{"type":'],
] as const) groups.push({ name, schema, formats: true, schemaValid: false, cases: [] });

const benchmarks = [
  { name: "manifest-valid", group: "manifest", json: json(manifest), valid: true },
  { name: "manifest-invalid", group: "manifest", json: json(invalidManifest), valid: false },
  { name: "bridge-valid", group: "bridge", json: json(bridge), valid: true },
  { name: "bridge-invalid", group: "bridge", json: json(invalidBridge), valid: false },
];
for (const size of [10, 100, 1000]) {
  const value = { title: "Benchmark", tasks: Array.from({ length: size }, (_, i) => ({
    id: `task-${i}`, text: `Task ${i}: deterministic fixture`, done: i % 2 === 0, archived: false,
  })) };
  benchmarks.push({ name: `checklist-${size}-valid`, group: "checklist", json: json(value), valid: true });
  benchmarks.push({ name: `checklist-${size}-invalid`, group: "checklist",
    json: json({ ...value, tasks: [...value.tasks.slice(0, -1), { ...value.tasks.at(-1), done: "false" }] }), valid: false });
}
await mkdir(resolve(folder, ".build"), { recursive: true });
await mkdir(resolve(folder, "results"), { recursive: true });
const input = resolve(folder, ".build/fixtures.json");
await writeFile(input, json({ groups, benchmarks }));
const output = resolve(folder, `.build/result-${label}-${process.pid}.json`);
const savedOutput = resolve(folder, `results/${label}.json`);
const proc = Bun.spawn(["swift", "run", "--package-path", folder, "-c", "release", "json-schema-comparison", input, output],
  { cwd: root, stdout: "inherit", stderr: "inherit" });
const code = await proc.exited;
if (await Bun.file(output).exists()) {
  const result = await Bun.file(output).json();
  result.discrepancyCount = result.schemas.filter((row: any) => !row.matched).length
    + result.cases.filter((row: any) => !row.matched).length + result.benchmarkErrors.length;
  const command = (args: string[]) => Bun.spawnSync(args, { cwd: root }).stdout.toString().trim();
  result.environment = { date: new Date().toISOString(), swift: command(["swift", "--version"]),
    machine: command(["uname", "-m"]), chip: command(["sysctl", "-n", "machdep.cpu.brand_string"]),
    os: command(["sw_vers"]), commit: command(["git", "rev-parse", "HEAD"]),
    runLabel: label, fixtureSHA256: createHash("sha256").update(await readFile(input)).digest("hex"),
    dependencyVersions: { DynamicJSON: "1.0.2", JSONSchema: "0.14.1" }, provenance };
  await writeFile(savedOutput, JSON.stringify(result, null, 2) + "\n");
  console.log(`Results: ${savedOutput}`);
}
process.exit(code);

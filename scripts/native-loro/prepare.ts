import { cp, mkdir, readFile, writeFile, rm, symlink } from "node:fs/promises";
import { resolve, join } from "node:path";
import * as S from "../../packages/schema/src/document.ts";
import checklist from "../../examples/slops/quick-checklist/schema.ts";
import initial from "../../examples/slops/quick-checklist/initial.ts";
import { buildSlop } from "../../packages/cli/src/project.ts";

await import("./generate-contract");

const repository = resolve(import.meta.dir, "../..");
export const output = join(repository, ".hitslop/native-loro");
const fixtures = join(repository, "apps/apple/Packages/HitSlopApple/Tests/HitSlopLoroSpikeTests/Fixtures");
const notes = S.Document({
  notes: S.Record(S.Object({ text: S.Text(), done: S.Boolean() })),
  settings: S.Object({ count: S.Integer({ minimum: 0, maximum: 20 }), label: S.String({ minLength: 1, maxLength: 12 }), enabled: S.Boolean() }),
  tags: S.Array(S.String()),
  choice: S.Atomic(S.Union([S.Null(), S.String()])),
});
const notesInitial = { notes: { first: { text: "hello", done: false } }, settings: { count: 2, label: "Notes", enabled: true }, tags: ["one"], choice: null };
const cases = [
  { name: "valid-checklist", schema: "checklist", data: initial },
  { name: "unknown-fields", schema: "checklist", data: { ...initial, future: { retain: true } } },
  { name: "duplicate-ids", schema: "checklist", data: { ...initial, tasks: [initial.tasks[0], initial.tasks[0]] } },
  { name: "empty-id", schema: "checklist", data: { ...initial, tasks: [{ ...initial.tasks[0], id: "" }] } },
  { name: "missing-title", schema: "checklist", data: { tasks: initial.tasks } },
  { name: "no-coercion", schema: "checklist", data: { ...initial, tasks: [{ ...initial.tasks[0], done: "false" }] } },
  { name: "valid-record", schema: "notes", data: notesInitial },
  { name: "record-type", schema: "notes", data: { ...notesInitial, notes: { first: { text: false, done: true } } } },
  { name: "minimum", schema: "notes", data: { ...notesInitial, settings: { ...notesInitial.settings, count: -1 } } },
  { name: "integer", schema: "notes", data: { ...notesInitial, settings: { ...notesInitial.settings, count: 1.5 } } },
  { name: "maxlength", schema: "notes", data: { ...notesInitial, settings: { ...notesInitial.settings, label: "too long for this" } } },
  { name: "atomic-union", schema: "notes", data: { ...notesInitial, choice: 42 } },
  { name: "unicode-length", schema: "notes", data: { ...notesInitial, settings: { ...notesInitial.settings, label: "😀😀😀😀😀😀😀" } } },
].map(value => {
  let valid = true;
  try { S.validateDocument(value.schema === "checklist" ? checklist : notes, value.data); } catch { valid = false; }
  return { ...value, valid };
});
await mkdir(fixtures, { recursive: true });
for (const [name, value] of Object.entries({ "checklist.schema": S.envelopeSchema(checklist), "checklist.initial": initial, "notes.schema": S.envelopeSchema(notes), "notes.initial": notesInitial, cases })) {
  await writeFile(join(fixtures, `${name}.json`), JSON.stringify(value, null, 2) + "\n");
}
if (!process.argv.includes("--fixtures-only")) {
  await mkdir(output, { recursive: true });
  for (const variant of ["js", "native"]) {
    const source = join(output, `source-${variant}`);
    await rm(source, { recursive: true, force: true });
    await cp(join(repository, "examples/slops/quick-checklist"), source, { recursive: true, filter: path => !path.split("/").includes("dist") });
    await symlink(join(repository, "examples/slops/node_modules"), join(source, "node_modules"), "dir");
    const tsconfig = JSON.parse(await readFile(join(source, "tsconfig.json"), "utf8"));
    tsconfig.extends = join(repository, "examples/slops/tsconfig.json");
    await writeFile(join(source, "tsconfig.json"), JSON.stringify(tsconfig));
    const appPath = join(source, "src/App.svelte");
    let app = await readFile(appPath, "utf8");
    if (variant === "native") {
      await cp(join(import.meta.dir, "store.svelte.ts"), join(source, "src/spike-store.svelte.ts"));
      await cp(join(import.meta.dir, "contract.generated.ts"), join(source, "src/contract.generated.ts"));
      app = app.replace('import { documentStore, IconTarget, ExportTarget }', 'import { IconTarget, ExportTarget }');
      app = app.replace('  import initial from "../initial";', '  import initial from "../initial";\n  import { documentStore, documentText } from "./spike-store.svelte";');
      for (const name of ["addTask", "move", "remove", "fileFinished", "restore"]) app = app.replace(`function ${name}(`, `async function ${name}(`);
      app = app.replaceAll('undo = () => {', 'undo = async () => {');
      // Await statement mutations, while value-binding setters return their promise.
      app = app.replace(/^(\s*)checklist\.change\(/gm, '$1await checklist.change(');
      app = app.replace(/bind:value=\{\s*\(\) => ([^,]+),\s*\(value\) =>\s*await checklist.change\(\(data\) => \{([\s\S]*?)\}\)\s*\}/g,
        (_match, value, body) => `use:documentText={{ store: checklist, read: (data) => ${value.trim() === 'checklist.current.title' ? 'data.title' : 'data.tasks.find(t => t.id === task.id)?.text ?? \"\"'}, write: (data, value) => {${body}} }}`);
      // The checkbox callback is async; its requested value is captured by the UI.
      app = app.replace('onCheckedChange={(checked) =>', 'onCheckedChange={async (checked) =>');
      app = app.replace('let undo = $state<null | (() => void)>', 'let undo = $state<null | (() => void | Promise<void>)>');
      if ((app.match(/use:documentText=/g) ?? []).length !== 2 || !app.includes('async function remove(') || !app.includes('from "./spike-store.svelte"')) {
        throw new Error("Quick Checklist changed; update the spike adapter transform before running the experiment");
      }
    }
    app = app.replace('  let activeView', '  Object.assign(window, { __spikeStore: checklist, __spikeActions: { remove, move, fileFinished, restore, undo: () => undo?.() } });\n  let activeView');
    await writeFile(appPath, app);
    const built = await buildSlop(source);
    await writeFile(join(built.directory, "assets/initial.json"), JSON.stringify(initial));
    const destination = join(output, `${variant}.slop`);
    await rm(destination, { recursive: true, force: true });
    await cp(built.directory, destination, { recursive: true });
    console.log(`${variant}: ${destination}`);
  }
}

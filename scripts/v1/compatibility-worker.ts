// Reuses compiled runtime modules; historical artifacts run as isolated batches.
// Never imports the source document engine.
import { strict as assert } from "node:assert";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { SQLiteStore } from "../../packages/document/test-support/sqlite";

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

const loaded = new Map<string, Promise<any>>();

export function loadRuntime(root: string) {
  root = resolve(root);
  let runtime = loaded.get(root);
  if (!runtime) {
    runtime = initializeRuntime(root);
    loaded.set(root, runtime);
  }
  return runtime;
}

async function initializeRuntime(root: string) {
  const loro = await import(pathToFileURL(join(root, "loro/index.js")).href);
  await loro.default({
    module_or_path: await Bun.file(join(root, "loro/loro_wasm_bg.wasm")).bytes(),
  });
  const runtime = await import(pathToFileURL(join(root, "index.js")).href);
  await runtime.initialize();
  return runtime;
}

export type RuntimeCase = {
  document: string;
  expected?: string;
  scenario?: string;
  phase?: string;
};
export type RuntimeResult = { state: unknown; stateHash: string };

export async function runCase(runtime: any, input: RuntimeCase): Promise<RuntimeResult> {
  const { document, expected: expectedPath, scenario: scenarioPath, phase = "read" } = input;
  const root = resolve(document);
  try {
    const descriptor = await Bun.file(join(root, "state.schema.json")).json();
    const initial = await Bun.file(join(root, "initial.json")).json();
    const definition = runtime.fromDescriptor(descriptor);
    let doc = await runtime.Document.open(definition, await SQLiteStore.open(root), initial);
    try {
      if (expectedPath && expectedPath !== "-")
        assert.deepEqual(doc.current, await Bun.file(expectedPath).json());
      if (scenarioPath && scenarioPath !== "-") {
        const scenario = await Bun.file(scenarioPath).json();
        for (const edit of scenario.handles ?? []) {
          let handle = doc.fields;
          for (const field of edit.path) handle = handle[field];
          handle[edit.method](...edit.args);
        }
        if (scenario.operations?.length) doc.applyAll(scenario.operations);
        assert.deepEqual(doc.current, scenario.expected);
      }
      if (phase === "checkpoint") await doc.compact();
      else await doc.flush();
      const expected = doc.current;
      await doc.close();
      doc = await runtime.Document.open(definition, await SQLiteStore.open(root), initial);
      assert.deepEqual(doc.current, expected);
      return {
        state: doc.current,
        stateHash: createHash("sha256").update(canonical(doc.current)).digest("hex"),
      };
    } finally {
      await doc.close();
    }
  } catch (error) {
    throw new Error(`Document ${document}, ${phase}: ${error}`, { cause: error });
  }
}

if (import.meta.main) {
  const runtimePath = process.argv[2];
  assert(runtimePath, "runtime path is required");
  const cases: RuntimeCase[] = await Bun.stdin.json();
  const runtime = await loadRuntime(runtimePath);
  const results: RuntimeResult[] = [];
  for (const input of cases) {
    // A stalled case must not hang an entire historical batch.
    const timeout = setTimeout(() => {
      console.error(`Document ${input.document}, ${input.phase ?? "read"}: timed out`);
      process.exit(1);
    }, 30_000);
    try {
      results.push(await runCase(runtime, input));
    } finally {
      clearTimeout(timeout);
    }
  }
  console.log(JSON.stringify(results));
}

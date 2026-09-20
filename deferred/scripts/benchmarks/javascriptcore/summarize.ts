import { resolve } from "node:path";

type Row = {
  documents: number;
  trial: number;
  residentBytes: number;
  retainedOwners: number;
  openMs: number[];
  initializationMs?: number[];
  configurationMs?: number[];
  largeSamplesMs: number[];
  smallSamplesMs: number[];
  largeStages?: Record<string, number>[];
  smallStages?: Record<string, number>[];
};
const percentile = (values: number[], fraction: number) => {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? null;
};
const p95 = (values: number[]) => percentile(values, 0.95);
const median = (values: number[]) => percentile(values, 0.5);
const directories = process.argv.slice(2);
if (!directories.length) throw new Error("Usage: summarize.ts production-run-directory [...]");
const runs = [];
for (const directory of directories) {
  const root = resolve(directory);
  const raw = (await Bun.file(resolve(root, "benchmark.json")).json()) as Row[];
  const environment = await Bun.file(resolve(root, "environment.json")).json();
  // Hash the copied artifacts actually executed, not a source file that may change mid-run.
  const bundles = [
    "HitSlopApple_HitSlopDocumentEngine.bundle/Contents/Resources/document-engine.js",
    "HitSlopApple_HitSlopDocumentEngine.bundle/document-engine.js",
    "HitSlopApple_HitSlopStateEngine.bundle/Contents/Resources/state-engine.js",
    "HitSlopApple_HitSlopStateEngine.bundle/state-engine.js",
  ];
  for (const name of bundles) {
    const file = Bun.file(resolve(root, name));
    if (await file.exists()) {
      const bytes = await file.arrayBuffer();
      environment.executedBundleBytes = bytes.byteLength;
      environment.executedBundleSHA256 = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
      break;
    }
  }
  environment.executableSHA256 = new Bun.CryptoHasher("sha256")
    .update(await Bun.file(resolve(root, "production-engine-check")).arrayBuffer())
    .digest("hex");

  const groups = [...new Set(raw.map((row) => row.documents))].map((documents) => {
    const rows = raw.filter((row) => row.documents === documents);
    const stages = (key: "largeStages" | "smallStages") => {
      const names = [...new Set(rows.flatMap((row) => (row[key] ?? []).flatMap(Object.keys)))];
      return Object.fromEntries(
        names.map((name) => [
          name,
          median(
            rows.flatMap((row) => {
              const samples = (row[key] ?? [])
                .map((stage) => stage[name])
                .filter((v) => v !== undefined);
              return samples.length ? [p95(samples)!] : [];
            }),
          ),
        ]),
      );
    };
    return {
      documents,
      largeP95Ms: median(rows.map((row) => p95(row.largeSamplesMs)!)),
      smallP95Ms: median(
        rows.flatMap((row) => (row.smallSamplesMs.length ? [p95(row.smallSamplesMs)!] : [])),
      ),
      trialLargeP95Ms: rows.map((row) => p95(row.largeSamplesMs)),
      trialSmallP95Ms: rows.map((row) => p95(row.smallSamplesMs)),
      initializationP95Ms: p95(rows.flatMap((row) => row.initializationMs ?? [])),
      configurationP95Ms: p95(rows.flatMap((row) => row.configurationMs ?? [])),
      residentMiB: rows.map((row) => row.residentBytes / 1024 ** 2),
      retainedOwners: rows.map((row) => row.retainedOwners),
      largeStageP95Ms: stages("largeStages"),
      smallStageP95Ms: stages("smallStages"),
    };
  });
  const lifecycleFile = Bun.file(resolve(root, "lifecycle.json"));
  const lifecycle = (await lifecycleFile.exists()) ? await lifecycleFile.json() : undefined;
  runs.push({
    directory: root.split("/").at(-1),
    environment,
    groups,
    raw,
    ...(lifecycle ? { lifecycle, coldEngineP95Ms: p95(lifecycle.coldMs) } : {}),
  });
}
console.log(
  JSON.stringify(
    {
      method:
        "Median of trial p95s, retaining every raw sample. Stage timings overlap: apply includes engine work; evaluation includes parse, mutation, validation and serialization. Missing stages are uninstrumented, not zero. Host RSS excludes WebContent. No Svelte paint guarantee.",
      runs,
    },
    null,
    2,
  ),
);

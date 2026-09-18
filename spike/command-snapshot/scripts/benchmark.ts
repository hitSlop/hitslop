import { cpus, platform, arch } from "node:os";
import { Authority } from "../src/host.ts";
import { schema, initial } from "../src/checklist-schema.ts";

const samples = Number(process.env.SPIKE_SAMPLES ?? 30);
const summary = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return { medianMs: sorted[Math.floor(sorted.length / 2)]!, p95Ms: sorted[Math.ceil(sorted.length * .95) - 1]! };
};
const results = [];
for (const rows of [1000, 5000, 10000]) {
  const data = { ...initial, tasks: Array.from({ length: rows }, (_, i) => ({ id: `row-${i}`, text: `Synthetic task ${i}`, done: false, archived: false })) };
  const authority = new Authority(schema, data);
  const elapsed: number[] = [];
  for (let i = 0; i < samples + 5; i++) {
    const start = performance.now();
    const result = authority.execute({ requestId: `sample-${i}`, ops: [{ op: "set", path: [{ key: "tasks" }, { item: `row-${rows - 1}` }, { key: "done" }], value: i % 2 === 0 }] });
    if (!result.ok) throw new Error(result.error.message);
    if (i >= 5) elapsed.push(performance.now() - start);
  }
  const timings = authority.timings.slice(5);
  results.push({ rows, bytes: new TextEncoder().encode(JSON.stringify(data)).byteLength, samples,
    applyIncludingClone: summary(timings.map(t => t.applyMs)), wholeDocumentValidation: summary(timings.map(t => t.validateMs)),
    snapshotSerialization: summary(timings.map(t => t.serializeMs)), authorityTotal: summary(elapsed) });
}
const report = { measuredAt: new Date().toISOString(), environment: { runtime: `Bun ${Bun.version}`, platform: platform(), arch: arch(), cpu: cpus()[0]?.model },
  scope: "In-memory authority only. Timings include clone, full validation and snapshot serialization. No disk durability, Swift, WebKit, network, or browser render. Not comparable to old native measurements.", results };
await Bun.write(process.env.HITSLOP_BENCHMARK_OUTPUT ?? new URL("../results/engine.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));

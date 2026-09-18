// bun scripts/document-benchmark.ts [samples]. No native disk or browser rendering in this measurement.
import * as S from "../packages/schema/dist/document.js";
import { MemoryAuthority } from "../packages/document-engine/dist/web.js";
import {
  createDocumentController,
  type CommandHost,
} from "../packages/runtime/src/document-controller.ts";
const schema = S.Document({
  tasks: S.List(S.Object({ id: S.String(), text: S.String(), done: S.Boolean() }), "id"),
});
const fields = S.paths(schema),
  samples = Number(process.argv[2] ?? 30);
const percentile = (values: number[], q: number) =>
  [...values].sort((a, b) => a - b)[Math.ceil(values.length * q) - 1];
for (const rows of [1000, 5000, 10000]) {
  const data = {
    tasks: Array.from({ length: rows }, (_, id) => ({
      id: String(id),
      text: "Task " + id,
      done: false,
    })),
  };
  const authority = new MemoryAuthority(schema, data);
  const host: CommandHost = {
    connected: true,
    writable: true,
    open: async () => authority.open(),
    send: async (request) => authority.execute(request),
    subscribe: (callback) =>
      authority.subscribe((snapshot) => callback(JSON.parse(JSON.stringify(snapshot)))),
    onConnection: () => () => {},
    flush: async () => {},
  };
  const controller = createDocumentController({ schema, initial: data, host });
  await controller.ready;
  const times: number[] = [];
  for (let n = 0; n < samples + 5; n++) {
    const start = performance.now();
    const result = await controller.toggle(fields.tasks.item(String(Math.floor(rows / 2))).done);
    if (!result.ok) throw new Error(result.error.message);
    if (n >= 5) times.push(performance.now() - start);
  }
  await controller.destroy();
  console.log(
    JSON.stringify({
      rows,
      samples,
      bytes: JSON.stringify(data).length,
      scope:
        "TS authority, serialized full snapshot, controller reconciliation; no browser or disk",
      medianMs: percentile(times, 0.5),
      p95Ms: percentile(times, 0.95),
    }),
  );
}

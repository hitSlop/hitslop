// Run with: bun scripts/document-benchmark.ts [samples]
import * as S from "../packages/schema/src/document.ts";
import { validate } from "../packages/schema/src/validation.ts";
import {
  BridgeMethods,
  BridgeReplySchema,
  DocumentFrameSchema,
  type DocumentApply,
} from "../packages/schema/src/bridge.ts";
import { createDocumentController } from "../packages/runtime/src/document-controller.ts";
import { installHost, type SlopHost } from "../packages/runtime/src/index.ts";

const schema = S.Document({
  tasks: S.List(S.Object({ id: S.String(), text: S.Text(), done: S.Boolean() }), "id"),
});
const samples = Number(process.argv[2] ?? 100);
const report = (times: number[]) => {
  times.sort((a, b) => a - b);
  return {
    median: times[Math.floor(times.length / 2)],
    p95: times[Math.ceil(times.length * 0.95) - 1],
  };
};
for (const [rows, textLength] of [
  [20, 32],
  [200, 32],
  [500, 32],
  [500, 360],
  [1000, 32],
  [10000, 32],
  [100000, 32],
]) {
  const data = {
    tasks: Array.from({ length: rows }, (_, id) => ({
      id: String(id),
      text: "x".repeat(textLength!),
      done: false,
    })),
  };
  try {
    S.validateDocument(schema, data);
  } catch (error) {
    console.log(
      JSON.stringify({ rows, bytes: JSON.stringify(data).length, rejected: String(error) }),
    );
    continue;
  }
  const iterations = rows! >= 10000 ? Math.min(samples, 3) : samples;
  let frame = {
    publication: 0,
    revision: "r0",
    data,
    dirty: false,
    error: null,
    projectionError: null,
  };
  const uninstall = installHost({
    document: {
      open: async () => frame,
      flush: async () => frame,
      releaseDraft: async () => frame,
      onChange: () => () => {},
      apply: async (request: DocumentApply) => {
        frame = {
          ...frame,
          data: request.after as typeof data,
          publication: frame.publication + 1,
          revision: `r${frame.publication + 1}`,
        };
        return frame;
      },
    },
  } as unknown as SlopHost);
  const controller = createDocumentController({ schema, initial: data });
  await controller.flush();
  const measurements: Record<string, ReturnType<typeof report>> = {};
  for (const [name, action] of Object.entries({
    documentValidation: () => S.validateDocument(schema, data),
    bridgeValidation: () => {
      validate(BridgeMethods["document.apply"].params, {
        session: "s",
        sequence: 1,
        base: "r",
        after: data,
      });
      validate(BridgeReplySchema, { ok: true, value: frame });
      validate(DocumentFrameSchema, frame);
      validate(DocumentFrameSchema, frame);
    },
    controllerEdit: () =>
      controller.change((draft) => {
        draft.tasks[0]!.done = !draft.tasks[0]!.done;
      }),
  })) {
    for (let i = 0; i < Math.min(10, iterations); i++) await action();
    const times = [];
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await action();
      times.push(performance.now() - start);
    }
    measurements[name] = report(times);
  }
  await controller.destroy();
  uninstall();
  console.log(
    JSON.stringify({
      rows,
      bytes: JSON.stringify(data).length,
      samples: iterations,
      milliseconds: measurements,
    }),
  );
}

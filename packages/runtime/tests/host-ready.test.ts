import { expect, test } from "bun:test";
import { runInNewContext } from "node:vm";

const bundle = await Bun.build({
  entrypoints: [new URL("../src/host-bridge.ts", import.meta.url).pathname],
  target: "browser",
  format: "iife",
});
if (!bundle.success) throw new Error("Cannot build host bridge for readiness test");
const source = await bundle.outputs[0]!.text();

for (const failedOpen of [false, true]) {
  test(`offscreen ready drains a ${failedOpen ? "failed" : "successful"} open without paint or timers`, async () => {
    const sent: string[] = [];
    let settle!: (value: unknown) => void;
    let reject!: (error: Error) => void;
    const opening = new Promise((resolve, fail) => {
      settle = resolve;
      reject = fail;
    });
    const window: any = {
      webkit: {
        messageHandlers: {
          hitslop: {
            postMessage: (request: { method: string }) => {
              sent.push(request.method);
              return request.method === "document.open"
                ? opening
                : Promise.resolve({ ok: true, value: null });
            },
          },
        },
      },
      addEventListener() {},
      dispatchEvent() {},
    };
    const unavailable = () => {
      throw new Error("Offscreen scheduler is suspended");
    };
    runInNewContext(source, {
      window,
      document: { documentElement: { dataset: {} } },
      console,
      Event,
      TextEncoder,
      queueMicrotask,
      setTimeout: unavailable,
      requestAnimationFrame: unavailable,
    });
    const opened = window.slop.document.open().catch(() => undefined);
    window.slop.ready();
    await Promise.resolve();
    expect(sent).toEqual(["document.open"]);
    if (failedOpen) reject(new Error("Cannot open document"));
    else
      settle({
        ok: true,
        value: {
          snapshot: {
            documentId: "doc",
            schemaHash: "schema",
            authority: "local",
            revision: 0,
            data: {},
          },
          lease: { id: "lease", expiresAt: 100 },
        },
      });
    await opened;
    await window.slop.flush();
    window.slop.ready();
    await Promise.resolve();
    expect(sent).toEqual(["document.open", "ready"]);
  });
}

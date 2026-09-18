import type { Snapshot, Request, Result, Open } from "@hitslop/schema/document-protocol";
import * as S from "@hitslop/schema/document";
const schema = S.Document({ count: S.Number() });
function edit(open: Open, count: number): Request {
  return {
    documentId: open.snapshot.documentId,
    schemaHash: open.snapshot.schemaHash,
    authority: open.snapshot.authority,
    leaseId: open.lease.id,
    requestId: crypto.randomUUID(),
    ops: [{ op: "set", path: [{ key: "count" }], value: count }],
  };
}
import { expect, test } from "bun:test";
import { devHostJavaScript, injectHost } from "../src/dev-bridge.ts";
import { mockHostPlugin } from "../src/dev.ts";

type Change = { kind: string; source: string; revision?: string | null };
type PreviewSlop = {
  document: {
    open: (initial?: unknown) => Promise<Open>;
    send: (request: Request) => Promise<Result>;
    flush: () => Promise<void>;
    subscribe: (callback: (frame: Snapshot) => void) => () => void;
  };
  media: {
    open: (sha256: string) => Promise<{ src: string | null }>;
    add: (
      data: string,
      kind: "image" | "file",
    ) => Promise<{ sha256: string; mime: string; bytes: number }>;
  };
  window: {
    resize: (size: { width: number; height: number }) => Promise<{ width: number; height: number }>;
    drag: () => Promise<void>;
  };
  ready: () => void;
};
type PreviewWindow = {
  slop?: PreviewSlop;
  addEventListener: (...args: unknown[]) => void;
  dispatched: string[];
  dispatchEvent: (event: { type: string }) => void;
};

function previewHost(data?: unknown): {
  window: PreviewWindow;
  document: { documentElement: { dataset: Record<string, string> } };
} {
  const window: PreviewWindow = {
    addEventListener() {},
    dispatched: [],
    dispatchEvent(event) {
      this.dispatched.push(event.type);
    },
  };
  if (data !== undefined) (window as any).__hitslopReviewConfig = { data };
  const document = {
    documentElement: { dataset: {} as Record<string, string> },
  };
  class PreviewEvent {
    constructor(public type: string) {}
  }
  new Function("window", "document", "Event", devHostJavaScript)(window, document, PreviewEvent);
  return { window, document };
}

test("browser preview injects a disposable host and optional default theme", () => {
  const transform = mockHostPlugin({
    themeHref: "/assets/theme.css",
  }).transformIndexHtml;
  if (!transform || typeof transform === "function")
    throw new Error("browser preview plugin is missing its HTML transform");
  const html = "<!doctype html><html><head><title>Fixture</title></head><body></body></html>";
  const result = (transform.handler as (value: string) => string)(html);
  expect(result.startsWith("<!doctype html><html><head>")).toBe(true);
  expect(result).toContain("data-hitslop-host");
  expect(result).toContain("data-hitslop-theme-default");
  expect(result).toContain("window.slop = Object.freeze");
  expect(result).not.toContain("fetch(");
  expect(result).not.toContain("setInterval");
  expect(result.indexOf("window.slop = Object.freeze")).toBeLessThan(result.indexOf("<title>"));
});

test("browser preview keeps document data in memory and publishes isolated frames", async () => {
  const slop = previewHost().window.slop!;
  const frames: Snapshot[] = [];
  const stop = slop.document.subscribe((frame) => frames.push(frame));
  const opened = await slop.document.open({ schema, initial: { count: 1 } });
  expect(opened.snapshot).toMatchObject({ data: { count: 1 }, revision: 0 });
  (opened.snapshot.data as { count: number }).count = 99;
  expect((await slop.document.open()).snapshot.data).toEqual({ count: 1 });
  expect(await slop.document.send(edit(opened, 2))).toEqual({ ok: true, revision: 1 });
  expect(frames).toHaveLength(1);
  expect(frames[0]!.data).toEqual({ count: 2 });
  stop();
  await slop.document.send(edit(opened, 4));
  expect(frames).toHaveLength(1);
});

test("browser preview supplies media, window, and readiness stubs", async () => {
  const host = previewHost();
  const slop = host.window.slop!;
  expect("db" in slop).toBe(false);
  expect(await slop.media.open("a".repeat(64))).toEqual({ src: null });
  const encoded =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  const added = await slop.media.add(encoded, "image");
  expect(added.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(added.mime).toBe("image/png");
  const opened = await slop.media.open(added.sha256);
  expect(opened.src).toStartWith("blob:");
  expect(await (await fetch(opened.src!)).arrayBuffer()).toEqual(
    Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)).buffer,
  );
  expect(await slop.media.add(encoded, "image")).toEqual(added);
  expect(await slop.window.resize({ width: 500, height: 400 })).toEqual({
    width: 500,
    height: 400,
  });
  expect(await slop.window.drag()).toBeUndefined();
  slop.ready();
  expect(host.document.documentElement.dataset.hitslopReady).toBe("true");
  expect(host.window.dispatched).toEqual(["slop:ready"]);
});

test("review fixtures initialize isolated stores without changing defaults", async () => {
  const fixture = { count: 7, extra: "keep" };
  const a = previewHost(fixture).window.slop!;
  const b = previewHost(fixture).window.slop!;
  expect((await a.document.open({ schema, initial: { count: 0 } })).snapshot.data).toEqual(fixture);
  await a.document.send(edit(await a.document.open(), 99));
  expect((await b.document.open({ schema, initial: { count: 0 } })).snapshot.data).toEqual(fixture);
  expect(
    (await previewHost().window.slop!.document.open({ schema, initial: { count: 0 } })).snapshot
      .data,
  ).toEqual({ count: 0 });
});

test("review injection escapes script terminators and stays out of normal previews", () => {
  const hostile = "</script><script>window.injection=true</script>";
  const html = injectHost("<head></head>", {
    review: {
      pane: "editor",
      run: "1",
      fingerprint: "abc",
      data: { text: hostile },
    },
  });
  expect(html).not.toContain(hostile);
  expect(html).toContain("\\u003c/script>");
  expect(html).toContain("hitslop:review");
  expect(injectHost("<head></head>")).not.toContain("hitslop:review");
});

async function reviewDiagnostics(captureError?: string) {
  const { reviewHostJavaScript } = await import("../src/dev-bridge");
  const events = new Map<string, Function>();
  const messages: any[] = [];
  let settle!: () => void;
  const captured = new Promise<void>((resolve) => {
    settle = resolve;
  });
  const window = {
    __hitslopReviewConfig: { pane: "export", run: "1", fingerprint: "abc" },
    __hitslopDevCapture: captured,
    __hitslopDevCaptureError: captureError,
    __hitslopCapture: { measure: () => ({ width: 720, height: 900, dedicated: true }) },
    addEventListener: (name: string, callback: Function) => events.set(name, callback),
  };
  const document = {
    fonts: { ready: Promise.resolve() },
    images: [],
    documentElement: { scrollWidth: 720, scrollHeight: 900 },
    body: {},
  };
  class Observer {
    observe() {}
    disconnect() {}
  }
  new Function(
    "window",
    "document",
    "parent",
    "location",
    "innerWidth",
    "innerHeight",
    "requestAnimationFrame",
    "ResizeObserver",
    "console",
    "setTimeout",
    "clearTimeout",
    reviewHostJavaScript,
  )(
    window,
    document,
    { postMessage: (value: unknown) => messages.push(value) },
    { origin: "http://localhost:4177" },
    720,
    680,
    (callback: Function) => queueMicrotask(() => callback(0)),
    Observer,
    { error() {} },
    () => 1,
    () => {},
  );
  const opening = events.get("slop:ready")!();
  await Promise.resolve();
  expect(messages).toHaveLength(0);
  settle();
  await opening;
  return { messages, events };
}

test("review readiness waits for capture completion and reports its real geometry", async () => {
  const { messages } = await reviewDiagnostics();
  expect(messages.at(-1)).toMatchObject({
    ready: true,
    fingerprint: "abc",
    measurement: {
      width: 720,
      height: 900,
      viewportWidth: 720,
      viewportHeight: 680,
      dedicated: true,
    },
    errors: [],
  });
});

test("review capture failures remain unready and visible", async () => {
  const { messages } = await reviewDiagnostics("Font failed to load");
  expect(messages.at(-1).ready).toBe(false);
  expect(messages.at(-1).errors.join(" ")).toContain("Font failed to load");
});

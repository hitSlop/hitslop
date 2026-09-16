import type { DocumentFrame } from "@hitslop/schema/bridge";
import { expect, test } from "bun:test";
import { devHostJavaScript, injectHost } from "../src/dev-bridge.ts";
import { mockHostPlugin } from "../src/dev.ts";

type Change = { kind: string; source: string; revision?: string | null };
type PreviewSlop = {
  document: {
    open: (initial?: unknown) => Promise<DocumentFrame>;
    apply: (edit: { after: unknown }) => Promise<DocumentFrame>;
    flush: () => Promise<DocumentFrame>;
    onChange: (callback: (frame: DocumentFrame) => void) => () => void;
  };
  media: {
    open: (name: string) => Promise<{ exists: boolean; revision: string | null }>;
    write: (name: string, data: string, mimeType: string) => Promise<{ revision: string }>;
    remove: (name: string) => Promise<{ revision: null }>;
  };
  window: {
    resize: (size: { width: number; height: number }) => Promise<{ width: number; height: number }>;
    drag: () => Promise<void>;
  };
  ready: () => void;
};
type PreviewWindow = {
  slop?: PreviewSlop;
  dispatched: string[];
  dispatchEvent: (event: { type: string }) => void;
};

function previewHost(data?: unknown): {
  window: PreviewWindow;
  document: { documentElement: { dataset: Record<string, string> } };
} {
  const window: PreviewWindow = {
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
  const frames: DocumentFrame[] = [];
  const stop = slop.document.onChange((frame) => frames.push(frame));
  const opened = await slop.document.open({ count: 1 });
  expect(opened).toMatchObject({ data: { count: 1 }, revision: "dev:0" });
  (opened.data as { count: number }).count = 99;
  expect((await slop.document.flush()).data).toEqual({ count: 1 });
  expect(await slop.document.apply({ after: { count: 2 } })).toMatchObject({
    data: { count: 2 },
    publication: 1,
  });
  expect(frames).toHaveLength(1);
  stop();
  await slop.document.apply({ after: { count: 4 } });
  expect(frames).toHaveLength(1);
});

test("browser preview supplies media, window, and readiness stubs", async () => {
  const host = previewHost();
  const slop = host.window.slop!;
  expect("db" in slop).toBe(false);
  expect(await slop.media.open("hero")).toEqual({
    exists: false,
    revision: null,
  });
  expect((await slop.media.write("hero", "", "image/png")).revision).toBe("dev-media:1");
  expect(await slop.media.remove("hero")).toEqual({ revision: null });
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
  expect((await a.document.open({ count: 0 })).data).toEqual(fixture);
  await a.document.apply({ after: { count: 99 } });
  expect((await b.document.open({ count: 0 })).data).toEqual(fixture);
  expect((await previewHost().window.slop!.document.open({ count: 0 })).data).toEqual({ count: 0 });
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

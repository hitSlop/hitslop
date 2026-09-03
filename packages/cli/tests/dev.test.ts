import { expect, test } from "bun:test";
import { devHostJavaScript } from "../src/dev-bridge.ts";
import { mockHostPlugin } from "../src/dev.ts";

type Change = { kind: string; source: string; revision?: string | null };
type PreviewSlop = {
  json: {
    open: <T>(value: T) => Promise<{ value: T; revision: string }>;
    read: <T>() => Promise<{ value: T; revision: string }>;
    write: <T>(value: T, expectedRevision?: string) => Promise<{ revision: string }>;
    onChange: (callback: (event: Change) => void) => () => void;
  };
  db: {
    query: (sql: string) => Promise<unknown[]>;
    execute: (sql: string) => Promise<number>;
    transaction: (statements: Array<{ sql: string }>) => Promise<number>;
  };
  media: {
    open: (name: string) => Promise<{ exists: boolean; revision: string | null }>;
    write: (name: string, data: string, mimeType: string) => Promise<{ revision: string }>;
    remove: (name: string) => Promise<{ revision: null }>;
  };
  window: { resize: (size: { width: number; height: number }) => Promise<{ width: number; height: number }>; drag: () => Promise<void> };
  ready: () => void;
};
type PreviewWindow = { slop?: PreviewSlop; dispatched: string[]; dispatchEvent: (event: { type: string }) => void };

function previewHost(): { window: PreviewWindow; document: { documentElement: { dataset: Record<string, string> } } } {
  const window: PreviewWindow = { dispatched: [], dispatchEvent(event) { this.dispatched.push(event.type); } };
  const document = { documentElement: { dataset: {} as Record<string, string> } };
  class PreviewEvent { constructor(public type: string) {} }
  new Function("window", "document", "Event", devHostJavaScript)(window, document, PreviewEvent);
  return { window, document };
}

test("browser preview injects a disposable host and optional default theme", () => {
  const transform = mockHostPlugin({ themeHref: "/assets/theme.css" }).transformIndexHtml;
  if (!transform || typeof transform === "function") throw new Error("browser preview plugin is missing its HTML transform");
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

test("browser preview keeps JSON in memory and emits local changes", async () => {
  const host = previewHost();
  const slop = host.window.slop!;
  const changes: Change[] = [];
  const stop = slop.json.onChange((event) => changes.push(event));
  const opened = await slop.json.open({ count: 1 });
  expect(opened).toEqual({ value: { count: 1 }, revision: "dev:0" });
  opened.value.count = 99;
  expect(await slop.json.read()).toEqual({ value: { count: 1 }, revision: "dev:0" });
  expect(await slop.json.write({ count: 2 }, opened.revision)).toEqual({ revision: "dev:1" });
  expect(changes).toEqual([{ kind: "json", source: "app", revision: "dev:1" }]);
  await expect(slop.json.write({ count: 3 }, "dev:0")).rejects.toThrow("revision_conflict");
  stop();
  await slop.json.write({ count: 4 }, "dev:1");
  expect(changes).toHaveLength(1);
});

test("browser preview supplies forgiving SQLite, media, window, and readiness stubs", async () => {
  const host = previewHost();
  const slop = host.window.slop!;
  expect(await slop.db.query("select 1")).toEqual([]);
  expect(await slop.db.execute("create table ignored (id integer)")).toBe(0);
  expect(await slop.db.transaction([{ sql: "insert into ignored values (1)" }])).toBe(0);
  expect(await slop.media.open("hero")).toEqual({ exists: false, revision: null });
  expect((await slop.media.write("hero", "", "image/png")).revision).toBe("dev-media:1");
  expect(await slop.media.remove("hero")).toEqual({ revision: null });
  expect(await slop.window.resize({ width: 500, height: 400 })).toEqual({ width: 500, height: 400 });
  expect(await slop.window.drag()).toBeUndefined();
  slop.ready();
  expect(host.document.documentElement.dataset.hitslopReady).toBe("true");
  expect(host.window.dispatched).toEqual(["slop:ready"]);
});

import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { compileDataSchema } from "@hitslop/schema";
import { loadDataSchema } from "../../packages/cli/src/data-schema";
import { devHostJavaScript } from "../../packages/cli/src/dev-bridge";

export type ReviewCase = { id: string; label: string; data: unknown };
export type ReviewInfo = { cases: ReviewCase[]; fingerprint: string };
const ignored = new Set([
  "node_modules",
  "dist",
  ".impeccable",
  ".git",
  "DESIGN.md",
  "README.md",
]);

export async function reviewFingerprint(directory: string): Promise<string> {
  const hash = createHash("sha256").update(devHostJavaScript);
  async function walk(path: string, prefix = "") {
    for (const entry of (await readdir(path, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      if (ignored.has(entry.name) || entry.name.startsWith(".")) continue;
      const name = prefix + entry.name;
      if (entry.isDirectory()) await walk(join(path, entry.name), name + "/");
      else if (entry.isFile())
        hash
          .update(name)
          .update("\0")
          .update(await readFile(join(path, entry.name)))
          .update("\0");
    }
  }
  await walk(directory);
  return hash.digest("hex").slice(0, 16);
}

export async function loadReview(directory: string): Promise<ReviewInfo> {
  const fingerprint = await reviewFingerprint(directory);
  let raw: string;
  try {
    raw = await readFile(join(directory, "review.json"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { cases: [], fingerprint };
    throw error;
  }
  const value = JSON.parse(raw);
  if (!value || !Array.isArray(value.cases) || !value.cases.length)
    throw new Error("review.json requires a nonempty cases array");
  const validate = compileDataSchema(
    await loadDataSchema(join(directory, "schema.ts")),
  );
  const ids = new Set<string>();
  for (const item of value.cases) {
    if (
      !item ||
      typeof item.id !== "string" ||
      !/^[a-z0-9-]+$/.test(item.id) ||
      ids.has(item.id) ||
      typeof item.label !== "string" ||
      !item.label.trim() ||
      !Object.hasOwn(item, "data")
    )
      throw new Error(
        "Each review case needs a unique lowercase id, label, and data",
      );
    ids.add(item.id);
    try {
      validate(item.data);
    } catch (error) {
      throw new Error(`Review case ${item.id}: ${String(error)}`);
    }
  }
  return { cases: value.cases, fingerprint };
}

export const safeJSON = (value: unknown): string =>
  JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
const escape = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");

export function reviewHTML(
  slop: { slug: string; title: string; width: number; height: number },
  info: ReviewInfo,
): string {
  const config = {
    ...slop,
    ...info,
    cases: info.cases.map(({ id, label }) => ({ id, label })),
  };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(slop.title)} · Review</title>
<style>
*{box-sizing:border-box}body{margin:0;padding:24px;font:14px system-ui;background:#ecece9;color:#252725}h1{font-size:24px;margin:0}header{display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:20px}button,select{font:inherit;padding:10px;border:1px solid #777;border-radius:5px;background:white;color:inherit}button:disabled{opacity:.5}button:focus-visible,select:focus-visible{outline:3px solid #2459a5;outline-offset:2px}#matrix{display:flex;align-items:flex-start;flex-wrap:wrap;gap:24px}.pane{margin:0;max-width:100%}.viewport{overflow:auto;max-width:100%;background:white}iframe{display:block;border:0;max-width:none}h2{font-size:16px;margin:0 0 6px}.state{margin:0 0 8px;color:#555;max-width:720px;overflow-wrap:anywhere}#message{flex-basis:100%;margin:0}#packet{width:100%;min-height:180px;margin-top:20px;font:13px monospace}code{font-size:12px}.error{color:#9b2727!important}
</style></head><body><header><h1>${escape(slop.title)} review</h1><label>State <select id="fixture"></select></label><button id="reset">Reset previews</button><button id="copy" disabled>Copy review packet</button><p id="message">Preparing previews…</p></header><main id="matrix"></main><textarea id="packet" aria-label="Review packet" readonly hidden></textarea>
<script type="module">
const config=${safeJSON(config)};
${reviewClient.toString()}
reviewClient(config);
if (import.meta.hot) import.meta.hot.on("hitslop:review-stale", data => window.dispatchEvent(new CustomEvent("hitslop:review-stale", {detail:data})));
</script></body></html>`;
}

function reviewClient(config: any) {
  const select = document.querySelector("#fixture") as HTMLSelectElement;
  const matrix = document.querySelector("#matrix")!;
  const copy = document.querySelector("#copy") as HTMLButtonElement;
  const message = document.querySelector("#message")!;
  const packet = document.querySelector("#packet") as HTMLTextAreaElement;
  const states = new Map<string, any>();
  let stale = false;
  let generation = 0;
  const definitions = [
    {
      id: "editor",
      label: "Editor",
      width: config.width,
      height: config.height,
      mode: "live",
    },
    {
      id: "narrow",
      label: "Narrow editor",
      width: 360,
      height: config.height,
      mode: "live",
    },
    {
      id: "export",
      label: "Export",
      width: config.width,
      height: config.height,
      mode: "export",
    },
    { id: "icon", label: "Icon", width: 512, height: 512, mode: "icon" },
  ];
  for (const fixture of config.cases.length
    ? config.cases
    : [{ id: "default", label: "App defaults" }]) {
    const option = document.createElement("option");
    option.value = fixture.id;
    option.textContent = fixture.label;
    select.append(option);
  }
  const requested = new URL(location.href).searchParams.get("case");
  if ([...select.options].some((option) => option.value === requested))
    select.value = requested!;
  function refresh() {
    const current = [...states.values()];
    const allReady =
      current.length === 4 &&
      current.every((state) => state.ready && !state.errors.length);
    copy.disabled = stale || !allReady;
    message.textContent = stale
      ? "Source changed. Reload the workbench before reviewing."
      : allReady
        ? `Ready · ${select.value} · source ${config.fingerprint}`
        : "Waiting for valid previews. Inspect pane status below.";
  }
  function reset() {
    if (stale) {
      location.reload();
      return;
    }
    generation++;
    for (const state of states.values()) clearTimeout(state.timeout);
    states.clear();
    matrix.replaceChildren();
    packet.hidden = true;
    const url = new URL(location.href);
    url.searchParams.set("case", select.value);
    history.replaceState(null, "", url);
    for (const def of definitions) {
      const pane = document.createElement("section");
      pane.className = "pane";
      const heading = document.createElement("h2");
      heading.textContent = `${def.label} · ${def.width} × ${def.height}`;
      const status = document.createElement("p");
      status.className = "state";
      status.textContent = "Loading…";
      const viewport = document.createElement("div");
      viewport.className = "viewport";
      const frame = document.createElement("iframe");
      frame.title = def.label;
      frame.width = String(def.width);
      frame.height = String(def.height);
      const query = new URLSearchParams({
        reviewCase: select.value,
        reviewPane: def.id,
        reviewRun: String(generation),
      });
      if (def.mode !== "live") query.set("capture", def.mode);
      frame.src = `/${encodeURIComponent(config.slug)}/?${query}`;
      const state = {
        ...def,
        ready: false,
        errors: [] as string[],
        frame,
        status,
        startedAt: performance.now(),
        timeout: 0,
      };
      state.timeout = window.setTimeout(() => {
        if (!state.ready) {
          state.errors.push("Preview did not become ready within 15 seconds");
          status.textContent = state.errors.join(" · ");
          status.className = "state error";
          refresh();
        }
      }, 15000);
      states.set(def.id, state);
      viewport.append(frame);
      pane.append(heading, status, viewport);
      matrix.append(pane);
    }
    refresh();
  }
  window.addEventListener("message", (event) => {
    if (
      event.origin !== location.origin ||
      event.data?.type !== "hitslop:review"
    )
      return;
    const data = event.data;
    const state = states.get(data.pane);
    if (
      !state ||
      event.source !== state.frame.contentWindow ||
      String(data.run) !== String(generation)
    )
      return;
    if (data.ready && !state.ready)
      state.previewReadyMs = Math.round(performance.now() - state.startedAt);
    state.ready = data.ready;
    if (state.ready || data.errors?.length) clearTimeout(state.timeout);
    state.errors = data.errors || [];
    state.measurement = data.measurement;
    if (data.fingerprint !== config.fingerprint) stale = true;
    if (data.measurement && data.measurement.viewportWidth !== state.width)
      state.errors.push("Viewport width does not match the requested pane");
    if (state.id === "export" && data.ready && data.measurement?.height)
      state.frame.height = String(data.measurement.height);
    state.status.className = state.errors.length ? "state error" : "state";
    state.status.textContent = state.errors.length
      ? state.errors.join(" · ")
      : data.ready
        ? `${data.measurement.viewportWidth} × ${data.measurement.viewportHeight} viewport · ${data.measurement.width} × ${data.measurement.height} content${data.measurement.overflowX ? " · horizontal overflow" : ""}`
        : "Preparing…";
    refresh();
  });
  window.addEventListener("hitslop:review-stale", (event: Event) => {
    const data = (event as CustomEvent).detail;
    if (data.slug === config.slug || data.slug === "*") {
      stale = true;
      refresh();
    }
  });
  select.addEventListener("change", reset);
  document.querySelector("#reset")!.addEventListener("click", reset);
  copy.addEventListener("click", async () => {
    const evidence = [...states.values()].map(
      ({ frame, status, startedAt, timeout, ...data }) => data,
    );
    packet.value = JSON.stringify(
      {
        slug: config.slug,
        fixture: select.value,
        fingerprint: config.fingerprint,
        preparedAt: new Date().toISOString(),
        design: `examples/slops/${config.slug}/DESIGN.md`,
        brief: `examples/slops/.impeccable/surfaces/${config.slug}-src-app-svelte.md`,
        panes: evidence,
      },
      null,
      2,
    );
    packet.hidden = false;
    try {
      await navigator.clipboard.writeText(packet.value);
      message.textContent = "Review packet copied.";
    } catch {
      packet.focus();
      packet.select();
      message.textContent =
        "Review packet ready below; copy the selected text.";
    }
  });
  reset();
}

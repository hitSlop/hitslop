import { Database } from "bun:sqlite";
import { cp, mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { Plugin } from "vite";
import { createServer } from "vite";
import type { SlopManifest } from "@hitslop/schema";
import { loadManifest } from "./project.ts";

const readNodeBody = async (request: AsyncIterable<Uint8Array>): Promise<Record<string, unknown>> => {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) chunks.push(typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk);
  return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks))) as Record<string, unknown>;
};
const revision = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

const bridge = `<script>\n(() => {\n const call=async(path,body)=>{const r=await fetch('/__hitslop/'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const value=await r.json();if(!r.ok)throw new Error(value.error||r.statusText);return value};\n const watch=(kind,store,cb)=>{let rev;const timer=setInterval(async()=>{try{const value=await call(kind+'/revision',{store});if(rev&&rev!==value.revision)cb({kind,store,source:'package',revision:value.revision});rev=value.revision}catch{}},750);return()=>clearInterval(timer)};\n window.slop={json:{read:store=>call('json/read',{store}),write:(store,value,expectedRevision)=>call('json/write',{store,value,expectedRevision}),onChange:(store,cb)=>watch('json',store,cb)},db:{query:(store,sql,parameters=[])=>call('sqlite/query',{store,sql,parameters}),execute:(store,sql,parameters=[])=>call('sqlite/execute',{store,sql,parameters}),transaction:(store,statements)=>call('sqlite/transaction',{store,statements}),onChange:(store,cb)=>watch('sqlite',store,cb)},ready:()=>{document.documentElement.dataset.hitslopReady='true'}};\n})();\n</script>`;

async function seedStores(root: string, manifest: SlopManifest, reset: boolean): Promise<string> {
  const dataRoot = join(root, ".hitslop", "dev"); if (reset) await rm(dataRoot, { recursive: true, force: true }); await mkdir(dataRoot, { recursive: true });
  for (const store of manifest.stores) { const target = join(dataRoot, store.path); try { await stat(target); } catch { await mkdir(dirname(target), { recursive: true }); await cp(join(root, store.path), target); } }
  return dataRoot;
}

function mockHostPlugin(manifest: SlopManifest, dataRoot: string): Plugin {
  const stores = new Map(manifest.stores.map((store) => [store.id, store]));
  const resolveStore = (id: unknown, kind: "json" | "sqlite"): string => { if (typeof id !== "string") throw new Error("store is required"); const store = stores.get(id); if (!store || store.kind !== kind) throw new Error(`Unknown ${kind} store: ${id}`); return join(dataRoot, store.path); };
  return { name: "hitslop-mock-host", transformIndexHtml: { order: "pre", handler: (html) => bridge + html }, configureServer(server) {
    server.middlewares.use("/__hitslop", async (nodeRequest, response) => {
      response.setHeader("content-type", "application/json");
      try {
        const body = await readNodeBody(nodeRequest); const route = new URL(`http://localhost${nodeRequest.url}`).pathname.replace("/__hitslop/", "");
        if (route === "json/read") { const path = resolveStore(body.store, "json"); const bytes = new Uint8Array(await Bun.file(path).arrayBuffer()); response.end(JSON.stringify({ value: JSON.parse(new TextDecoder().decode(bytes)), revision: revision(bytes) })); return; }
        if (route === "json/write") { const path = resolveStore(body.store, "json"); const current = new Uint8Array(await Bun.file(path).arrayBuffer()); if (body.expectedRevision && body.expectedRevision !== revision(current)) throw new Error("revision_conflict"); const bytes = new TextEncoder().encode(JSON.stringify(body.value, null, 2) + "\n"); const temporary = `${path}.${randomUUID()}.tmp`; await writeFile(temporary, bytes); await rename(temporary, path); response.end(JSON.stringify({ revision: revision(bytes) })); return; }
        if (route === "json/revision" || route === "sqlite/revision") { const path = resolveStore(body.store, route.startsWith("json") ? "json" : "sqlite"); const bytes = new Uint8Array(await Bun.file(path).arrayBuffer()); response.end(JSON.stringify({ revision: revision(bytes) })); return; }
        const path = resolveStore(body.store, "sqlite"); const database = new Database(path, { create: false });
        try {
          if (route === "sqlite/query") { const statement = database.query(String(body.sql)); response.end(JSON.stringify(statement.all(...((body.parameters ?? []) as Parameters<typeof statement.all>)))); return; }
          if (route === "sqlite/execute") { const statement = database.query(String(body.sql)); const result = statement.run(...((body.parameters ?? []) as Parameters<typeof statement.run>)); response.end(JSON.stringify(Number(result.changes))); return; }
          if (route === "sqlite/transaction") { const statements = body.statements as Array<{ sql: string; parameters?: unknown[] }>; let changes = 0; database.transaction(() => { for (const item of statements) { const statement = database.query(item.sql); changes += Number(statement.run(...((item.parameters ?? []) as Parameters<typeof statement.run>)).changes); } })(); response.end(JSON.stringify(changes)); return; }
        } finally { database.close(); }
        response.statusCode = 404; response.end(JSON.stringify({ error: "Not found" }));
      } catch (error) { response.statusCode = 400; response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) })); }
    });
  } };
}

export async function runDev(root: string, options: { reset: boolean; native: boolean }): Promise<void> {
  const manifest = await loadManifest(root); const dataRoot = await seedStores(root, manifest, options.reset);
  const server = await createServer({ root, plugins: [mockHostPlugin(manifest, dataRoot)], server: { port: 0 } }); await server.listen();
  const url = server.resolvedUrls?.local[0]; if (!url) throw new Error("Vite did not expose a development URL");
  console.log(`hitSlop dev: ${url}`);
  if (options.native) await runNative(["open-dev", url, "--width", String(manifest.window.width), "--height", String(manifest.window.height)]);
  else if (process.platform === "darwin") Bun.spawn(["open", url], { stdout: "ignore", stderr: "ignore" });
}

export async function runNative(arguments_: string[]): Promise<void> {
  const override = process.env.HITSLOP_NATIVE_CLI;
  const candidates = [override, "/Applications/hitSlop.app/Contents/Helpers/hitslop-native", `${process.env.HOME}/Applications/hitSlop.app/Contents/Helpers/hitslop-native`, "hitslop-native"].filter(Boolean) as string[];
  for (const executable of candidates) {
    try {
      const processResult = Bun.spawn([executable, ...arguments_], { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
      const status = await processResult.exited; if (status === 0) return; if (executable === candidates.at(-1)) throw new Error(`hitslop-native failed with status ${status}`);
    } catch (error) { if (executable === candidates.at(-1)) throw error; }
  }
  throw new Error("Install hitSlop or set HITSLOP_NATIVE_CLI to use native rendering.");
}

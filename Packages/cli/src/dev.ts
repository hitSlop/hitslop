import { Database } from "bun:sqlite";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { Plugin } from "vite";
import { createServer } from "vite";
import { loadManifest } from "./project.ts";

const readNodeBody = async (request: AsyncIterable<Uint8Array>): Promise<Record<string, unknown>> => {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) chunks.push(typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk);
  return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks))) as Record<string, unknown>;
};
const revision = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const exists = async (path: string): Promise<boolean> => { try { await stat(path); return true; } catch { return false; } };

const bridge = `<script>\n(() => {\n const listeners={json:new Set(),sqlite:new Set()};\n const call=async(path,body={})=>{const r=await fetch('/__hitslop/'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const value=await r.json();if(!r.ok)throw new Error(value.error||r.statusText);return value};\n const emit=(kind,event)=>listeners[kind].forEach(cb=>cb({kind,...event}));\n const watch=(kind,cb)=>{listeners[kind].add(cb);let rev;const timer=setInterval(async()=>{try{const value=await call(kind+'/revision');if(rev!==undefined&&rev!==value.revision)emit(kind,{source:'external',revision:value.revision});rev=value.revision}catch{}},750);return()=>{listeners[kind].delete(cb);clearInterval(timer)}};\n window.slop={json:{open:value=>call('json/open',{value}),read:()=>call('json/read'),write:(value,expectedRevision)=>call('json/write',{value,expectedRevision}).then(result=>(emit('json',{source:'app',revision:result.revision}),result)),onChange:cb=>watch('json',cb)},db:{query:(sql,parameters=[])=>call('sqlite/query',{sql,parameters}),execute:(sql,parameters=[])=>call('sqlite/execute',{sql,parameters}).then(result=>(emit('sqlite',{source:'app'}),result)),transaction:statements=>call('sqlite/transaction',{statements}).then(result=>(emit('sqlite',{source:'app'}),result)),onChange:cb=>watch('sqlite',cb)},ready:()=>{document.documentElement.dataset.hitslopReady='true'}};\n})();\n</script>`;

const forbiddenSQL = /\b(attach|detach|load_extension)\b/i;

function mockHostPlugin(dataRoot: string): Plugin {
  const storesRoot = join(dataRoot, "stores");
  const jsonPath = join(storesRoot, "data.json");
  const sqlitePath = join(storesRoot, "data.sqlite");
  let database: Database | undefined;
  const sqlite = async (): Promise<Database> => {
    await mkdir(storesRoot, { recursive: true });
    if (!database) {
      database = new Database(sqlitePath, { create: true });
      database.exec("PRAGMA journal_mode=WAL");
      database.exec("PRAGMA busy_timeout=5000");
      database.exec("PRAGMA trusted_schema=OFF");
    }
    return database;
  };
  const readJSON = async () => {
    if (!await exists(jsonPath)) throw new Error("JSON store has not been opened");
    const bytes = new Uint8Array(await Bun.file(jsonPath).arrayBuffer());
    return { value: JSON.parse(new TextDecoder().decode(bytes)), revision: revision(bytes) };
  };
  const openJSON = async (value: unknown) => {
    await mkdir(storesRoot, { recursive: true });
    const bytes = new TextEncoder().encode(JSON.stringify(value, null, 2) + "\n");
    try { await writeFile(jsonPath, bytes, { flag: "wx" }); } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "EEXIST")) throw error;
    }
    return readJSON();
  };
  const fileRevision = async (paths: string[]): Promise<string | null> => {
    const hash = createHash("sha256"); let found = false;
    for (const path of paths) if (await exists(path)) { found = true; hash.update(new Uint8Array(await Bun.file(path).arrayBuffer())); }
    return found ? hash.digest("hex") : null;
  };
  const assertSQL = (sql: string) => { if (forbiddenSQL.test(sql)) throw new Error("SQLite statement is not allowed"); };
  return { name: "hitslop-mock-host", transformIndexHtml: { order: "pre", handler: (html) => bridge + html }, configureServer(server) {
    server.middlewares.use("/__hitslop", async (nodeRequest, response) => {
      response.setHeader("content-type", "application/json");
      try {
        const body = await readNodeBody(nodeRequest); const route = new URL(`http://localhost${nodeRequest.url}`).pathname.replace("/__hitslop/", "");
        if (route === "json/open") { response.end(JSON.stringify(await openJSON(body.value))); return; }
        if (route === "json/read") { response.end(JSON.stringify(await readJSON())); return; }
        if (route === "json/write") {
          const current = await readJSON();
          if (body.expectedRevision && body.expectedRevision !== current.revision) throw new Error("revision_conflict");
          const bytes = new TextEncoder().encode(JSON.stringify(body.value, null, 2) + "\n");
          const temporary = `${jsonPath}.${randomUUID()}.tmp`;
          await writeFile(temporary, bytes); await rename(temporary, jsonPath);
          response.end(JSON.stringify({ revision: revision(bytes) })); return;
        }
        if (route === "json/revision") { response.end(JSON.stringify({ revision: await fileRevision([jsonPath]) })); return; }
        if (route === "sqlite/revision") { response.end(JSON.stringify({ revision: await fileRevision([sqlitePath, `${sqlitePath}-wal`]) })); return; }
        const db = await sqlite();
        if (route === "sqlite/query") { assertSQL(String(body.sql)); const statement = db.query(String(body.sql)); response.end(JSON.stringify(statement.all(...((body.parameters ?? []) as Parameters<typeof statement.all>)))); return; }
        if (route === "sqlite/execute") {
          assertSQL(String(body.sql)); const statement = db.query(String(body.sql));
          const result = db.transaction(() => Number(statement.run(...((body.parameters ?? []) as Parameters<typeof statement.run>)).changes))();
          response.end(JSON.stringify(result)); return;
        }
        if (route === "sqlite/transaction") {
          const statements = body.statements as Array<{ sql: string; parameters?: unknown[] }>;
          for (const item of statements) assertSQL(item.sql);
          const changes = db.transaction(() => statements.reduce((total, item) => { const statement = db.query(item.sql); return total + Number(statement.run(...((item.parameters ?? []) as Parameters<typeof statement.run>)).changes); }, 0))();
          response.end(JSON.stringify(changes)); return;
        }
        response.statusCode = 404; response.end(JSON.stringify({ error: "Not found" }));
      } catch (error) { response.statusCode = 400; response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) })); }
    });
  } };
}

export async function runDev(root: string, options: { reset: boolean; native: boolean }): Promise<void> {
  const manifest = await loadManifest(root); const dataRoot = join(root, ".hitslop", "dev");
  if (options.reset) await rm(dataRoot, { recursive: true, force: true });
  await mkdir(dataRoot, { recursive: true });
  const server = await createServer({ root, plugins: [mockHostPlugin(dataRoot)], server: { port: 0 } }); await server.listen();
  const url = server.resolvedUrls?.local[0]; if (!url) throw new Error("Vite did not expose a development URL");
  console.log(`hitSlop dev: ${url}`);
  if (options.native) await runNative(["open-dev", url, "--width", String(manifest.presentation.width), "--height", String(manifest.presentation.height)]);
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

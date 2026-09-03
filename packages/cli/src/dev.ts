import { Database } from "bun:sqlite";
import { mkdir, readFile, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { Plugin } from "vite";
import { createServer } from "vite";
import { injectHost } from "./dev-bridge.ts";
import { loadManifest } from "./project.ts";

const readNodeBody = async (request: AsyncIterable<Uint8Array>): Promise<Record<string, unknown>> => {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) chunks.push(typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk);
  return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks))) as Record<string, unknown>;
};
const revision = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const exists = async (path: string): Promise<boolean> => { try { await stat(path); return true; } catch { return false; } };
const mediaName = (value: unknown): string => {
  const name = String(value ?? "");
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(name)) throw new Error("Invalid media name");
  return name;
};
const imageMime = (bytes: Uint8Array): string | null => {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 6 && new TextDecoder().decode(bytes.subarray(0, 6)).match(/^GIF8[79]a$/)) return "image/gif";
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.subarray(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.subarray(8, 12)) === "WEBP") return "image/webp";
  return null;
};
const zipIsValid = (bytes: Uint8Array): boolean => {
  const u16 = (at: number): number | null => at >= 0 && at + 2 <= bytes.length ? (bytes[at] ?? 0) | (bytes[at + 1] ?? 0) << 8 : null;
  const u32 = (at: number): number | null => {
    if (at < 0 || at + 4 > bytes.length) return null;
    return ((bytes[at] ?? 0) | (bytes[at + 1] ?? 0) << 8 | (bytes[at + 2] ?? 0) << 16 | (bytes[at + 3] ?? 0) << 24) >>> 0;
  };
  if (bytes.length > 10 * 1024 * 1024 || bytes.length < 22) return false;
  const first = Math.max(0, bytes.length - 22 - 65_535), last = bytes.length - 22;
  let end = -1;
  for (let at = last; at >= first; at -= 1) if (u32(at) === 0x06054b50) { end = at; break; }
  if (end < 0) return false;
  const count = u16(end + 10), centralSize = u32(end + 12), centralOffset = u32(end + 16);
  if (count == null || centralSize == null || centralOffset == null || count < 1 || count > 256 || centralOffset + centralSize > end) return false;
  let cursor: number = centralOffset;
  let total = 0, hasFile = false;
  for (let index = 0; index < count; index += 1) {
    if (u32(cursor) !== 0x02014b50) return false;
    const flags = u16(cursor + 8), method = u16(cursor + 10), compressed = u32(cursor + 20), size = u32(cursor + 24);
    const nameLength = u16(cursor + 28), extraLength = u16(cursor + 30), commentLength = u16(cursor + 32);
    if (flags == null || method == null || compressed == null || size == null || nameLength == null || extraLength == null || commentLength == null) return false;
    if ((flags & 1) !== 0 || ![0, 8].includes(method) || compressed === 0xffff_ffff || size === 0xffff_ffff || size > 25 * 1024 * 1024) return false;
    total += size; if (total > 50 * 1024 * 1024) return false;
    const nameStart: number = cursor + 46, next: number = nameStart + nameLength + extraLength + commentLength;
    if (next > bytes.length) return false;
    const name = new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLength));
    if (!name.endsWith("/") && !name.endsWith("\\")) hasFile = true;
    cursor = next;
  }
  return hasFile;
};
const mediaMime = (bytes: Uint8Array): string | null => imageMime(bytes) ?? (zipIsValid(bytes) ? "application/zip" : null);

// Dev-only speed bump. The real guest SQL enforcement is the sqlite3
// authorizer + read-only checks in the native host (SlopStorage.swift).
const forbiddenSQL = /\b(attach|detach|load_extension)\b/i;

export function mockHostPlugin(dataRoot: string): Plugin {
  const storesRoot = join(dataRoot, "stores");
  const jsonPath = join(storesRoot, "data.json");
  const sqlitePath = join(storesRoot, "data.sqlite");
  const mediaRoot = join(storesRoot, "media");
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
  // Stat first, hash only when mtime/size changed: revision endpoints are
  // polled continuously and the SQLite db + WAL can be large.
  const revisionCache = new Map<string, { statKey: string; revision: string | null }>();
  const fileRevision = async (paths: string[]): Promise<string | null> => {
    const stats = await Promise.all(paths.map(async (path) => { try { return await stat(path); } catch { return null; } }));
    const statKey = stats.map((entry) => entry ? `${entry.mtimeMs}:${entry.size}` : "missing").join("|");
    const cacheKey = paths.join("|");
    const cached = revisionCache.get(cacheKey);
    if (cached && cached.statKey === statKey) return cached.revision;
    const hash = createHash("sha256"); let found = false;
    for (const path of paths) if (await exists(path)) { found = true; hash.update(new Uint8Array(await Bun.file(path).arrayBuffer())); }
    const value = found ? hash.digest("hex") : null;
    revisionCache.set(cacheKey, { statKey, revision: value });
    return value;
  };
  const mediaRevision = async (): Promise<string | null> => {
    const glob = new Bun.Glob("*");
    const names: string[] = [];
    try { for await (const name of glob.scan({ cwd: mediaRoot, onlyFiles: true })) names.push(name); } catch { return null; }
    if (names.length === 0) return null;
    const hash = createHash("sha256");
    for (const name of names.sort()) { hash.update(name); hash.update(new Uint8Array(await Bun.file(join(mediaRoot, name)).arrayBuffer())); }
    return hash.digest("hex");
  };
  const assertSQL = (sql: string) => { if (forbiddenSQL.test(sql)) throw new Error("SQLite statement is not allowed"); };
  return { name: "hitslop-mock-host", transformIndexHtml: { order: "pre", handler: injectHost }, configureServer(server) {
    server.httpServer?.once("close", () => { database?.close(); database = undefined; });
    server.middlewares.use("/media", async (request, response) => {
      try {
        const name = mediaName(decodeURIComponent(new URL(`http://localhost${request.url}`).pathname.replace(/^\/+/, "")));
        const bytes = new Uint8Array(await readFile(join(mediaRoot, name)));
        const mime = mediaMime(bytes); if (!mime) throw new Error("Invalid media");
        response.setHeader("content-type", mime); response.setHeader("cache-control", "no-store"); response.end(bytes);
      } catch { response.statusCode = 404; response.end(); }
    });
    server.middlewares.use("/__hitslop", async (nodeRequest, response) => {
      response.setHeader("content-type", "application/json");
      try {
        const body = await readNodeBody(nodeRequest);
        // Connect removes a mounted middleware prefix before invoking its
        // handler. Keep accepting the full path as well so the bridge behaves
        // consistently in tests and alternate Vite middleware stacks.
        const route = new URL(`http://localhost${nodeRequest.url}`).pathname
          .replace(/^\/+/, "")
          .replace(/^__hitslop\//, "");
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
        if (route === "media/revision") { response.end(JSON.stringify({ revision: await mediaRevision() })); return; }
        if (route === "media/open") {
          const path = join(mediaRoot, mediaName(body.name));
          if (!await exists(path)) { response.end(JSON.stringify({ exists: false, revision: null })); return; }
          const bytes = new Uint8Array(await readFile(path));
          response.end(JSON.stringify({ exists: true, revision: revision(bytes) })); return;
        }
        if (route === "media/write") {
          const name = mediaName(body.name), bytes = Uint8Array.from(Buffer.from(String(body.data ?? ""), "base64"));
          if (!mediaMime(bytes)) throw new Error("Selected file is not supported media");
          await mkdir(mediaRoot, { recursive: true });
          const path = join(mediaRoot, name), temporary = join(mediaRoot, `.${name}.${randomUUID()}.tmp`);
          await writeFile(temporary, bytes); await rename(temporary, path);
          response.end(JSON.stringify({ revision: revision(bytes) })); return;
        }
        if (route === "media/remove") {
          const path = join(mediaRoot, mediaName(body.name));
          try { await unlink(path); } catch (error) { if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error; }
          response.end(JSON.stringify({ revision: null })); return;
        }
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
  // Let Vite choose its normal development port (and increment it when busy).
  // Vite 8 treats an explicit port of 0 as a literal port and can report it as
  // already in use instead of asking the operating system for an ephemeral one.
  const server = await createServer({ root, plugins: [mockHostPlugin(dataRoot)] }); await server.listen();
  const url = server.resolvedUrls?.local[0]; if (!url) throw new Error("Vite did not expose a development URL");
  console.log(`hitSlop dev: ${url}`);
  if (options.native) await runNative(["open-dev", url, "--width", String(manifest.presentation.width), "--height", String(manifest.presentation.height)]);
  else if (process.platform === "darwin") Bun.spawn(["open", url], { stdout: "ignore", stderr: "ignore" });
}

export async function runNative(arguments_: string[]): Promise<void> {
  const override = process.env.HITSLOP_NATIVE_CLI;
  const arch = process.arch === "arm64" ? "arm64-apple-macosx" : "x86_64-apple-macosx";
  const repoDebugBin = resolve(import.meta.dir, `../../../apps/apple/Packages/HitSlopApple/.build/${arch}/debug/hitslop-native`);
  const repoReleaseBin = resolve(import.meta.dir, `../../../apps/apple/Packages/HitSlopApple/.build/${arch}/release/hitslop-native`);
  const candidates = [override, "/Applications/hitSlop.app/Contents/Helpers/hitslop-native", `${process.env.HOME}/Applications/hitSlop.app/Contents/Helpers/hitslop-native`, repoDebugBin, repoReleaseBin, "hitslop-native"].filter(Boolean) as string[];
  for (const executable of candidates) {
    try {
      const processResult = Bun.spawn([executable, ...arguments_], { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
      const status = await processResult.exited; if (status === 0) return; if (executable === candidates.at(-1)) throw new Error(`hitslop-native failed with status ${status}`);
    } catch (error) { if (executable === candidates.at(-1)) throw error; }
  }
  throw new Error("Install hitSlop or set HITSLOP_NATIVE_CLI to use native rendering.");
}

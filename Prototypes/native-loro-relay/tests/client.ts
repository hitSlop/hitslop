import { createHmac, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { resolve } from "node:path";

export const repository = resolve(import.meta.dir, "../../..");
export const artifacts = resolve(repository, ".hitslop/native-loro/results-v2");
export async function secret() {
  const path = resolve(repository, ".hitslop/native-loro/relay-secret.json");
  await mkdir(resolve(repository, ".hitslop/native-loro"), { recursive: true });
  try { return JSON.parse(await readFile(path, "utf8")).key as string; }
  catch (e: any) { if (e.code !== "ENOENT") throw e; }
  const key = randomBytes(32).toString("hex");
  await writeFile(path, JSON.stringify({ key }), { mode: 0o600 }); await chmod(path, 0o600);
  return key;
}
export function token(key: string, room: string, user: string, owner = false, exp = Math.floor(Date.now() / 1000) + 3600) {
  const payload = Buffer.from(JSON.stringify({ room, user, owner, exp })).toString("base64url");
  return payload + "." + createHmac("sha256", key).update(payload).digest("base64url");
}
export async function api(endpoint: string, room: string, credential: string, method: string, path = "", body?: unknown) {
  const response = await fetch(`${endpoint}/rooms/${room}${path}`, { method,
    headers: { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const value = await response.json() as any;
  if (!response.ok) throw new Error(`${response.status}: ${value.error}`);
  return value;
}
export const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
export async function until(predicate: () => Promise<boolean>, description: string, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await predicate()) return; await sleep(50); }
  throw new Error(`Timed out: ${description}`);
}
export class RelaySocket {
  readonly ws: WebSocket;
  readonly messages: any[] = [];
  closed = false;
  closeDetails?: { code: number; reason: string };
  private constructor(endpoint: string, room: string, credential: string, after: number, readonly autoApply: boolean, hello: object = {}) {
    this.ws = new WebSocket(`${endpoint.replace(/^http/, "ws")}/rooms/${room}/socket`, { headers: { Authorization: `Bearer ${credential}` } });
    this.ws.onopen = () => this.send({ type: "hello", after, ...hello });
    this.ws.onmessage = event => {
      const message = JSON.parse(String(event.data)); this.messages.push(message);
      if (["snapshot", "update"].includes(message.type) && autoApply) this.send({ type: "applied", sequence: message.sequence });
    };
    this.ws.onclose = event => { this.closed = true; this.closeDetails = { code: event.code, reason: event.reason }; };
    this.ws.onerror = () => { this.closed = true; };
  }
  static async open(endpoint: string, room: string, credential: string, after = 0, autoApply = true, hello: object = {}) {
    const result = new RelaySocket(endpoint, room, credential, after, autoApply, hello);
    await result.wait("welcome"); return result;
  }
  send(value: unknown) { this.ws.send(JSON.stringify(value)); }
  async wait(type: string, predicate: (message: any) => boolean = () => true, timeout = 15000) {
    let found: any;
    await until(async () => {
      const index = this.messages.findIndex(m => m.type === type && predicate(m));
      if (index < 0) return false;
      found = this.messages.splice(index, 1)[0]; return true;
    }, `relay ${type}`, timeout);
    return found;
  }
  close() { this.ws.close(); }
}

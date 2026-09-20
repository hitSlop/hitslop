import { readFile, realpath, unlink, lstat, readdir } from "node:fs/promises";
import { join } from "node:path";
import { Document, type Operation } from "../../document/src/document";
import { SQLiteStore } from "../../document/src/sqlite";
import { fromDescriptor, schemaKey } from "../../document/src/schema";
import { callHost } from "../../document/src/client";
import { parseManifest } from "@hitslop/schema";
import { homedir } from "node:os";
async function validateFiles(root: string) {
  for (const name of await readdir(root)) {
    const path = join(root, name),
      info = await lstat(path);
    if (info.isSymbolicLink()) throw new Error("Package contains symbolic links");
    if (info.isDirectory()) await validateFiles(path);
  }
}
export async function runDevelopmentDocumentCommand(command: string, target: string, rest: string[]) {
  const mutation = ["apply", "batch", "compact"].includes(command);
  const accepted = new Set(mutation ? ["--id", "--epoch"] : []);
  if (command === "apply") accepted.add("--op");
  if (command === "batch") accepted.add("--ops");
  const values = new Map<string, string>();
  for (let i = 0; i < rest.length; i += 2) {
    const name = rest[i]!, value = rest[i + 1];
    if (!accepted.has(name) || values.has(name)) throw new Error(`Unknown or repeated option: ${name}`);
    if (!value || value.startsWith("--")) throw new Error(`Missing ${name}`);
    values.set(name, value);
  }
  const flag = (name: string) => values.get(name);
  const required = (name: string) => {
    const value = flag(name);
    if (value === undefined) throw new Error(`Missing ${name}`);
    return value;
  };
  if ((flag("--id") === undefined) !== (flag("--epoch") === undefined))
    throw new Error("Provide --id and --epoch together, or omit both");
  if ([flag("--id"), flag("--epoch")].some(value => value !== undefined && value.length > 128))
    throw new Error("Retry identity is too long");
  const root = await realpath(target);
  await validateFiles(root);
  const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
  if (manifest.runtime !== "hitslop-v1")
    throw new Error("Unsupported package runtime; create a fresh v1 document");
  parseManifest(manifest);
  const definition = fromDescriptor(
    JSON.parse(await readFile(join(root, "state.schema.json"), "utf8")),
  );
  if (command === "schema") {
    console.log(JSON.stringify(definition.descriptor, null, 2));
    return;
  }
  if (root.startsWith(join(homedir(), ".hitslop/templates") + "/"))
    throw new Error("Copy the immutable template master to a writable document first");
  const initial = JSON.parse(await readFile(join(root, "initial.json"), "utf8"));
  let op: Operation | undefined;
  let ops: Operation[] | undefined;
  switch (command) {
    case "get":
    case "schema":
    case "compact":
      break;
    case "apply":
      op = JSON.parse(required("--op"));
      break;
    case "batch":
      ops = JSON.parse(required("--ops"));
      break;
    default:
      throw new Error("Commands: get, schema, apply --op JSON, batch --ops JSON, compact");
  }
  if (command === "apply" && (!op || typeof op !== "object" || Array.isArray(op)))
    throw new Error("Expected operation object");
  if (command === "batch" && !Array.isArray(ops)) throw new Error("Expected operations array");
  let storage: SQLiteStore;
  try {
    storage = await SQLiteStore.open(root);
  } catch (error) {
    if ((error as any).code !== "writer_busy") throw error;
    const discovery = JSON.parse(
      await readFile(join(root, "state/host.lock"), "utf8").catch(() => {
        throw new Error("Document has a live writer but no ready host; retry shortly");
      }),
    );
    if (typeof discovery.socket !== "string" || discovery.documentPath !== root)
      throw new Error("Invalid host discovery; refusing direct writes");
    const base = { documentPath: root, schemaHash: schemaKey(definition.descriptor) };
    const requestId = flag("--id") ?? crypto.randomUUID();
    let epoch = flag("--epoch");
    if (mutation && !epoch) {
      const handshake = await callHost(discovery.socket, { ...base, id: crypto.randomUUID(), method: "hello" });
      if (!handshake.ok) throw new Error(handshake.error);
      epoch = handshake.epoch;
    }
    const request = { ...base, id: requestId, epoch, method: op ? "apply" : command, op, ops };
    let reply;
    try {
      reply = await callHost(discovery.socket, request);
    } catch (error) {
      throw new Error(`${error}${mutation ? `\nRetry identity: --id ${requestId} --epoch ${epoch}` : ""}`);
    }
    if (!reply.ok)
      throw new Error(`${reply.error}${mutation && reply.retryable ? `\nRetry identity: --id ${requestId} --epoch ${epoch}` : ""}`);
    console.log(JSON.stringify(command === "schema" ? reply.schema : reply.state, null, 2));
    return;
  }
  // Only a successfully acquired OS lock permits stale discovery cleanup.
  try {
    await unlink(join(root, "state/host.lock"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      await storage.close();
      throw error;
    }
  }
  if (flag("--epoch") || flag("--id")) {
    await storage.close();
    throw new Error("Previous live session ended; inspect state before issuing a new command");
  }
  const doc = await Document.open(definition, storage, initial);
  try {
    if (op) doc.apply(op);
    if (ops) doc.applyAll(ops);
    if (command === "compact") await doc.compact();
    else await doc.flush();
    console.log(
      JSON.stringify(command === "schema" ? definition.descriptor : doc.current, null, 2),
    );
  } finally {
    await doc.close();
  }
}

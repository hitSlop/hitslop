import { readFile, mkdir, rename, rm, open, realpath } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import type { SyncCommit, SyncSnapshot } from "@hitslop/schema/sync";
import type { DocumentIO } from "./document.js";

const stateFiles = ["state/identity.json", "state/checkpoint.loro", "state/materialization.json"] as const;
const projectionFile = "stores/data.json";
const pendingFile = "state/journal/pending.json";
const hash = (bytes: Uint8Array | null): string | null => bytes === null ? null : createHash("sha256").update(bytes).digest("hex");
const read = async (path: string): Promise<Buffer | null> => {
  try { return await readFile(path); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
};
const queues = new Map<string, Promise<unknown>>();
async function serial<T>(root: string, work: () => Promise<T>): Promise<T> {
  const task = (queues.get(root) ?? Promise.resolve()).catch(() => {}).then(work);
  queues.set(root, task);
  try { return await task; } finally { if (queues.get(root) === task) queues.delete(root); }
}
async function canonicalPath(path: string): Promise<string> {
  try { return await realpath(path); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return join(await canonicalPath(dirname(path)), path.slice(dirname(path).length));
  }
}
export type PendingCommit = { format: 2; files: { path: string; before: string | null; after: string }[] };

/** Byte-only journal protocol shared with the native host. No CRDT interpretation. */
export class FileDocumentIO implements DocumentIO {
  private constructor(readonly root: string, private readonly afterReplace?: (path: string) => void) {}
  static async at(root: string, afterReplace?: (path: string) => void): Promise<FileDocumentIO> {
    return new FileDocumentIO(await canonicalPath(resolve(root)), afterReplace);
  }
  private async flushDirectory(path: string) {
    const fd = await open(path, "r"); try { await fd.sync(); } finally { await fd.close(); }
  }
  private async replace(path: string, data: Uint8Array): Promise<void> {
    const directory = join(this.root, dirname(path));
    await mkdir(directory, { recursive: true });
    const temporary = join(this.root, "state/journal", `${crypto.randomUUID()}.tmp`);
    const fd = await open(temporary, "wx");
    try { await fd.writeFile(data); await fd.sync(); } finally { await fd.close(); }
    await rename(temporary, join(this.root, path));
    await this.flushDirectory(directory);
    this.afterReplace?.(path);
  }
  private async snapshot(): Promise<SyncSnapshot> {
    const values = await Promise.all([...stateFiles, projectionFile].map(path => read(join(this.root, path))));
    const generation = hash(Buffer.from(values.slice(0, 3).map(hash).map(x => x ?? "-").join("\n")))!;
    return { identity: values[0]?.toString("base64") ?? null, checkpoint: values[1]?.toString("base64") ?? null,
      metadata: values[2]?.toString("base64") ?? null, external: values[3]?.toString("base64") ?? null,
      generation, externalHash: hash(values[3]!) };
  }
  private async recover(): Promise<void> {
    const bytes = await read(join(this.root, pendingFile));
    if (!bytes) return;
    const pending = JSON.parse(bytes.toString()) as PendingCommit;
    if (pending.format !== 2 || !Array.isArray(pending.files) || pending.files.length < 3 || new Set(pending.files.map(x => x.path)).size !== pending.files.length || !stateFiles.every(path => pending.files.some(x => x.path === path))) throw new Error("Invalid pending journal");
    for (const file of pending.files) {
      if (![...stateFiles, projectionFile].includes(file.path as typeof projectionFile) || typeof file.after !== "string" || !(file.before === null || typeof file.before === "string" && /^[a-f0-9]{64}$/.test(file.before))) throw new Error("Invalid pending journal entry");
      const current = hash(await read(join(this.root, file.path)));
      if (current !== file.before && current !== hash(Buffer.from(file.after, "base64"))) throw new Error("External edits block journal recovery; files preserved");
    }
    for (const file of pending.files) {
      const after = Buffer.from(file.after, "base64");
      if (hash(await read(join(this.root, file.path))) !== hash(after)) await this.replace(file.path, after);
    }
    await rm(join(this.root, pendingFile));
    await this.flushDirectory(join(this.root, "state/journal"));
  }
  open(): Promise<SyncSnapshot> { return serial(this.root, async () => { await this.recover(); return this.snapshot(); }); }
  commit(commit: SyncCommit): Promise<SyncSnapshot> {
    return serial(this.root, async () => {
      if (await read(join(this.root, pendingFile))) throw new Error("Recover the pending journal before saving");
      const before = await this.snapshot();
      if (before.generation !== commit.expectedGeneration || before.externalHash !== commit.expectedExternal) throw Object.assign(new Error("Document changed on disk; retry with current file contents"), { code: "revision_conflict" });
      await mkdir(join(this.root, "state/journal"), { recursive: true });
      await mkdir(join(this.root, "stores"), { recursive: true });
      await this.flushDirectory(this.root); await this.flushDirectory(join(this.root, "state"));
      if (commit.preserveExternal && before.external !== null && commit.projection !== undefined) {
        await this.replace(`state/journal/recovery-${crypto.randomUUID()}.json`, Buffer.from(before.external, "base64"));
      }
      const paths: string[] = [...stateFiles];
      const after = [commit.identity, commit.checkpoint, commit.metadata];
      if (commit.projection !== undefined) { paths.push(projectionFile); after.push(commit.projection); }
      const observed = [before.identity, before.checkpoint, before.metadata, before.external];
      const files = paths.map((path, i) => ({ path, before: observed[i] === null ? null : hash(Buffer.from(observed[i]!, "base64")), after: after[i]! }));
      await this.replace(pendingFile, Buffer.from(JSON.stringify({ format: 2, files } satisfies PendingCommit)));
      await this.recover();
      return this.snapshot();
    });
  }
}

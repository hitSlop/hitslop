import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { digest, repository } from "../v1/runtime-artifacts";
import plugin from "./plugin.cjs";

export const slugs: string[] = plugin.slugs;
export const output = join(repository, "generated/nx-pilot");
export function slugArgument() {
  const slug = process.argv[2];
  if (!slug || !slugs.includes(slug)) throw new Error("Expected an enabled pilot slug");
  return slug;
}
export async function seal(directory: string) {
  await writeFile(join(directory, "sha256.json"), JSON.stringify(await digest(join(directory, "package.slop"))));
}
export async function verifySeal(directory: string) {
  const expected = JSON.parse(await readFile(join(directory, "sha256.json"), "utf8"));
  if (expected !== await digest(join(directory, "package.slop")))
    throw new Error(`Pilot package checksum mismatch: ${directory}`);
}
// Outside cached outputs: a cache hit must never replay an execution event.
export async function executed(task: string, started: number) {
  await mkdir(output, { recursive: true });
  await appendFile(join(output, "executions.jsonl"), JSON.stringify({ task, milliseconds: performance.now() - started }) + "\n");
}

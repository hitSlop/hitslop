import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { $ } from "bun";

const root = resolve(import.meta.dir, "../../..");
const schema = resolve(root, "packages/schema/generated/manifest.schema.json");
const swift = resolve(root, "apps/macos/packages/HitSlopCore/Sources/HitSlopCore/Generated/SlopManifest.generated.swift");
const beforeSchema = await readFile(schema, "utf8");
const beforeSwift = await readFile(swift, "utf8");
await $`bun run --cwd ${resolve(root, "packages/schema")} generate`.quiet();
if (beforeSchema !== await readFile(schema, "utf8") || beforeSwift !== await readFile(swift, "utf8")) {
  throw new Error("Generated schema or Swift models are stale. Run `bun run schema:generate`.");
}

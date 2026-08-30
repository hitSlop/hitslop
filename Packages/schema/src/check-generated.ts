import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { $ } from "bun";

const root = resolve(import.meta.dir, "../../..");
const generatedFiles = [
  "packages/schema/generated/manifest.schema.json",
  "packages/schema/generated/local-template-install.schema.json",
  "apps/macos/packages/HitSlopCore/Sources/HitSlopCore/Generated/SlopManifest.generated.swift",
  "apps/macos/packages/HitSlopCore/Sources/HitSlopCore/Generated/LocalTemplateInstall.generated.swift",
].map((path) => resolve(root, path));
const before = await Promise.all(generatedFiles.map((path) => readFile(path, "utf8")));
await $`bun run --cwd ${resolve(root, "packages/schema")} generate`.quiet();
const after = await Promise.all(generatedFiles.map((path) => readFile(path, "utf8")));
if (before.some((contents, index) => contents !== after[index])) {
  throw new Error("Generated schema or Swift models are stale. Run `bun run schema:generate`.");
}

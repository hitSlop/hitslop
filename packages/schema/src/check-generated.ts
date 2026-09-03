import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { $ } from "bun";

const root = resolve(import.meta.dir, "../../..");
const generatedFiles = [
  "packages/schema/generated/manifest.schema.json",
  "apps/apple/Packages/HitSlopApple/Sources/HitSlopCore/Generated/SlopManifest.generated.swift",
  "apps/apple/Packages/HitSlopApple/Sources/HitSlopCore/Resources/manifest.schema.json",
  "apps/apple/Packages/HitSlopApple/Sources/HitSlopCore/Resources/hitslop-document.SKILL.md",
  "apps/api/public/schemas/v1/manifest.schema.json",
].map((path) => resolve(root, path));
const before = await Promise.all(generatedFiles.map((path) => readFile(path, "utf8")));
await $`bun run --cwd ${resolve(root, "packages/schema")} generate`.quiet();
const after = await Promise.all(generatedFiles.map((path) => readFile(path, "utf8")));
if (before.some((contents, index) => contents !== after[index])) {
  throw new Error("Generated schema or Swift models are stale. Run `bun run schema:generate`.");
}

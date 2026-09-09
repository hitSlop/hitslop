import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { $ } from "bun";

const root = resolve(import.meta.dir, "../../..");
const generatedFiles = [
  "packages/schema/generated/manifest.schema.json",
  "apps/apple/Packages/HitSlopApple/Sources/HitSlopCore/Generated/SlopManifest.generated.swift",
  "apps/apple/Packages/HitSlopApple/Sources/HitSlopCore/Resources/manifest.schema.json",
  "apps/apple/Packages/HitSlopApple/Sources/HitSlopCore/Resources/hitslop-document.SKILL.md",
  "apps/firebase/public/schemas/v1/manifest.schema.json",
  "packages/schema/generated/bridge-request.schema.json",
  "apps/apple/Packages/HitSlopApple/Sources/HitSlopRuntime/Resources/bridge-request.schema.json",
  "apps/apple/Packages/HitSlopApple/Sources/HitSlopRuntime/Resources/host-bridge.js",
  "apps/apple/Packages/HitSlopApple/Sources/HitSlopRuntime/BridgeContract.generated.swift",
];
const temporary = await mkdtemp(resolve(tmpdir(), "hitslop-generated-"));
try {
  await $`bun run --cwd ${resolve(root, "packages/schema")} generate`.env({ ...process.env, HITSLOP_GENERATED_ROOT: temporary }).quiet();
  const changed = [];
  for (const path of generatedFiles) {
    const [before, after] = await Promise.all([readFile(resolve(root, path), "utf8"), readFile(resolve(temporary, path), "utf8")]);
    if (before !== after) changed.push(path);
  }
  if (changed.length) throw new Error(`Generated files are stale: ${changed.join(", ")}. Run bun run schema:generate.`);
} finally { await rm(temporary, { recursive: true, force: true }); }

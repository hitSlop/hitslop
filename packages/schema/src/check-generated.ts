import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { $ } from "bun";

const root = resolve(import.meta.dir, "../../..");
const generatedFiles = [
  "apps/apple/Packages/HitSlopApple/Tests/HitSlopRuntimeTests/Fixtures/native-engine.json",
  "apps/apple/Packages/HitSlopApple/Sources/HitSlopDocumentEngine/Resources/document-engine.js",
  "apps/apple/Packages/HitSlopApple/Tests/HitSlopRuntimeTests/Fixtures/document-ops.json",
  "apps/apple/Packages/HitSlopApple/Tests/HitSlopRuntimeTests/Fixtures/room-wire.json",
  "packages/schema/generated/room-message.schema.json",
  "packages/schema/generated/room-client-message.schema.json",
  "packages/api/generated/openapi.json",
  "apps/apple/Packages/HitSlopApple/Sources/HitSlopAPI/openapi.json",
  "packages/schema/generated/manifest.schema.json",
  "apps/apple/Packages/HitSlopApple/Sources/HitSlopCore/Generated/SlopManifest.generated.swift",
  "apps/cloudflare/public/schemas/v1/manifest.schema.json",
  "packages/schema/generated/bridge-request.schema.json",
  "apps/apple/Packages/HitSlopApple/Sources/HitSlopRuntime/Resources/host-bridge.js",
  "apps/apple/Packages/HitSlopApple/Sources/HitSlopRuntime/BridgeContract.generated.swift",
];
const generatedTrees = [
  "packages/cli/skills",
  "apps/apple/Packages/HitSlopApple/Sources/HitSlopCore/Resources/skills",
];

async function relativeFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  const walk = async (current: string, prefix: string): Promise<void> => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(join(current, entry.name), relative);
      else files.push(relative);
    }
  };
  await walk(directory, "");
  return files.sort();
}

const temporary = await mkdtemp(resolve(tmpdir(), "hitslop-generated-"));
try {
  await $`bun run --cwd ${root} schema:generate`
    .env({ ...process.env, HITSLOP_GENERATED_ROOT: temporary })
    .quiet();
  const changed = [];
  for (const path of generatedFiles) {
    const [before, after] = await Promise.all([
      readFile(resolve(root, path), "utf8"),
      readFile(resolve(temporary, path), "utf8"),
    ]);
    if (before !== after) changed.push(path);
  }
  for (const tree of generatedTrees) {
    const beforeFiles = await relativeFiles(resolve(root, tree));
    const afterFiles = await relativeFiles(resolve(temporary, tree));
    if (beforeFiles.join("\n") !== afterFiles.join("\n")) {
      changed.push(tree);
      continue;
    }
    for (const file of beforeFiles) {
      const [before, after] = await Promise.all([
        readFile(resolve(root, tree, file), "utf8"),
        readFile(resolve(temporary, tree, file), "utf8"),
      ]);
      if (before !== after) changed.push(join(tree, file));
    }
  }
  if (changed.length)
    throw new Error(
      `Generated files are stale: ${changed.join(", ")}. Run bun run schema:generate.`,
    );
} finally {
  await rm(temporary, { recursive: true, force: true });
}

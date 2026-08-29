import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { $ } from "bun";
import { z } from "zod";
import { SlopManifestSchema } from "./manifest.ts";

const packageRoot = resolve(import.meta.dir, "..");
const repositoryRoot = resolve(packageRoot, "../..");
const generated = resolve(packageRoot, "generated");
const swiftOutput = resolve(repositoryRoot, "apps/macos/packages/HitSlopCore/Sources/HitSlopCore/Generated/SlopManifest.generated.swift");
await mkdir(generated, { recursive: true });
await mkdir(resolve(swiftOutput, ".."), { recursive: true });

const schema = z.toJSONSchema(SlopManifestSchema, { target: "draft-7", reused: "ref" });
Object.assign(schema, {
  $id: "https://hitslop.app/schemas/manifest.schema.json",
  title: "hitSlop manifest",
  description: "The framework-neutral manifest for hitslop/1 web documents.",
});
const schemaPath = resolve(generated, "manifest.schema.json");
await writeFile(schemaPath, `${JSON.stringify(schema, null, 2)}\n`);
await $`bunx quicktype --src-lang schema --lang swift --top-level SlopManifest --access-level public --src ${schemaPath} --out ${swiftOutput}`;

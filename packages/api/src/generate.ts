import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { generateOpenAPI } from "./openapi.js";

const root = process.env.HITSLOP_GENERATED_ROOT ?? resolve(import.meta.dir, "../../..");
const contents = JSON.stringify(await generateOpenAPI(), null, 2) + "\n";
for (const path of [
  "packages/api/generated/openapi.json",
  "deferred/apple/local-release/Sources/HitSlopAPI/openapi.json",
]) {
  const file = resolve(root, path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, contents);
}

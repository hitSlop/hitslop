import { cp, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { dataSchemaFromJSON } from "./data.ts";
import { RoomMessageSchema, RoomClientMessageSchema } from "./room.ts";
import { generateSkills } from "./generation/skills.ts";
import { generateBridge } from "./generation/bridge.ts";
import { generateModels } from "./generation/models.ts";

const sourceRoot = resolve(import.meta.dir, "../../..");
const root = process.env.HITSLOP_GENERATED_ROOT ?? sourceRoot;
const generated = resolve(root, "packages/schema/generated");
await mkdir(generated, { recursive: true });
await generateSkills(root, sourceRoot, generated);
await generateBridge(root, sourceRoot, generated);
await generateModels(root, sourceRoot, generated);
for (const [name, schema] of [
  ["room-message", RoomMessageSchema],
  ["room-client-message", RoomClientMessageSchema],
] as const) {
  await writeFile(
    resolve(generated, `${name}.schema.json`),
    JSON.stringify(dataSchemaFromJSON(schema), null, 2) + "\n",
  );
}

const fixtures = resolve(
  root,
  "apps/apple/Packages/HitSlopApple/Tests/HitSlopRuntimeTests/Fixtures",
);
await mkdir(fixtures, { recursive: true });
await cp(
  resolve(sourceRoot, "packages/schema/tests/fixtures/room-wire.json"),
  resolve(fixtures, "room-wire.json"),
);

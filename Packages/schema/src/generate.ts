import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { $ } from "bun";
import { z } from "zod";
import { SlopManifestSchema } from "./manifest.ts";
import { LocalTemplateInstallSchema } from "./install.ts";

const packageRoot = resolve(import.meta.dir, "..");
const repositoryRoot = resolve(packageRoot, "../..");
const generated = resolve(packageRoot, "generated");
await mkdir(generated, { recursive: true });

await generate({
  zodSchema: SlopManifestSchema,
  schemaName: "manifest.schema.json",
  swiftName: "SlopManifest.generated.swift",
  id: "https://hitslop.app/schemas/manifest.schema.json",
  title: "SlopManifest",
  description: "The framework-neutral manifest for hitSlop web documents.",
  transformSwift: renameGeneratedTypes,
  transformSchema: stampUniqueItems,
});

await generate({
  zodSchema: LocalTemplateInstallSchema,
  schemaName: "local-template-install.schema.json",
  swiftName: "LocalTemplateInstall.generated.swift",
  id: "https://hitslop.app/schemas/local-template-install.schema.json",
  title: "LocalTemplateInstall",
  description: "Local catalog metadata for an explicitly installed hitSlop template.",
  transformSwift: addSendable,
});

async function generate(options: {
  zodSchema: z.ZodType;
  schemaName: string;
  swiftName: string;
  id: string;
  title: string;
  description: string;
  transformSchema?: (node: unknown, root: Record<string, unknown>) => void;
  transformSwift?: (source: string) => string;
}): Promise<void> {
  const schema = z.toJSONSchema(options.zodSchema, { target: "draft-7", reused: "ref", io: "input" }) as Record<string, unknown>;
  Object.assign(schema, { $id: options.id, title: options.title, description: options.description });
  options.transformSchema?.(schema, schema);
  const schemaPath = resolve(generated, options.schemaName);
  const swiftOutput = resolve(repositoryRoot, "apps/macos/packages/HitSlopCore/Sources/HitSlopCore/Generated", options.swiftName);
  await mkdir(resolve(swiftOutput, ".."), { recursive: true });
  await writeFile(schemaPath, `${JSON.stringify(schema, null, 2)}\n`);
  await $`bunx quicktype --src-lang schema --lang swift --top-level ${options.title} --access-level public --src ${schemaPath} --out ${swiftOutput}`;
  const generatedSwift = stripQuicktypeHelpers(await Bun.file(swiftOutput).text());
  await Bun.write(swiftOutput, options.transformSwift ? options.transformSwift(generatedSwift) : generatedSwift);
}

function stampUniqueItems(node: unknown, root: Record<string, unknown>): void {
  if (!node || typeof node !== "object") return;
  const record = node as Record<string, unknown>;
  if (record.type === "array" && (record.maxItems === 2 || record.maxItems === 8) && !("uniqueItems" in record)) {
    record.uniqueItems = true;
  }
  const resolved = resolveRef(record, root);
  if (resolved && resolved !== record) stampUniqueItems(resolved, root);
  for (const value of Object.values(record)) {
    if (value !== root) stampUniqueItems(value, root);
  }
}

function resolveRef(property: Record<string, unknown>, root: Record<string, unknown>): Record<string, unknown> | undefined {
  const ref = property.$ref;
  if (typeof ref !== "string" || !ref.startsWith("#/")) return undefined;
  let current: unknown = root;
  for (const part of ref.slice(2).split("/")) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current && typeof current === "object" ? current as Record<string, unknown> : undefined;
}

function renameGeneratedTypes(source: string): string {
  const shapeKind = source.match(/public enum (Schema\d*): String, Codable \{\n    case capsule/)?.[1];
  const shape = source.match(/\/\/ MARK: - (Schema\d+)\npublic struct Schema\d+: Codable \{\n    public let kind:/)?.[1];
  const document = source.match(/\/\/ MARK: - (Schema\d+)\npublic struct Schema\d+: Codable \{\n    public let id: String\n    public let template:/)?.[1];
  const lineage = source.match(/\/\/ MARK: - (Schema\d+)\npublic struct Schema\d+: Codable \{\n    public let artifactSha256:/)?.[1];
  let next = source;
  if (shape) next = next.replaceAll(shape, "SlopWindowShape");
  if (shapeKind) next = next.replaceAll(shapeKind, "SlopWindowShapeKind");
  if (document) next = next.replaceAll(document, "SlopDocument");
  if (lineage) next = next.replaceAll(lineage, "SlopTemplateLineage");
  return next
    .replaceAll(": Codable {", ": Codable, Sendable {")
    .replaceAll(": String, Codable {", ": String, Codable, Sendable {");
}

function addSendable(source: string): string {
  return source
    .replaceAll(": Codable {", ": Codable, Sendable {")
    .replaceAll(": String, Codable {", ": String, Codable, Sendable {");
}

function stripQuicktypeHelpers(source: string): string {
  const withoutBanner = source.replace(/^\/\/ This file was generated[\s\S]*?(?=import Foundation)/, "");
  const withoutHelpers = withoutBanner
    .replace(/\n\/\/ MARK: .* convenience initializers and mutators[\s\S]*?(?=\n(\/\/ MARK: |public (?:struct|enum|func)|$))/g, "\n")
    .replace(/\n\/\/ MARK: - Helper functions[\s\S]*$/, "\n");
  return `// Generated by bun run schema:generate. Do not edit.\n${withoutHelpers.trim()}\n`;
}

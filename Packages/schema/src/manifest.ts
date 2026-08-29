import { z } from "zod";

const relativePath = z.string().min(1).max(240)
  .regex(/^[A-Za-z0-9._/-]+$/, "must contain only portable path characters")
  .refine((path) => !path.startsWith("/") && !path.split("/").includes(".."), "must be a safe relative path");

export const SlopStoreSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,31}$/),
  kind: z.enum(["json", "sqlite"]),
  path: relativePath,
  maxBytes: z.number().int().positive().max(1_073_741_824).optional(),
}).strict();

export const SlopWindowShapeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("capsule") }).strict(),
  z.object({ kind: z.literal("circle") }).strict(),
  z.object({ kind: z.literal("roundedRect"), radius: z.number().min(0).max(256) }).strict(),
]);

export const SlopManifestSchema = z.object({
  $schema: z.string().optional(),
  format: z.literal("hitslop/1"),
  runtime: z.literal("web"),
  slug: z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1).max(80),
  description: z.string().min(1).max(240),
  author: z.object({ name: z.string().min(1).max(80), url: z.string().url().optional() }).strict(),
  categories: z.array(z.string().min(1).max(40)).min(1).max(2),
  tags: z.array(z.string().min(1).max(32)).max(8).optional(),
  stores: z.array(SlopStoreSchema).max(16),
  window: z.object({
    width: z.number().int().min(240).max(4096),
    height: z.number().int().min(180).max(4096),
    resizable: z.boolean().default(true),
    shape: SlopWindowShapeSchema.optional(),
  }).strict(),
}).strict().superRefine((manifest, context) => {
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const [index, store] of manifest.stores.entries()) {
    if (ids.has(store.id)) context.addIssue({ code: "custom", path: ["stores", index, "id"], message: `duplicate store id ${store.id}` });
    if (paths.has(store.path)) context.addIssue({ code: "custom", path: ["stores", index, "path"], message: `duplicate store path ${store.path}` });
    ids.add(store.id);
    paths.add(store.path);
  }
  if (new Set(manifest.categories).size !== manifest.categories.length) context.addIssue({ code: "custom", path: ["categories"], message: "categories must be unique" });
  if (manifest.tags && new Set(manifest.tags).size !== manifest.tags.length) context.addIssue({ code: "custom", path: ["tags"], message: "tags must be unique" });
});

export const SlopDocumentProvenanceSchema = z.object({
  format: z.literal("hitslop-document/1"),
  id: z.string().uuid(),
  template: z.object({
    publisherKeyId: z.string().min(16).max(64),
    slug: z.string(),
    release: z.number().int().positive(),
    artifactSha256: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict().optional(),
}).strict();

export type SlopStore = z.infer<typeof SlopStoreSchema>;
export type SlopManifest = z.infer<typeof SlopManifestSchema>;
export type SlopDocumentProvenance = z.infer<typeof SlopDocumentProvenanceSchema>;
export const parseManifest = (input: unknown): SlopManifest => SlopManifestSchema.parse(input);

import { z } from "zod";

const uniqueStrings = (label: string) => (values: string[], context: z.RefinementCtx) => {
  if (new Set(values).size !== values.length) context.addIssue({ code: "custom", message: `${label} must be unique` });
};

const reservedStorePaths = new Set(["manifest.json", "document.json", "agents.md"]);

/** Portable package-relative path. Traversal and absolute paths are rejected in the regex so JSON Schema matches Zod. */
export const relativePath = z.string().min(1).max(240)
  .regex(
    /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/,
    "must be a safe relative path",
  )
  .refine((path) => !reservedStorePaths.has(path.toLowerCase()) && !path.toLowerCase().startsWith("build/"), "must not replace reserved package files");

export const SlopStoreKindSchema = z.enum(["json", "sqlite"]).meta({ id: "SlopStoreKind", title: "SlopStoreKind" });

export const SlopStoreSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,31}$/),
  kind: SlopStoreKindSchema,
  path: relativePath,
  maxBytes: z.number().int().positive().max(1_073_741_824).optional(),
}).strict().meta({ id: "SlopStore", title: "SlopStore" });

export const SlopWindowShapeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("capsule") }).strict().meta({ id: "SlopWindowShapeCapsule", title: "SlopWindowShapeCapsule" }),
  z.object({ kind: z.literal("circle") }).strict().meta({ id: "SlopWindowShapeCircle", title: "SlopWindowShapeCircle" }),
  z.object({ kind: z.literal("roundedRect"), radius: z.number().min(0).max(256) }).strict().meta({ id: "SlopWindowShapeRoundedRect", title: "SlopWindowShapeRoundedRect" }),
]).meta({ id: "SlopWindowShape", title: "SlopWindowShape" });

export const SlopAuthorSchema = z.object({
  name: z.string().min(1).max(80),
  url: z.string().url().optional(),
}).strict().meta({ id: "SlopAuthor", title: "SlopAuthor" });

export const SlopWindowSchema = z.object({
  width: z.number().int().min(240).max(4096),
  height: z.number().int().min(180).max(4096),
  resizable: z.boolean().optional(),
  shape: SlopWindowShapeSchema.optional(),
}).strict().meta({ id: "SlopWindow", title: "SlopWindow" });

export const SlopFormatSchema = z.literal("hitslop/1").meta({ id: "SlopFormat", title: "SlopFormat" });
export const SlopRuntimeSchema = z.literal("web").meta({ id: "SlopRuntime", title: "SlopRuntime" });

export const SlopManifestSchema = z.object({
  $schema: z.string().optional(),
  format: SlopFormatSchema,
  runtime: SlopRuntimeSchema,
  slug: z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1).max(80),
  description: z.string().min(1).max(240),
  author: SlopAuthorSchema,
  categories: z.array(z.string().min(1).max(40)).min(1).max(2).superRefine(uniqueStrings("categories")).meta({ id: "SlopCategories" }),
  tags: z.array(z.string().min(1).max(32)).max(8).superRefine(uniqueStrings("tags")).optional().meta({ id: "SlopTags" }),
  stores: z.array(SlopStoreSchema).max(16).superRefine((stores, context) => {
    const ids = new Set<string>();
    const paths = new Set<string>();
    for (const [index, store] of stores.entries()) {
      if (ids.has(store.id)) context.addIssue({ code: "custom", path: [index, "id"], message: `duplicate store id ${store.id}` });
      if (paths.has(store.path)) context.addIssue({ code: "custom", path: [index, "path"], message: `duplicate store path ${store.path}` });
      ids.add(store.id);
      paths.add(store.path);
    }
  }),
  window: SlopWindowSchema,
}).strict().meta({ id: "SlopManifest", title: "SlopManifest" });

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

import { z } from "zod";

const uniqueStrings = (label: string) => (values: string[], context: z.RefinementCtx) => {
  if (new Set(values).size !== values.length) context.addIssue({ code: "custom", message: `${label} must be unique` });
};

/** Portable package-relative asset path. Store paths are derived and are never authored. */
export const relativePath = z.string().min(1).max(240)
  .regex(
    /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/,
    "must be a safe relative path",
  );

const pngAssetPath = relativePath
  .refine((path) => path.startsWith("assets/"), "must be under assets/")
  .refine((path) => path.toLowerCase().endsWith(".png"), "must be a PNG image");

export const SlopStoreKindSchema = z.enum(["json", "sqlite"]).meta({ id: "SlopStoreKind", title: "SlopStoreKind" });

export const SlopStoreSchema = z.object({
  kind: SlopStoreKindSchema,
  maxBytes: z.number().int().positive().max(1_073_741_824).optional(),
}).strict().meta({ id: "SlopStore", title: "SlopStore" });

const storeID = z.string().regex(/^[a-z][a-z0-9-]{0,31}$/);
export const SlopStoresSchema = z.record(storeID, SlopStoreSchema).superRefine((stores, context) => {
  if (Object.keys(stores).length > 16) context.addIssue({ code: "custom", message: "at most 16 stores are allowed" });
}).meta({ id: "SlopStores", title: "SlopStores" });

export const SlopWindowShapeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("capsule") }).strict().meta({ id: "SlopWindowShapeCapsule", title: "SlopWindowShapeCapsule" }),
  z.object({ kind: z.literal("circle") }).strict().meta({ id: "SlopWindowShapeCircle", title: "SlopWindowShapeCircle" }),
  z.object({ kind: z.literal("imageMask"), path: pngAssetPath }).strict().meta({ id: "SlopWindowShapeImageMask", title: "SlopWindowShapeImageMask" }),
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
  shape: SlopWindowShapeSchema,
}).strict().superRefine((window, context) => {
  if (window.shape.kind === "circle" && window.width !== window.height) {
    context.addIssue({ code: "custom", path: ["shape"], message: "circle windows must have equal width and height" });
  }
  if (window.shape.kind === "imageMask" && window.resizable !== false) {
    context.addIssue({ code: "custom", path: ["resizable"], message: "image-masked windows must set resizable to false" });
  }
}).meta({ id: "SlopWindow", title: "SlopWindow" });

export const SlopTemplateLineageSchema = z.object({
  publisherKeyId: z.string().min(16).max(64),
  release: z.number().int().positive(),
  artifactSha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict().meta({ id: "SlopTemplateLineage", title: "SlopTemplateLineage" });

export const SlopDocumentSchema = z.object({
  id: z.string().uuid(),
  template: SlopTemplateLineageSchema.optional(),
}).strict().meta({ id: "SlopDocument", title: "SlopDocument" });

export const SlopManifestSchema = z.object({
  $schema: z.string().optional(),
  slug: z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1).max(80),
  description: z.string().min(1).max(240),
  author: SlopAuthorSchema,
  categories: z.array(z.string().min(1).max(40)).min(1).max(2).superRefine(uniqueStrings("categories")).meta({ id: "SlopCategories" }),
  tags: z.array(z.string().min(1).max(32)).max(8).superRefine(uniqueStrings("tags")).optional().meta({ id: "SlopTags" }),
  stores: SlopStoresSchema,
  window: SlopWindowSchema,
  document: SlopDocumentSchema.optional(),
}).strict().meta({ id: "SlopManifest", title: "SlopManifest" });

export type SlopStore = z.infer<typeof SlopStoreSchema>;
export type SlopManifest = z.infer<typeof SlopManifestSchema>;
export type SlopDocument = z.infer<typeof SlopDocumentSchema>;
export const parseManifest = (input: unknown): SlopManifest => SlopManifestSchema.parse(input);

export function storePath(id: string, kind: z.infer<typeof SlopStoreKindSchema>): string {
  return `stores/${id}.${kind === "json" ? "json" : "sqlite"}`;
}

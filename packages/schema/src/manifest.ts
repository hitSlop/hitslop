import { z } from "zod";

export const manifestSchemaURL = "https://api.hitslop.com/schemas/v1/manifest.schema.json" as const;

export const SlopCategorySchema = z.enum([
  "productivity",
  "utilities",
  "finance",
  "media",
  "games",
  "developer-tools",
  "education",
  "business",
  "personal",
  "other",
]).meta({ id: "SlopCategory", title: "SlopCategory" });

const categories = z.array(SlopCategorySchema).min(1).max(2).superRefine((values, context) => {
  if (new Set(values).size !== values.length) context.addIssue({ code: "custom", message: "categories must be unique" });
}).meta({ id: "SlopCategories", title: "SlopCategories" });

const authorURL = z.intersection(
  z.string().max(2_048).url(),
  z.string().max(2_048).regex(/^https?:\/\//, "must use http or https"),
);

export const SlopAuthorSchema = z.object({
  name: z.string().trim().min(1).max(80),
  url: authorURL.optional(),
}).strict().meta({ id: "SlopAuthor", title: "SlopAuthor" });

/** Portable package-relative asset path. */
export const relativePath = z.string().min(1).max(240).regex(
  /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/,
  "must be a safe relative path",
);

const skinPath = z.string().min(12).max(240).regex(
  /^assets\/(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+\.png$/i,
  "must be a safe PNG path under assets/",
);

const dimensions = {
  width: z.number().int().min(240).max(4096),
  height: z.number().int().min(180).max(4096),
};

export const SlopStandardPresentationSchema = z.object({
  ...dimensions,
  resizable: z.boolean().optional(),
  shape: z.enum(["rounded", "ellipse", "capsule"]).optional(),
  background: z.literal("transparent").optional(),
}).strict().meta({ id: "SlopStandardPresentation", title: "SlopStandardPresentation" });

export const SlopSkinPresentationSchema = z.object({
  ...dimensions,
  skin: skinPath,
}).strict().meta({ id: "SlopSkinPresentation", title: "SlopSkinPresentation" });

export const SlopPresentationSchema = z.union([
  SlopStandardPresentationSchema,
  SlopSkinPresentationSchema,
]).meta({ id: "SlopPresentation", title: "SlopPresentation" });

export const SlopManifestSchema = z.object({
  $schema: z.literal(manifestSchemaURL),
  author: SlopAuthorSchema,
  slug: z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1).max(80),
  description: z.string().min(1).max(240),
  categories,
  presentation: SlopPresentationSchema,
}).strict().meta({ id: "SlopManifest", title: "SlopManifest" });

export type SlopCategory = z.infer<typeof SlopCategorySchema>;
export type SlopAuthor = z.infer<typeof SlopAuthorSchema>;
export type SlopManifest = z.infer<typeof SlopManifestSchema>;
export type SlopPresentation = z.infer<typeof SlopPresentationSchema>;
export const parseManifest = (input: unknown): SlopManifest => SlopManifestSchema.parse(input);

import * as Type from "typebox";
import { SlopAuthorSchema, SlopCategorySchema } from "./manifest.js";
import { validate } from "./validation.js";

const sha256 = Type.String({ pattern: "^[a-f0-9]{64}$" });
const asset = Type.Object({
  url: Type.String({ format: "uri", pattern: "^https?://" }),
  sha256,
  bytes: Type.Integer({ minimum: 1 }),
}, { additionalProperties: false });

export const CatalogTemplateSchema = Type.Object({
  id: Type.String({ minLength: 1, maxLength: 160 }),
  slug: Type.String({ minLength: 2, maxLength: 64, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
  title: Type.String({ minLength: 1, maxLength: 80 }),
  description: Type.String({ minLength: 1, maxLength: 240 }),
  categories: Type.Array(SlopCategorySchema, { minItems: 1, maxItems: 2, uniqueItems: true }),
  author: SlopAuthorSchema,
  creationCount: Type.Integer({ minimum: 0 }),
  release: Type.Object({
    number: Type.Integer({ minimum: 1 }),
    publishedAt: Type.String({ format: "date-time" }),
  }, { additionalProperties: false }),
  preview: asset,
  icon: asset,
  download: asset,
}, { additionalProperties: false, title: "CatalogTemplate" });

export const CatalogResponseSchema = Type.Object({
  version: Type.Literal(1),
  templates: Type.Array(CatalogTemplateSchema, { maxItems: 200 }),
}, { additionalProperties: false, title: "CatalogResponse" });

export type CatalogTemplate = Type.Static<typeof CatalogTemplateSchema>;
export type CatalogResponse = Type.Static<typeof CatalogResponseSchema>;
export const parseCatalogResponse = (input: unknown): CatalogResponse => validate(CatalogResponseSchema, input);

import * as Type from "typebox";
import { SlopManifestSchema, SlopAuthorSchema } from "./manifest.js";
import { Sha256Schema } from "./publish.js";

const id = Type.String({ minLength: 1, maxLength: 160 });
const timestamp = Type.String({ format: "date-time" });
const count = Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER });
const releaseNumber = Type.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER });

export const RegistryAssetSchema = Type.Object({
  key: Type.String({ pattern: "^(?:artifacts/sha256/[a-f0-9]{64}\\.slop\\.zip|(?:previews|icons)/sha256/[a-f0-9]{64}\\.png)$" }),
  sha256: Sha256Schema,
  bytes: Type.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER }),
}, { additionalProperties: false, title: "RegistryAsset" });

export const RegistryReleaseSchema = Type.Object({
  id,
  number: releaseNumber,
  publishedAt: timestamp,
  artifact: RegistryAssetSchema,
  preview: RegistryAssetSchema,
  icon: RegistryAssetSchema,
  manifestJSON: Type.String({ minLength: 1 }),
}, { additionalProperties: false, title: "RegistryRelease" });

export const RegistryTemplateSchema = Type.Object({
  id,
  publisherKeyId: id,
  slug: SlopManifestSchema.properties.slug,
  title: SlopManifestSchema.properties.title,
  description: SlopManifestSchema.properties.description,
  // Readers preserve unfamiliar categories; native presentation maps them to Other.
  categories: Type.Array(Type.String({ minLength: 1 }), { minItems: 1, maxItems: 2, uniqueItems: true }),
  authorName: SlopAuthorSchema.properties.name,
  authorURL: SlopAuthorSchema.properties.url,
  currentRelease: RegistryReleaseSchema,
  creationCount: count,
  firstPublishedAt: timestamp,
  visibility: Type.String({ pattern: "^(public|hidden)$" }),
}, { additionalProperties: false, title: "RegistryTemplate" });

export const RegistryReleaseDocumentSchema = Type.Object({
  ...RegistryReleaseSchema.properties,
  templateId: id,
  publisherKeyId: id,
  slug: SlopManifestSchema.properties.slug,
}, { additionalProperties: false, title: "RegistryReleaseDocument" });

export const RegistryPublisherSchema = Type.Object({
  keyId: id,
  publicKey: Type.String({ minLength: 1 }),
  createdAt: timestamp,
  updatedAt: timestamp,
}, { additionalProperties: false, title: "RegistryPublisher" });

export const RegistryPublishResultSchema = Type.Object({
  templateId: id,
  releaseId: id,
  releaseNumber,
}, { additionalProperties: false, title: "RegistryPublishResult" });

export const RegistryPublishRequestSchema = Type.Object({
  requestId: id,
  publisherKeyId: id,
  artifactSha256: Sha256Schema,
  result: RegistryPublishResultSchema,
  createdAt: timestamp,
  expiresAt: timestamp,
}, { additionalProperties: false, title: "RegistryPublishRequest" });

export type RegistryAsset = Type.Static<typeof RegistryAssetSchema>;
export type RegistryRelease = Type.Static<typeof RegistryReleaseSchema>;
export type RegistryTemplate = Type.Static<typeof RegistryTemplateSchema>;
export type RegistryReleaseDocument = Type.Static<typeof RegistryReleaseDocumentSchema>;
export type RegistryPublisher = Type.Static<typeof RegistryPublisherSchema>;
export type RegistryPublishRequest = Type.Static<typeof RegistryPublishRequestSchema>;
export type RegistryPublishResult = Type.Static<typeof RegistryPublishResultSchema>;

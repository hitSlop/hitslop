import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
  publishers: defineTable({
    keyId: v.string(),
    publicKey: v.string(),
    displayName: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_keyId", ["keyId"]),

  templates: defineTable({
    publisherId: v.id("publishers"),
    publisherKeyId: v.string(),
    slug: v.string(),
    title: v.string(),
    description: v.string(),
    categories: v.array(v.string()),
    searchText: v.string(),
    currentReleaseId: v.optional(v.id("releases")),
    currentReleaseNumber: v.number(),
    currentPreviewKey: v.string(),
    currentPreviewSha256: v.string(),
    currentPreviewBytes: v.number(),
    currentIconKey: v.string(),
    currentIconSha256: v.string(),
    currentIconBytes: v.number(),
    creations: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_publisherId_and_slug", ["publisherId", "slug"])
    .index("by_updatedAt", ["updatedAt"])
    .index("by_creations", ["creations"])
    .searchIndex("search_searchText", { searchField: "searchText" }),

  releases: defineTable({
    templateId: v.id("templates"),
    number: v.number(),
    artifactKey: v.string(),
    artifactSha256: v.string(),
    artifactBytes: v.number(),
    previewKey: v.string(),
    previewSha256: v.string(),
    previewBytes: v.number(),
    iconKey: v.string(),
    iconSha256: v.string(),
    iconBytes: v.number(),
    manifest: v.any(),
    createdAt: v.number(),
  })
    .index("by_templateId_and_number", ["templateId", "number"])
    .index("by_artifactSha256", ["artifactSha256"]),

  publishRequests: defineTable({
    requestId: v.string(),
    publisherId: v.id("publishers"),
    releaseId: v.id("releases"),
    createdAt: v.number(),
  }).index("by_requestId", ["requestId"]),
});

export default schema;

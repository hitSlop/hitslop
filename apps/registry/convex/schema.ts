import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const screenshotValidator = v.object({ key: v.string(), sha256: v.string(), bytes: v.number(), contentType: v.string() });

const schema = defineSchema({
  publishers: defineTable({ keyId: v.string(), publicKey: v.string(), displayName: v.string(), createdAt: v.number() }).index("by_keyId", ["keyId"]),
  templates: defineTable({
    publisherId: v.id("publishers"), publisherKeyId: v.string(), slug: v.string(), title: v.string(), description: v.string(), categories: v.array(v.string()), tags: v.array(v.string()), runtime: v.literal("web"), searchText: v.string(),
    currentReleaseId: v.optional(v.id("releases")), currentReleaseNumber: v.number(), currentScreenshotKey: v.optional(v.string()), currentScreenshotContentType: v.optional(v.string()),
    downloads: v.number(), installs: v.number(), favorites: v.number(), popularityScore: v.number(), createdAt: v.number(), updatedAt: v.number(),
  }).index("by_publisherId_and_slug", ["publisherId", "slug"]).index("by_updatedAt", ["updatedAt"]).index("by_popularityScore", ["popularityScore"]).searchIndex("search_searchText", { searchField: "searchText" }),
  releases: defineTable({ templateId: v.id("templates"), number: v.number(), artifactKey: v.string(), artifactSha256: v.string(), artifactBytes: v.number(), screenshots: v.array(screenshotValidator), manifest: v.any(), createdAt: v.number() })
    .index("by_templateId_and_number", ["templateId", "number"]).index("by_artifactSha256", ["artifactSha256"]),
  publishRequests: defineTable({ requestId: v.string(), publisherId: v.id("publishers"), releaseId: v.id("releases"), createdAt: v.number() }).index("by_requestId", ["requestId"]),
  installations: defineTable({ installationId: v.string(), templateId: v.id("templates"), releaseId: v.id("releases"), installedAt: v.number(), lastSeenAt: v.number() })
    .index("by_installationId_and_templateId", ["installationId", "templateId"]).index("by_templateId", ["templateId"]),
  downloads: defineTable({ installationId: v.string(), templateId: v.id("templates"), releaseId: v.id("releases"), createdAt: v.number() })
    .index("by_installationId_and_releaseId", ["installationId", "releaseId"]).index("by_templateId", ["templateId"]),
  favorites: defineTable({ installationId: v.string(), templateId: v.id("templates"), createdAt: v.number() })
    .index("by_installationId_and_templateId", ["installationId", "templateId"]).index("by_templateId", ["templateId"]),
});

export default schema;

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import schema from "./schema";

const catalogTemplateValidator = schema.tables.templates.validator.extend({
  _id: v.id("templates"),
  _creationTime: v.number(),
  currentArtifactKey: v.union(v.string(), v.null()),
  currentArtifactSha256: v.union(v.string(), v.null()),
  currentArtifactBytes: v.union(v.number(), v.null()),
  currentManifest: v.union(v.any(), v.null()),
  currentReleaseCreatedAt: v.union(v.number(), v.null()),
  publisherDisplayName: v.string(),
});
const publisherDoc = schema.tables.publishers.validator.extend({ _id: v.id("publishers"), _creationTime: v.number() });
const releaseDoc = schema.tables.releases.validator.extend({ _id: v.id("releases"), _creationTime: v.number() });
const templateDetailValidator = schema.tables.templates.validator.extend({
  _id: v.id("templates"),
  _creationTime: v.number(),
  publisher: publisherDoc,
  currentRelease: v.union(releaseDoc, v.null()),
});

const withCurrentArtifact = async (ctx: { db: any }, item: any) => {
  const release = item.currentReleaseId ? await ctx.db.get(item.currentReleaseId) : null;
  const publisher = await ctx.db.get(item.publisherId);
  return {
    ...item,
    currentArtifactKey: release?.artifactKey ?? null,
    currentArtifactSha256: release?.artifactSha256 ?? null,
    currentArtifactBytes: release?.artifactBytes ?? null,
    currentManifest: release?.manifest ?? null,
    currentReleaseCreatedAt: release?.createdAt ?? null,
    publisherDisplayName: publisher?.displayName ?? "Unknown publisher",
  };
};

export const popular = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(catalogTemplateValidator),
  handler: async (ctx, args) => Promise.all(
    (await ctx.db.query("templates").withIndex("by_creations").order("desc").take(Math.min(args.limit ?? 12, 50)))
      .map((item) => withCurrentArtifact(ctx, item)),
  ),
});

export const newest = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(catalogTemplateValidator),
  handler: async (ctx, args) => Promise.all(
    (await ctx.db.query("templates").withIndex("by_updatedAt").order("desc").take(Math.min(args.limit ?? 12, 50)))
      .map((item) => withCurrentArtifact(ctx, item)),
  ),
});

export const list = query({
  args: {
    category: v.optional(v.string()),
    sort: v.optional(v.union(v.literal("popular"), v.literal("newest"))),
    limit: v.optional(v.number()),
  },
  returns: v.array(catalogTemplateValidator),
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 24, 50);
    const templates = args.sort === "newest"
      ? ctx.db.query("templates").withIndex("by_updatedAt").order("desc")
      : ctx.db.query("templates").withIndex("by_creations").order("desc");
    const items = args.category
      ? (await templates.take(200)).filter((item) => item.categories.includes(args.category!)).slice(0, limit)
      : await templates.take(limit);
    return Promise.all(items.map((item) => withCurrentArtifact(ctx, item)));
  },
});

export const search = query({
  args: { term: v.string(), category: v.optional(v.string()), limit: v.optional(v.number()) },
  returns: v.array(catalogTemplateValidator),
  handler: async (ctx, args) => {
    const term = args.term.trim();
    const limit = Math.min(args.limit ?? 24, 50);
    const candidates = term
      ? await ctx.db.query("templates").withSearchIndex("search_searchText", (q) => q.search("searchText", term)).take(args.category ? 200 : limit)
      : await ctx.db.query("templates").withIndex("by_creations").order("desc").take(args.category ? 200 : limit);
    const items = args.category ? candidates.filter((item) => item.categories.includes(args.category!)).slice(0, limit) : candidates;
    return Promise.all(items.map((item) => withCurrentArtifact(ctx, item)));
  },
});

export const release = query({
  args: { releaseId: v.id("releases") },
  returns: v.union(releaseDoc, v.null()),
  handler: (ctx, args) => ctx.db.get(args.releaseId),
});

export const template = query({
  args: { publisherKeyId: v.string(), slug: v.string() },
  returns: v.union(templateDetailValidator, v.null()),
  handler: async (ctx, args) => {
    const publisher = await ctx.db.query("publishers").withIndex("by_keyId", (q) => q.eq("keyId", args.publisherKeyId)).first();
    if (!publisher) return null;
    const item = await ctx.db.query("templates").withIndex("by_publisherId_and_slug", (q) => q.eq("publisherId", publisher._id).eq("slug", args.slug)).first();
    if (!item) return null;
    const currentRelease = item.currentReleaseId ? await ctx.db.get(item.currentReleaseId) : null;
    return { ...item, publisher, currentRelease };
  },
});

export const recordCreation = mutation({
  args: { templateId: v.id("templates") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.templateId);
    if (item) await ctx.db.patch(item._id, { creations: item.creations + 1 });
    return null;
  },
});

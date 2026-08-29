import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import schema from "./schema";

const catalogTemplateValidator = schema.tables.templates.validator.extend({
  _id: v.id("templates"),
  _creationTime: v.number(),
  currentArtifactKey: v.union(v.string(), v.null()),
  currentArtifactSha256: v.union(v.string(), v.null()),
  currentScreenshotKey: v.union(v.string(), v.null()),
  currentScreenshotContentType: v.union(v.string(), v.null()),
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
  const screenshot = release?.screenshots?.[0];
  return {
    ...item,
    currentArtifactKey: release?.artifactKey ?? null,
    currentArtifactSha256: release?.artifactSha256 ?? null,
    currentScreenshotKey: item.currentScreenshotKey ?? screenshot?.key ?? null,
    currentScreenshotContentType: item.currentScreenshotContentType ?? screenshot?.contentType ?? null,
  };
};

export const popular = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(catalogTemplateValidator),
  handler: async (ctx, args) => Promise.all((await ctx.db.query("templates").withIndex("by_popularityScore").order("desc").take(Math.min(args.limit ?? 12, 50))).map((item) => withCurrentArtifact(ctx, item))),
});
export const newest = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(catalogTemplateValidator),
  handler: async (ctx, args) => Promise.all((await ctx.db.query("templates").withIndex("by_updatedAt").order("desc").take(Math.min(args.limit ?? 12, 50))).map((item) => withCurrentArtifact(ctx, item))),
});
export const list = query({
  args: { category: v.optional(v.string()), sort: v.optional(v.union(v.literal("popular"), v.literal("newest"))), limit: v.optional(v.number()) },
  returns: v.array(catalogTemplateValidator),
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 24, 50);
    const query = args.sort === "newest"
      ? ctx.db.query("templates").withIndex("by_updatedAt").order("desc")
      : ctx.db.query("templates").withIndex("by_popularityScore").order("desc");
    const items = args.category ? (await query.take(200)).filter((item) => item.categories.includes(args.category!)).slice(0, limit) : await query.take(limit);
    return Promise.all(items.map((item) => withCurrentArtifact(ctx, item)));
  },
});
export const search = query({
  args: { term: v.string(), limit: v.optional(v.number()) },
  returns: v.array(catalogTemplateValidator),
  handler: async (ctx, args) => {
    const term = args.term.trim();
    const items = !term
      ? await ctx.db.query("templates").withIndex("by_popularityScore").order("desc").take(Math.min(args.limit ?? 24, 50))
      : await ctx.db.query("templates").withSearchIndex("search_searchText", (q) => q.search("searchText", term)).take(Math.min(args.limit ?? 24, 50));
    return Promise.all(items.map((item) => withCurrentArtifact(ctx, item)));
  },
});
export const release = query({
  args: { releaseId: v.id("releases") },
  returns: v.union(schema.tables.releases.validator.extend({ _id: v.id("releases"), _creationTime: v.number() }), v.null()),
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
export const recordDownload = mutation({
  args: { installationId: v.string(), templateId: v.id("templates"), releaseId: v.id("releases") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("downloads").withIndex("by_installationId_and_releaseId", (q) => q.eq("installationId", args.installationId).eq("releaseId", args.releaseId)).first();
    if (existing) return null;
    const item = await ctx.db.get(args.templateId); if (!item) return null;
    await ctx.db.insert("downloads", { ...args, createdAt: Date.now() });
    await ctx.db.patch(args.templateId, { downloads: item.downloads + 1 });
    return null;
  },
});
export const recordInstall = mutation({
  args: { installationId: v.string(), templateId: v.id("templates"), releaseId: v.id("releases") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("installations").withIndex("by_installationId_and_templateId", (q) => q.eq("installationId", args.installationId).eq("templateId", args.templateId)).first();
    const now = Date.now();
    if (existing) await ctx.db.patch(existing._id, { releaseId: args.releaseId, lastSeenAt: now });
    else {
      await ctx.db.insert("installations", { ...args, installedAt: now, lastSeenAt: now });
      const item = await ctx.db.get(args.templateId);
      if (item) await ctx.db.patch(args.templateId, { installs: item.installs + 1, popularityScore: item.popularityScore + 1 });
    }
    return null;
  },
});
export const toggleFavorite = mutation({
  args: { installationId: v.string(), templateId: v.id("templates") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("favorites").withIndex("by_installationId_and_templateId", (q) => q.eq("installationId", args.installationId).eq("templateId", args.templateId)).first();
    const item = await ctx.db.get(args.templateId); if (!item) return false;
    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(item._id, { favorites: Math.max(0, item.favorites - 1), popularityScore: Math.max(0, item.popularityScore - 3) });
      return false;
    }
    await ctx.db.insert("favorites", { ...args, createdAt: Date.now() });
    await ctx.db.patch(item._id, { favorites: item.favorites + 1, popularityScore: item.popularityScore + 3 });
    return true;
  },
});

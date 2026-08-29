import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { screenshotValidator } from "./schema";

export const finalize = internalMutation({
  args: { requestId: v.string(), publisherKeyId: v.string(), publicKey: v.string(), displayName: v.string(), slug: v.string(), artifactKey: v.string(), artifactSha256: v.string(), artifactBytes: v.number(), screenshots: v.array(screenshotValidator), manifest: v.any() },
  returns: v.object({ templateId: v.id("templates"), releaseId: v.id("releases"), releaseNumber: v.number() }),
  handler: async (ctx, args) => {
    const previous = await ctx.db.query("publishRequests").withIndex("by_requestId", (q) => q.eq("requestId", args.requestId)).unique();
    if (previous) {
      const release = await ctx.db.get(previous.releaseId); if (!release) throw new Error("Idempotent release is missing");
      return { templateId: release.templateId, releaseId: release._id, releaseNumber: release.number };
    }
    let publisher = await ctx.db.query("publishers").withIndex("by_keyId", (q) => q.eq("keyId", args.publisherKeyId)).unique();
    if (publisher && publisher.publicKey !== args.publicKey) throw new Error("Publisher key does not match its key id");
    if (!publisher) { const id = await ctx.db.insert("publishers", { keyId: args.publisherKeyId, publicKey: args.publicKey, displayName: args.displayName, createdAt: Date.now() }); publisher = (await ctx.db.get(id))!; }
    let template = await ctx.db.query("templates").withIndex("by_publisherId_and_slug", (q) => q.eq("publisherId", publisher._id).eq("slug", args.slug)).unique();
    const manifest = args.manifest as { title: string; description: string; categories: string[]; tags?: string[] };
    const now = Date.now(); const searchText = [manifest.title, manifest.description, ...manifest.categories, ...(manifest.tags ?? [])].join(" ").toLowerCase();
    if (!template) { const id = await ctx.db.insert("templates", { publisherId: publisher._id, publisherKeyId: publisher.keyId, slug: args.slug, title: manifest.title, description: manifest.description, categories: manifest.categories, tags: manifest.tags ?? [], runtime: "web", searchText, currentReleaseNumber: 0, downloads: 0, installs: 0, favorites: 0, popularityScore: 0, createdAt: now, updatedAt: now }); template = (await ctx.db.get(id))!; }
    const releaseNumber = template.currentReleaseNumber + 1;
    const releaseId = await ctx.db.insert("releases", { templateId: template._id, number: releaseNumber, artifactKey: args.artifactKey, artifactSha256: args.artifactSha256, artifactBytes: args.artifactBytes, screenshots: args.screenshots, manifest: args.manifest, createdAt: now });
    await ctx.db.patch(template._id, { title: manifest.title, description: manifest.description, categories: manifest.categories, tags: manifest.tags ?? [], searchText, currentReleaseId: releaseId, currentReleaseNumber: releaseNumber, updatedAt: now });
    await ctx.db.insert("publishRequests", { requestId: args.requestId, publisherId: publisher._id, releaseId, createdAt: now });
    return { templateId: template._id, releaseId, releaseNumber };
  },
});

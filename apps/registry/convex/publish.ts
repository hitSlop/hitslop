import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { parseManifest } from "@hitslop/schema";

export const finalize = internalMutation({
  args: {
    requestId: v.string(), publisherKeyId: v.string(), publicKey: v.string(), displayName: v.string(),
    artifactKey: v.string(), artifactSha256: v.string(), artifactBytes: v.number(),
    previewKey: v.string(), previewSha256: v.string(), previewBytes: v.number(),
    iconKey: v.string(), iconSha256: v.string(), iconBytes: v.number(), manifest: v.any(),
  },
  returns: v.object({ templateId: v.id("templates"), releaseId: v.id("releases"), releaseNumber: v.number() }),
  handler: async (ctx, args) => {
    const previous = await ctx.db.query("publishRequests").withIndex("by_requestId", (q) => q.eq("requestId", args.requestId)).first();
    if (previous) {
      const release = await ctx.db.get(previous.releaseId);
      if (!release) throw new Error("Idempotent release is missing");
      return { templateId: release.templateId, releaseId: release._id, releaseNumber: release.number };
    }

    const manifest = parseManifest(args.manifest);
    let publisher = await ctx.db.query("publishers").withIndex("by_keyId", (q) => q.eq("keyId", args.publisherKeyId)).first();
    if (publisher && publisher.publicKey !== args.publicKey) throw new Error("Publisher key does not match its key id");
    const now = Date.now();
    if (!publisher) {
      const id = await ctx.db.insert("publishers", { keyId: args.publisherKeyId, publicKey: args.publicKey, displayName: args.displayName, createdAt: now, updatedAt: now });
      publisher = (await ctx.db.get(id))!;
    } else if (publisher.displayName !== args.displayName) {
      await ctx.db.patch(publisher._id, { displayName: args.displayName, updatedAt: now });
    }

    let template = await ctx.db.query("templates").withIndex("by_publisherId_and_slug", (q) => q.eq("publisherId", publisher._id).eq("slug", manifest.slug)).first();
    const searchText = [manifest.title, manifest.description, ...manifest.categories].join(" ").toLowerCase();
    if (!template) {
      const id = await ctx.db.insert("templates", {
        publisherId: publisher._id, publisherKeyId: publisher.keyId, slug: manifest.slug,
        title: manifest.title, description: manifest.description, categories: manifest.categories, searchText,
        currentReleaseNumber: 0, currentPreviewKey: args.previewKey, currentPreviewSha256: args.previewSha256,
        currentPreviewBytes: args.previewBytes, currentIconKey: args.iconKey, currentIconSha256: args.iconSha256,
        currentIconBytes: args.iconBytes, creations: 0, createdAt: now, updatedAt: now,
      });
      template = (await ctx.db.get(id))!;
    }

    const releaseNumber = template.currentReleaseNumber + 1;
    const releaseId = await ctx.db.insert("releases", {
      templateId: template._id, number: releaseNumber,
      artifactKey: args.artifactKey, artifactSha256: args.artifactSha256, artifactBytes: args.artifactBytes,
      previewKey: args.previewKey, previewSha256: args.previewSha256, previewBytes: args.previewBytes,
      iconKey: args.iconKey, iconSha256: args.iconSha256, iconBytes: args.iconBytes,
      manifest: args.manifest, createdAt: now,
    });
    await ctx.db.patch(template._id, {
      title: manifest.title, description: manifest.description, categories: manifest.categories, searchText,
      currentReleaseId: releaseId, currentReleaseNumber: releaseNumber,
      currentPreviewKey: args.previewKey, currentPreviewSha256: args.previewSha256, currentPreviewBytes: args.previewBytes,
      currentIconKey: args.iconKey, currentIconSha256: args.iconSha256, currentIconBytes: args.iconBytes,
      updatedAt: now,
    });
    await ctx.db.insert("publishRequests", { requestId: args.requestId, publisherId: publisher._id, releaseId, createdAt: now });
    return { templateId: template._id, releaseId, releaseNumber };
  },
});

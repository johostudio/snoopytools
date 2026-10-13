import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

async function requireUserId(ctx: Parameters<typeof getAuthUserId>[0]) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("Sign in to use cloud sync.");
  return userId;
}

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return { id: userId, email: user.email ?? null };
  },
});

export const getState = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const row = await ctx.db
      .query("appStates")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return row ? { data: row.data, updatedAt: row.updatedAt } : null;
  },
});

export const saveState = mutation({
  args: { data: v.any(), updatedAt: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("appStates")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }
    return ctx.db.insert("appStates", { userId, ...args });
  },
});

export const generatePhotoUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx);
    return ctx.storage.generateUploadUrl();
  },
});

export const savePhoto = mutation({
  args: {
    clientId: v.string(),
    storageId: v.id("_storage"),
    name: v.string(),
    contentType: v.optional(v.string()),
    createdAt: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const existing = await ctx.db
      .query("photos")
      .withIndex("by_user_client", (q) => q.eq("userId", userId).eq("clientId", args.clientId))
      .unique();
    if (existing) {
      if (existing.storageId !== args.storageId) await ctx.storage.delete(existing.storageId);
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }
    return ctx.db.insert("photos", { userId, ...args });
  },
});

export const getPhoto = query({
  args: { clientId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const photo = await ctx.db
      .query("photos")
      .withIndex("by_user_client", (q) => q.eq("userId", userId).eq("clientId", args.clientId))
      .unique();
    if (!photo) return null;
    const url = await ctx.storage.getUrl(photo.storageId);
    return {
      clientId: photo.clientId,
      name: photo.name,
      contentType: photo.contentType,
      createdAt: photo.createdAt,
      url,
    };
  },
});

export const prunePhotos = mutation({
  args: { activeClientIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const active = new Set(args.activeClientIds);
    const photos = await ctx.db
      .query("photos")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    let deleted = 0;
    for (const photo of photos) {
      if (active.has(photo.clientId)) continue;
      await ctx.storage.delete(photo.storageId);
      await ctx.db.delete(photo._id);
      deleted += 1;
    }
    return deleted;
  },
});

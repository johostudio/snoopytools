import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,
  appStates: defineTable({
    userId: v.id("users"),
    data: v.any(),
    updatedAt: v.string(),
  }).index("by_user", ["userId"]),
  photos: defineTable({
    userId: v.id("users"),
    clientId: v.string(),
    storageId: v.id("_storage"),
    name: v.string(),
    contentType: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_user_client", ["userId", "clientId"]),
});

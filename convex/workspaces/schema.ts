import { defineTable } from "convex/server";
import { v } from "convex/values";

export const kind = v.union(v.literal("institution"), v.literal("business"));
export const sector = v.union(v.literal("interior-design"), v.literal("hr"));
export const invitedRole = v.union(
  v.literal("admin"),
  v.literal("mentor"),
  v.literal("member"),
);
export const role = v.union(v.literal("owner"), invitedRole);
export const status = v.union(
  v.literal("submitted"),
  v.literal("needs_update"),
  v.literal("reviewed"),
);
export const checklistEntry = v.object({
  key: v.string(),
  label: v.string(),
  route: v.string(),
});
export const submissionEntry = v.object({
  key: v.string(),
  done: v.boolean(),
  note: v.string(),
  fileId: v.optional(v.id("files")),
});
export const delivery = v.union(
  v.literal("manual"),
  v.literal("pending"),
  v.literal("sent"),
  v.literal("failed"),
  v.literal("suppressed"),
);

export const workspaceTables = {
  workspaceEmailVerifications: defineTable({
    userId: v.id("users"),
    email: v.string(),
    tokenHash: v.string(),
    expiresAt: v.number(),
    delivery,
  })
    .index("by_hash", ["tokenHash"])
    .index("by_user", ["userId"])
    .index("by_expiry", ["expiresAt"]),
  workspaces: defineTable({
    name: v.string(),
    kind,
    sector,
    ownerId: v.id("users"),
    createdAt: v.number(),
    archivedAt: v.optional(v.number()),
    // Existing workspaces predate editable pilot quotes.
    description: v.optional(v.string()),
    draftMonthlyIDR: v.optional(v.number()),
  }).index("by_owner", ["ownerId"]),
  workspaceRecords: defineTable({
    workspaceId: v.id("workspaces"),
    resource: v.string(),
    title: v.string(),
    status: v.string(),
    values: v.record(v.string(), v.string()),
    parentId: v.optional(v.id("workspaceRecords")),
    programId: v.optional(v.id("workspacePrograms")),
    submissionId: v.optional(v.id("workspaceSubmissions")),
    createdAt: v.number(),
    updatedAt: v.number(),
    archivedAt: v.optional(v.number()),
  }).index("by_workspace_resource", ["workspaceId", "resource"]),
  workspaceMembers: defineTable({
    workspaceId: v.id("workspaces"),
    userId: v.id("users"),
    role,
    inApp: v.boolean(),
    email: v.boolean(),
    joinedAt: v.number(),
  })
    .index("by_workspace_user", ["workspaceId", "userId"])
    .index("by_user", ["userId"]),
  workspaceInvites: defineTable({
    workspaceId: v.id("workspaces"),
    creatorId: v.id("users"),
    email: v.string(),
    role: invitedRole,
    tokenHash: v.string(),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    delivery,
  })
    .index("by_hash", ["tokenHash"])
    .index("by_workspace", ["workspaceId"])
    .index("by_workspace_expiry", ["workspaceId", "expiresAt"])
    .index("by_expiry", ["expiresAt"])
    .index("by_creator", ["creatorId"])
    .index("by_email", ["email"]),
  workspacePrograms: defineTable({
    workspaceId: v.id("workspaces"),
    title: v.string(),
    description: v.string(),
    checklist: v.array(checklistEntry),
    createdAt: v.number(),
    createdBy: v.id("users"),
    closed: v.boolean(),
  }).index("by_workspace", ["workspaceId"]),
  workspaceSubmissions: defineTable({
    workspaceId: v.id("workspaces"),
    programId: v.id("workspacePrograms"),
    userId: v.id("users"),
    memberId: v.id("workspaceMembers"),
    entries: v.array(submissionEntry),
    status,
    feedback: v.string(),
    revision: v.number(),
    consentAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_program_user", ["programId", "userId"])
    .index("by_program", ["programId"])
    .index("by_member", ["memberId"])
    .index("by_user", ["userId"]),
  workspaceNotifications: defineTable({
    workspaceId: v.id("workspaces"),
    memberId: v.id("workspaceMembers"),
    userId: v.id("users"),
    programId: v.id("workspacePrograms"),
    targetView: v.optional(v.literal("schedules")),
    read: v.boolean(),
    title: v.string(),
    createdAt: v.number(),
    delivery,
  })
    .index("by_user", ["userId"])
    .index("by_time", ["createdAt"]),
  workspaceFileTickets: defineTable({
    tokenHash: v.string(),
    submissionId: v.id("workspaceSubmissions"),
    fileId: v.id("files"),
    memberId: v.id("workspaceMembers"),
    userId: v.id("users"),
    revision: v.number(),
    expiresAt: v.number(),
  })
    .index("by_hash", ["tokenHash"])
    .index("by_user_expiry", ["userId", "expiresAt"])
    .index("by_expiry", ["expiresAt"]),
};

import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { MAX_PROGRAMS, MAX_WORKSPACES } from "./lib";

export async function revokeMembership(
  ctx: MutationCtx,
  memberId: Id<"workspaceMembers">,
) {
  for (const row of await ctx.db
    .query("workspaceSubmissions")
    .withIndex("by_member", (q) => q.eq("memberId", memberId))
    .take(MAX_PROGRAMS))
    await ctx.db.delete(row._id);
  await ctx.db.delete(memberId);
}

export async function eraseWorkspaceAccount(
  ctx: MutationCtx,
  userId: Id<"users">,
) {
  const user = await ctx.db.get(userId);
  for (const workspace of await ctx.db
    .query("workspaces")
    .withIndex("by_owner", (q) => q.eq("ownerId", userId))
    .take(MAX_WORKSPACES)) {
    await ctx.db.patch(workspace._id, { archivedAt: Date.now() });
    // Close membership without erasing other participants' archived records or personal files.
    for (const member of await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) => q.eq("workspaceId", workspace._id))
      .take(100))
      if (member.userId !== userId) await ctx.db.delete(member._id);
  }
  for (const member of await ctx.db
    .query("workspaceMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(MAX_WORKSPACES))
    await revokeMembership(ctx, member._id);
  await erasePrivateRows(ctx, userId, user?.email?.toLowerCase());
}

async function erasePrivateRows(
  ctx: MutationCtx,
  userId: Id<"users">,
  email?: string,
) {
  for (const row of await ctx.db
    .query("workspaceSubmissions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(200))
    await ctx.db.delete(row._id);
  for (const row of await ctx.db
    .query("workspaceEmailVerifications")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(200))
    await ctx.db.delete(row._id);
  for (const row of await ctx.db
    .query("workspaceNotifications")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(200))
    await ctx.db.delete(row._id);
  for (const row of await ctx.db
    .query("workspaceFileTickets")
    .withIndex("by_user_expiry", (q) => q.eq("userId", userId))
    .take(200))
    await ctx.db.delete(row._id);
  for (const row of await ctx.db
    .query("workspaceInvites")
    .withIndex("by_creator", (q) => q.eq("creatorId", userId))
    .take(200))
    await ctx.db.delete(row._id);
  if (email)
    for (const row of await ctx.db
      .query("workspaceInvites")
      .withIndex("by_email", (q) => q.eq("email", email))
      .take(200))
      await ctx.db.delete(row._id);
  const remaining =
    (await ctx.db
      .query("workspaceSubmissions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first()) ??
    (await ctx.db
      .query("workspaceEmailVerifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first()) ??
    (await ctx.db
      .query("workspaceNotifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first()) ??
    (await ctx.db
      .query("workspaceFileTickets")
      .withIndex("by_user_expiry", (q) => q.eq("userId", userId))
      .first()) ??
    (await ctx.db
      .query("workspaceInvites")
      .withIndex("by_creator", (q) => q.eq("creatorId", userId))
      .first()) ??
    (email
      ? await ctx.db
          .query("workspaceInvites")
          .withIndex("by_email", (q) => q.eq("email", email))
          .first()
      : null);
  if (remaining)
    await ctx.scheduler.runAfter(0, internal.workspaces.cleanup.eraseMore, {
      userId,
      ...(email ? { email } : {}),
    });
}

export const eraseMore = internalMutation({
  args: { userId: v.id("users"), email: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await erasePrivateRows(ctx, args.userId, args.email);
    return null;
  },
});

export const prune = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    for (const row of await ctx.db
      .query("workspaceInvites")
      .withIndex("by_expiry", (q) => q.lt("expiresAt", now - 30 * 86_400_000))
      .take(1000))
      await ctx.db.delete(row._id);
    for (const row of await ctx.db
      .query("workspaceEmailVerifications")
      .withIndex("by_expiry", (q) => q.lt("expiresAt", now))
      .take(1000))
      await ctx.db.delete(row._id);
    for (const row of await ctx.db
      .query("workspaceFileTickets")
      .withIndex("by_expiry", (q) => q.lt("expiresAt", now))
      .take(1000))
      await ctx.db.delete(row._id);
    for (const row of await ctx.db
      .query("workspaceNotifications")
      .withIndex("by_time", (q) => q.lt("createdAt", now - 30 * 86_400_000))
      .take(1000))
      await ctx.db.delete(row._id);
    return null;
  },
});

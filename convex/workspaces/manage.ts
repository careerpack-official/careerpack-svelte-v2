import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { authError, optionalUser } from "../_shared/auth";
import {
  access,
  MANAGERS,
  MAX_WORKSPACES,
  shortText,
  verifiedUser,
} from "./lib";
import { draftPrice } from "./modules/catalog";

export const settings = query({
  args: { workspaceId: v.id("workspaces") },
  returns: v.object({ description: v.string(), monthlyIDR: v.number() }),
  handler: async (ctx, { workspaceId }) => {
    const { workspace } = await access(ctx, workspaceId);
    return {
      description: workspace.description ?? "",
      monthlyIDR:
        workspace.draftMonthlyIDR ??
        draftPrice(workspace.kind, workspace.sector),
    };
  },
});
export const update = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    name: v.string(),
    description: v.string(),
    monthlyIDR: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await access(ctx, args.workspaceId, MANAGERS);
    if (
      !Number.isSafeInteger(args.monthlyIDR) ||
      args.monthlyIDR < 0 ||
      args.monthlyIDR > 100_000_000
    )
      throw authError("Harga draf tidak valid.");
    await ctx.db.patch(args.workspaceId, {
      name: shortText(args.name, 100, "Nama workspace"),
      description: shortText(args.description, 2000, "Deskripsi", false),
      draftMonthlyIDR: args.monthlyIDR,
    });
    return null;
  },
});
export const archive = mutation({
  args: { workspaceId: v.id("workspaces") },
  returns: v.null(),
  handler: async (ctx, { workspaceId }) => {
    await access(ctx, workspaceId, ["owner"]);
    const invites = await ctx.db
      .query("workspaceInvites")
      .withIndex("by_workspace_expiry", (q) =>
        q.eq("workspaceId", workspaceId).gt("expiresAt", Date.now()),
      )
      .take(101);
    // shortcut: at most 100 outstanding invitations; increase only with paginated revocation.
    if (invites.length > 100)
      throw authError("Cabut undangan aktif sebelum mengarsipkan workspace.");
    for (const invite of invites)
      await ctx.db.patch(invite._id, { revokedAt: Date.now() });
    await ctx.db.patch(workspaceId, { archivedAt: Date.now() });
    return null;
  },
});
export const archived = query({
  args: {},
  returns: v.array(v.object({ _id: v.id("workspaces"), name: v.string() })),
  handler: async (ctx) => {
    const userId = await optionalUser(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("workspaces")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .take(MAX_WORKSPACES);
    return rows
      .filter((w) => w.archivedAt)
      .map((w) => ({ _id: w._id, name: w.name }));
  },
});
export const restore = mutation({
  args: { workspaceId: v.id("workspaces") },
  returns: v.null(),
  handler: async (ctx, { workspaceId }) => {
    const { userId } = await verifiedUser(ctx);
    const w = await ctx.db.get(workspaceId);
    const member = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", userId),
      )
      .unique();
    if (!w?.archivedAt || w.ownerId !== userId || member?.role !== "owner")
      throw authError("Workspace tidak dapat dipulihkan.");
    await ctx.db.patch(workspaceId, { archivedAt: undefined });
    return null;
  },
});

import { v } from "convex/values";
import { query, internalQuery } from "../_generated/server";
import { optionalUser } from "../_shared/auth";
import { sha256Base64Url } from "../_shared/pkce";
import {
  access,
  activeSubmission,
  MAX_MEMBERS,
  MAX_PROGRAMS,
  MAX_WORKSPACES,
  presets,
  programAccess,
  REVIEWERS,
  selectedFile,
} from "./lib";
import {
  checklistEntry,
  delivery,
  invitedRole,
  kind,
  role,
  sector,
  status,
  submissionEntry,
} from "./schema";

export const workspaceSummary = v.object({
  _id: v.id("workspaces"),
  name: v.string(),
  kind,
  sector,
  role,
  inApp: v.boolean(),
  email: v.boolean(),
});
export const programSummary = v.object({
  _id: v.id("workspacePrograms"),
  title: v.string(),
  description: v.string(),
  checklist: v.array(checklistEntry),
  closed: v.boolean(),
});

export const listMine = query({
  args: {},
  returns: v.array(workspaceSummary),
  handler: async (ctx) => {
    const userId = await optionalUser(ctx);
    if (!userId) return [];
    const memberships = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(MAX_WORKSPACES);
    const result = [];
    for (const member of memberships) {
      const workspace = await ctx.db.get(member.workspaceId);
      if (workspace && !workspace.archivedAt)
        result.push({
          _id: workspace._id,
          name: workspace.name,
          kind: workspace.kind,
          sector: workspace.sector,
          role: member.role,
          inApp: member.inApp,
          email: member.email,
        });
    }
    return result;
  },
});

export const get = query({
  args: { workspaceId: v.id("workspaces") },
  returns: v.object({
    workspace: workspaceSummary,
    programs: v.array(programSummary),
    members: v.array(
      v.object({
        _id: v.id("workspaceMembers"),
        name: v.string(),
        email: v.string(),
        role,
      }),
    ),
    invites: v.array(
      v.object({
        _id: v.id("workspaceInvites"),
        email: v.string(),
        role: invitedRole,
        expiresAt: v.number(),
        delivery,
      }),
    ),
  }),
  handler: async (ctx, { workspaceId }) => {
    const { workspace, member } = await access(ctx, workspaceId);
    const programs = await ctx.db
      .query("workspacePrograms")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .take(MAX_PROGRAMS);
    const members = [];
    const invites = [];
    if (["owner", "admin"].includes(member.role)) {
      for (const row of await ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace_user", (q) => q.eq("workspaceId", workspaceId))
        .take(MAX_MEMBERS)) {
        const user = await ctx.db.get(row.userId);
        members.push({
          _id: row._id,
          name: user?.name ?? user?.email ?? "Anggota",
          email: user?.email ?? "",
          role: row.role,
        });
      }
      const rows = await ctx.db
        .query("workspaceInvites")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
        .order("desc")
        .take(100);
      for (const row of rows)
        if (!row.revokedAt && !row.acceptedAt && row.expiresAt > Date.now())
          invites.push({
            _id: row._id,
            email: row.email,
            role: row.role,
            expiresAt: row.expiresAt,
            delivery: row.delivery,
          });
    }
    const vacancies = workspace.sector === "hr" ? await ctx.db.query("workspaceRecords").withIndex("by_workspace_resource", q => q.eq("workspaceId", workspaceId).eq("resource", "vacancies")).take(200) : [];
    const visiblePrograms = programs.filter(p => {
      const vacancy = vacancies.find(row => row.programId === p._id);
      return !vacancy || (!vacancy.archivedAt && (member.role !== "member" || vacancy.status !== "Draf"));
    });
    return {
      workspace: {
        _id: workspace._id,
        name: workspace.name,
        kind: workspace.kind,
        sector: workspace.sector,
        role: member.role,
        inApp: member.inApp,
        email: member.email,
      },
      programs: visiblePrograms.map((p) => ({
        _id: p._id,
        title: p.title,
        description: p.description,
        checklist: p.checklist,
        closed: p.closed,
      })),
      members,
      invites,
    };
  },
});

export const listSubmissions = query({
  args: { programId: v.id("workspacePrograms") },
  returns: v.array(
    v.object({
      _id: v.id("workspaceSubmissions"),
      own: v.boolean(),
      participant: v.string(),
      entries: v.array(submissionEntry),
      files: v.array(v.object({ _id: v.id("files"), name: v.string() })),
      status,
      feedback: v.string(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, { programId }) => {
    const { userId, member } = await programAccess(ctx, programId);
    const rows = REVIEWERS.includes(member.role)
      ? await ctx.db
          .query("workspaceSubmissions")
          .withIndex("by_program", (q) => q.eq("programId", programId))
          .take(MAX_MEMBERS)
      : await ctx.db
          .query("workspaceSubmissions")
          .withIndex("by_program_user", (q) =>
            q.eq("programId", programId).eq("userId", userId),
          )
          .take(1);
    const result = [];
    for (const row of rows) {
      if (!(await activeSubmission(ctx, row))) continue;
      const user = await ctx.db.get(row.userId);
      const files = [];
      for (const entry of row.entries)
        if (entry.fileId) {
          try {
            const file = await selectedFile(ctx, entry.fileId, row.userId);
            files.push({ _id: file._id, name: file.fileName });
          } catch {
            /* A deleted/private file must not become another owner's grant. */
          }
        }
      result.push({
        _id: row._id,
        own: row.userId === userId,
        participant: user?.name ?? "Peserta",
        entries: row.entries,
        files,
        status: row.status,
        feedback: row.feedback,
        updatedAt: row.updatedAt,
      });
    }
    return result;
  },
});

export const previewInvite = query({
  args: { token: v.string() },
  returns: v.union(
    v.null(),
    v.object({ name: v.string(), role: invitedRole, expiresAt: v.number() }),
  ),
  handler: async (ctx, { token }) => {
    const userId = await optionalUser(ctx);
    if (!userId || !/^[a-f0-9]{64}$/.test(token)) return null;
    const user = await ctx.db.get(userId);
    // Hashing cannot be placed in an index callback.
    const hash = await sha256Base64Url(token);
    const row = await ctx.db
      .query("workspaceInvites")
      .withIndex("by_hash", (q) => q.eq("tokenHash", hash))
      .unique();
    const workspace = row ? await ctx.db.get(row.workspaceId) : null;
    if (
      !row ||
      !workspace ||
      workspace.archivedAt ||
      row.revokedAt ||
      row.acceptedAt ||
      row.expiresAt <= Date.now() ||
      user?.emailVerificationTime === undefined ||
      user.email?.trim().toLowerCase() !== row.email
    )
      return null;
    const inviter = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", row.workspaceId).eq("userId", row.creatorId),
      )
      .unique();
    if (
      !inviter ||
      !["owner", "admin"].includes(inviter.role) ||
      (row.role === "admin" && inviter.role !== "owner")
    )
      return null;
    return { name: workspace.name, role: row.role, expiresAt: row.expiresAt };
  },
});

export const notifications = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("workspaceNotifications"),
      targetView: v.optional(v.literal("schedules")),
      workspaceId: v.id("workspaces"),
      programId: v.id("workspacePrograms"),
      title: v.string(),
      read: v.boolean(),
      delivery,
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const userId = await optionalUser(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("workspaceNotifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100);
    const result = [];
    for (const row of rows) {
      const member = await ctx.db.get(row.memberId);
      const workspace = await ctx.db.get(row.workspaceId);
      if (
        workspace &&
        !workspace.archivedAt &&
        member?.userId === userId &&
        member.workspaceId === row.workspaceId &&
        member.inApp
      )
        result.push({
          _id: row._id,
          workspaceId: row.workspaceId,
          programId: row.programId,
          ...(row.targetView ? { targetView: row.targetView } : {}),
          title: row.title,
          read: row.read,
          delivery: row.delivery,
          createdAt: row.createdAt,
        });
    }
    return result;
  },
});

export const configuration = query({
  args: {},
  returns: v.object({
    emailReady: v.boolean(),
    emailVerified: v.boolean(),
    verificationDelivery: v.optional(delivery),
    presets: v.array(
      v.object({
        kind,
        sector,
        label: v.string(),
        title: v.string(),
        checklist: v.array(checklistEntry),
      }),
    ),
  }),
  handler: async (ctx) => {
    const userId = await optionalUser(ctx);
    const user = userId ? await ctx.db.get(userId) : null;
    const verification = userId
      ? await ctx.db
          .query("workspaceEmailVerifications")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .order("desc")
          .first()
      : null;
    return {
      emailVerified: user?.emailVerificationTime !== undefined,
      ...(verification ? { verificationDelivery: verification.delivery } : {}),
      emailReady:
        !!process.env.RESEND_API_KEY &&
        !!process.env.APP_URL &&
        !!process.env.EMAIL_FROM,
      presets: (["institution", "business"] as const).flatMap((k) =>
        (["interior-design", "hr"] as const).map((s) => ({
          kind: k,
          sector: s,
          label: presets[s].label,
          title: presets[s][k].program,
          checklist: presets[s][k].checklist,
        })),
      ),
    };
  },
});

export const resolveTicket = internalQuery({
  args: { hash: v.string() },
  returns: v.union(
    v.null(),
    v.object({ storageId: v.string(), name: v.string(), type: v.string() }),
  ),
  handler: async (ctx, { hash }) => {
    const ticket = await ctx.db
      .query("workspaceFileTickets")
      .withIndex("by_hash", (q) => q.eq("tokenHash", hash))
      .unique();
    if (!ticket || ticket.expiresAt <= Date.now()) return null;
    const row = await ctx.db.get(ticket.submissionId);
    const member = await ctx.db.get(ticket.memberId);
    const workspace = row ? await ctx.db.get(row.workspaceId) : null;
    if (
      !row ||
      !member ||
      !workspace ||
      workspace.archivedAt ||
      row.revision !== ticket.revision ||
      member.userId !== ticket.userId ||
      member.workspaceId !== row.workspaceId ||
      (!REVIEWERS.includes(member.role) && row.userId !== ticket.userId) ||
      !(await activeSubmission(ctx, row)) ||
      !row.entries.some((e) => e.fileId === ticket.fileId)
    )
      return null;
    try {
      if (workspace.sector === "hr") {
        const vacancies = await ctx.db.query("workspaceRecords").withIndex("by_workspace_resource", q => q.eq("workspaceId", workspace._id).eq("resource", "vacancies")).take(200);
        if (vacancies.some(vacancy => vacancy.programId === row.programId && vacancy.archivedAt)) return null;
      }
      const file = await selectedFile(ctx, ticket.fileId, row.userId);
      return {
        storageId: file.storageId,
        name: file.fileName,
        type: file.fileType,
      };
    } catch {
      return null;
    }
  },
});

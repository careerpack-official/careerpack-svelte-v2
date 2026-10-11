import { v } from "convex/values";
import { mutation, internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { authError, requireUser } from "../_shared/auth";
import { randomToken, sha256Base64Url } from "../_shared/pkce";
import { enforceRateLimit } from "../_shared/rateLimit";
import {
  access,
  notifyMember,
  activeSubmission,
  MANAGERS,
  MAX_MEMBERS,
  MAX_PROGRAMS,
  MAX_WORKSPACES,
  presets,
  programAccess,
  REVIEWERS,
  selectedFile,
  shortText,
  verifiedUser,
} from "./lib";
import {
  delivery,
  invitedRole,
  kind,
  sector,
  status,
  submissionEntry,
} from "./schema";
import { revokeMembership } from "./cleanup";

async function membershipRoom(
  ctx: MutationCtx,
  userId: Id<"users">,
  workspaceId?: Id<"workspaces">,
) {
  if (
    (
      await ctx.db
        .query("workspaceMembers")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .take(MAX_WORKSPACES)
    ).length >= MAX_WORKSPACES
  )
    throw authError("Pilot dibatasi 20 workspace per akun.");
  if (
    workspaceId &&
    (
      await ctx.db
        .query("workspaceMembers")
        .withIndex("by_workspace_user", (q) => q.eq("workspaceId", workspaceId))
        .take(MAX_MEMBERS)
    ).length >= MAX_MEMBERS
  )
    throw authError("Pilot dibatasi 100 anggota per workspace.");
}

export const create = mutation({
  args: { name: v.string(), kind, sector },
  returns: v.id("workspaces"),
  handler: async (ctx, args) => {
    const { userId } = await verifiedUser(ctx);
    const name = shortText(args.name, 100, "Nama workspace");
    await membershipRoom(ctx, userId);
    await enforceRateLimit(ctx, userId, {
      key: "workspace:create",
      max: 5,
      windowMs: 86_400_000,
    });
    const workspaceId = await ctx.db.insert("workspaces", {
      name,
      kind: args.kind,
      sector: args.sector,
      ownerId: userId,
      createdAt: Date.now(),
    });
    await ctx.db.insert("workspaceMembers", {
      workspaceId,
      userId,
      role: "owner",
      inApp: true,
      email: false,
      joinedAt: Date.now(),
    });
    const preset = presets[args.sector][args.kind];
    await ctx.db.insert("workspacePrograms", {
      workspaceId,
      title: preset.program,
      description:
        "Siapkan checklist dan dokumen pilihan Anda, lalu bagikan untuk ditinjau pengelola workspace.",
      checklist: preset.checklist,
      createdBy: userId,
      createdAt: Date.now(),
      closed: false,
    });
    return workspaceId;
  },
});

export const createProgram = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    title: v.string(),
    description: v.string(),
  },
  returns: v.id("workspacePrograms"),
  handler: async (ctx, args) => {
    const { userId, workspace } = await access(ctx, args.workspaceId, MANAGERS);
    const title = shortText(args.title, 120, "Nama program");
    const description = shortText(args.description, 2000, "Deskripsi", false);
    if (
      (
        await ctx.db
          .query("workspacePrograms")
          .withIndex("by_workspace", (q) =>
            q.eq("workspaceId", args.workspaceId),
          )
          .take(MAX_PROGRAMS)
      ).length >= MAX_PROGRAMS
    )
      throw authError("Pilot dibatasi 20 program per workspace.");
    return ctx.db.insert("workspacePrograms", {
      workspaceId: args.workspaceId,
      title,
      description,
      checklist: presets[workspace.sector][workspace.kind].checklist,
      createdBy: userId,
      createdAt: Date.now(),
      closed: false,
    });
  },
});

export const setProgramClosed = mutation({
  args: { programId: v.id("workspacePrograms"), closed: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { workspace } = await programAccess(ctx, args.programId, MANAGERS);
    if (workspace.sector === "hr") {
      const records = await ctx.db.query("workspaceRecords").withIndex("by_workspace_resource", q => q.eq("workspaceId", workspace._id).eq("resource", "vacancies")).take(200);
      const vacancy = records.find(row => row.programId === args.programId);
      if (vacancy) await ctx.db.patch(vacancy._id, { status: args.closed ? "Ditutup" : "Terbuka", updatedAt: Date.now() });
    }
    await ctx.db.patch(args.programId, { closed: args.closed });
    return null;
  },
});

export const preferences = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    inApp: v.boolean(),
    email: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { member } = await access(ctx, args.workspaceId);
    if (args.email) await verifiedUser(ctx);
    await ctx.db.patch(member._id, { inApp: args.inApp, email: args.email });
    return null;
  },
});

export const invite = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    email: v.string(),
    role: invitedRole,
    sendEmail: v.boolean(),
  },
  returns: v.object({ token: v.string(), expiresAt: v.number() }),
  handler: async (ctx, args) => {
    const { userId, member } = await access(ctx, args.workspaceId, MANAGERS);
    await verifiedUser(ctx);
    if (args.role === "admin" && member.role !== "owner")
      throw authError("Hanya pemilik dapat mengundang admin.");
    const email = shortText(args.email, 254, "Email").toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw authError("Email tidak valid.");
    if (
      args.sendEmail &&
      (!process.env.RESEND_API_KEY ||
        !process.env.EMAIL_FROM ||
        !process.env.APP_URL)
    )
      throw authError("Email workspace belum dikonfigurasi.");
    await enforceRateLimit(ctx, userId, {
      key: "workspace:invite",
      max: 20,
      windowMs: 3_600_000,
    });
    const active = await ctx.db
      .query("workspaceInvites")
      .withIndex("by_workspace_expiry", (q) =>
        q.eq("workspaceId", args.workspaceId).gt("expiresAt", Date.now()),
      )
      .take(100);
    if (active.length >= 100)
      throw authError(
        "Pilot dibatasi 100 undangan per workspace dalam tujuh hari.",
      );
    for (const old of active)
      if (old.email === email && !old.acceptedAt && !old.revokedAt)
        await ctx.db.patch(old._id, { revokedAt: Date.now() });
    const token = randomToken();
    const expiresAt = Date.now() + 7 * 86_400_000;
    const inviteId = await ctx.db.insert("workspaceInvites", {
      workspaceId: args.workspaceId,
      creatorId: userId,
      email,
      role: args.role,
      tokenHash: await sha256Base64Url(token),
      expiresAt,
      delivery: args.sendEmail ? "pending" : "manual",
    });
    if (args.sendEmail)
      await ctx.scheduler.runAfter(0, internal.workspaces.email.sendInvite, {
        inviteId,
        token,
      });
    return { token, expiresAt };
  },
});

export const acceptInvite = mutation({
  args: { token: v.string(), consent: v.boolean() },
  returns: v.id("workspaces"),
  handler: async (ctx, args) => {
    const { userId, email } = await verifiedUser(ctx);
    if (!args.consent)
      throw authError("Persetujuan diperlukan untuk bergabung.");
    if (!/^[a-f0-9]{64}$/.test(args.token))
      throw authError("Undangan tidak berlaku.");
    const hash = await sha256Base64Url(args.token);
    const row = await ctx.db
      .query("workspaceInvites")
      .withIndex("by_hash", (q) => q.eq("tokenHash", hash))
      .unique();
    const workspace = row ? await ctx.db.get(row.workspaceId) : null;
    if (
      !row ||
      !workspace ||
      workspace.archivedAt ||
      row.acceptedAt ||
      row.revokedAt ||
      row.expiresAt <= Date.now() ||
      row.email !== email
    )
      throw authError(
        "Undangan tidak berlaku untuk akun ini atau sudah kedaluwarsa.",
      );
    const inviter = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", row.workspaceId).eq("userId", row.creatorId),
      )
      .unique();
    if (
      !inviter ||
      !MANAGERS.includes(inviter.role) ||
      (row.role === "admin" && inviter.role !== "owner")
    )
      throw authError("Undangan tidak berlaku.");
    const existing = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", row.workspaceId).eq("userId", userId),
      )
      .unique();
    if (!existing) {
      await membershipRoom(ctx, userId, row.workspaceId);
      await ctx.db.insert("workspaceMembers", {
        workspaceId: row.workspaceId,
        userId,
        role: row.role,
        inApp: true,
        email: false,
        joinedAt: Date.now(),
      });
    }
    // An invitation never silently escalates an existing member's role.
    await ctx.db.patch(row._id, { acceptedAt: Date.now() });
    return row.workspaceId;
  },
});

export const revokeInvite = mutation({
  args: { inviteId: v.id("workspaceInvites") },
  returns: v.null(),
  handler: async (ctx, { inviteId }) => {
    const row = await ctx.db.get(inviteId);
    if (!row) throw authError("Undangan tidak ditemukan.");
    await access(ctx, row.workspaceId, MANAGERS);
    await ctx.db.patch(inviteId, { revokedAt: Date.now() });
    return null;
  },
});

export const removeMember = mutation({
  args: { memberId: v.id("workspaceMembers") },
  returns: v.null(),
  handler: async (ctx, { memberId }) => {
    const target = await ctx.db.get(memberId);
    if (!target) throw authError("Anggota tidak ditemukan.");
    const { member } = await access(ctx, target.workspaceId);
    if (
      target.role === "owner" ||
      (target.userId !== member.userId &&
        (!MANAGERS.includes(member.role) ||
          (target.role === "admin" && member.role !== "owner")))
    )
      throw authError("Anda tidak dapat menghapus anggota ini.");
    await revokeMembership(ctx, memberId);
    return null;
  },
});

export const leave = mutation({
  args: { workspaceId: v.id("workspaces") },
  returns: v.null(),
  handler: async (ctx, { workspaceId }) => {
    const { member } = await access(ctx, workspaceId);
    if (member.role === "owner")
      throw authError(
        "Pemilik tidak dapat keluar; hubungi pengelola platform untuk menutup workspace.",
      );
    await revokeMembership(ctx, member._id);
    return null;
  },
});

export const setMemberRole = mutation({
  args: { memberId: v.id("workspaceMembers"), role: invitedRole },
  returns: v.null(),
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.memberId);
    if (!target) throw authError("Anggota tidak ditemukan.");
    await access(ctx, target.workspaceId, ["owner"]);
    if (target.role === "owner")
      throw authError("Peran pemilik tidak dapat diubah.");
    await ctx.db.patch(target._id, { role: args.role });
    return null;
  },
});

export const submit = mutation({
  args: {
    programId: v.id("workspacePrograms"),
    entries: v.array(submissionEntry),
    consent: v.boolean(),
  },
  returns: v.id("workspaceSubmissions"),
  handler: async (ctx, args) => {
    const { userId, member, program } = await programAccess(
      ctx,
      args.programId,
    );
    if (program.closed) throw authError("Program ini sudah ditutup.");
    if (!args.consent)
      throw authError("Pilih persetujuan sebelum membagikan kiriman.");
    if (
      args.entries.length !== program.checklist.length ||
      new Set(args.entries.map((e) => e.key)).size !== args.entries.length ||
      args.entries.some((e) => !program.checklist.some((c) => c.key === e.key))
    )
      throw authError("Checklist tidak sesuai program.");
    const entries = [];
    for (const entry of args.entries) {
      const note = shortText(entry.note, 2000, "Catatan", false);
      if (entry.fileId) await selectedFile(ctx, entry.fileId, userId);
      entries.push({ ...entry, note });
    }
    await enforceRateLimit(ctx, userId, {
      key: "workspace:submit",
      max: 30,
      windowMs: 3_600_000,
    });
    const old = await ctx.db
      .query("workspaceSubmissions")
      .withIndex("by_program_user", (q) =>
        q.eq("programId", args.programId).eq("userId", userId),
      )
      .unique();
    const data = {
      workspaceId: program.workspaceId,
      programId: args.programId,
      userId,
      memberId: member._id,
      entries,
      status: "submitted" as const,
      feedback: "",
      revision: (old?.revision ?? 0) + 1,
      consentAt: Date.now(),
      updatedAt: Date.now(),
    };
    const id = old
      ? old._id
      : await ctx.db.insert("workspaceSubmissions", data);
    if (old) await ctx.db.patch(old._id, data);
    const reviewers = await ctx.db
      .query("workspaceMembers")
      .withIndex("by_workspace_user", (q) =>
        q.eq("workspaceId", program.workspaceId),
      )
      .take(MAX_MEMBERS);
    for (const reviewer of reviewers)
      if (reviewer.userId !== userId && REVIEWERS.includes(reviewer.role))
        await notifyMember(
          ctx,
          reviewer,
          args.programId,
          "Ada kiriman peserta untuk ditinjau.",
        );
    return id;
  },
});

export const review = mutation({
  args: {
    submissionId: v.id("workspaceSubmissions"),
    status,
    feedback: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.submissionId);
    if (!row || !(await activeSubmission(ctx, row)))
      throw authError("Kiriman tidak tersedia.");
    const { userId } = await programAccess(ctx, row.programId, REVIEWERS);
    if (userId === row.userId)
      throw authError("Kiriman sendiri tidak dapat ditinjau sendiri.");
    if (args.status === "submitted") throw authError("Pilih hasil peninjauan.");
    const feedback = shortText(args.feedback, 2000, "Umpan balik");
    if (row.status === args.status && row.feedback === feedback) return null;
    await enforceRateLimit(ctx, userId, {
      key: "workspace:review",
      max: 60,
      windowMs: 3_600_000,
    });
    await ctx.db.patch(row._id, {
      status: args.status,
      feedback,
      updatedAt: Date.now(),
    });
    const recipient = await ctx.db.get(row.memberId);
    if (recipient)
      await notifyMember(
        ctx,
        recipient,
        row.programId,
        "Kiriman Anda telah ditinjau. Buka workspace untuk melihat hasilnya.",
      );
    return null;
  },
});

export const withdraw = mutation({
  args: { submissionId: v.id("workspaceSubmissions") },
  returns: v.null(),
  handler: async (ctx, { submissionId }) => {
    const row = await ctx.db.get(submissionId);
    const userId = await requireUser(ctx);
    if (!row || row.userId !== userId)
      throw authError("Kiriman tidak ditemukan.");
    await ctx.db.delete(submissionId);
    return null;
  },
});

export const readNotification = mutation({
  args: { id: v.id("workspaceNotifications") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const userId = await requireUser(ctx);
    const row = await ctx.db.get(id);
    if (!row || row.userId !== userId)
      throw authError("Notifikasi tidak ditemukan.");
    await access(ctx, row.workspaceId);
    await ctx.db.patch(id, { read: true });
    return null;
  },
});

export const fileTicket = mutation({
  args: { submissionId: v.id("workspaceSubmissions"), fileId: v.id("files") },
  returns: v.object({ token: v.string(), expiresAt: v.number() }),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.submissionId);
    if (!row || !(await activeSubmission(ctx, row)))
      throw authError("Berkas tidak ditemukan.");
    const { userId, member } = await programAccess(ctx, row.programId);
    if (
      (!REVIEWERS.includes(member.role) && userId !== row.userId) ||
      !row.entries.some((e) => e.fileId === args.fileId)
    )
      throw authError("Berkas tidak ditemukan.");
    await selectedFile(ctx, args.fileId, row.userId);
    await enforceRateLimit(ctx, userId, {
      key: "workspace:file",
      max: 100,
      windowMs: 3_600_000,
    });
    for (const old of await ctx.db
      .query("workspaceFileTickets")
      .withIndex("by_user_expiry", (q) =>
        q.eq("userId", userId).lte("expiresAt", Date.now()),
      )
      .take(100))
      await ctx.db.delete(old._id);
    const token = randomToken();
    const expiresAt = Date.now() + 5 * 60_000;
    await ctx.db.insert("workspaceFileTickets", {
      ...args,
      tokenHash: await sha256Base64Url(token),
      userId,
      memberId: member._id,
      revision: row.revision,
      expiresAt,
    });
    return { token, expiresAt };
  },
});

export const setDelivery = internalMutation({
  args: {
    verificationId: v.optional(v.id("workspaceEmailVerifications")),
    inviteId: v.optional(v.id("workspaceInvites")),
    notificationId: v.optional(v.id("workspaceNotifications")),
    delivery,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.verificationId && (await ctx.db.get(args.verificationId)))
      await ctx.db.patch(args.verificationId, { delivery: args.delivery });
    if (args.inviteId && (await ctx.db.get(args.inviteId)))
      await ctx.db.patch(args.inviteId, { delivery: args.delivery });
    if (args.notificationId && (await ctx.db.get(args.notificationId)))
      await ctx.db.patch(args.notificationId, { delivery: args.delivery });
    return null;
  },
});

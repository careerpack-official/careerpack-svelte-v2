import { v } from "convex/values";
import { internalAction, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { escapeHtml, renderEmail, sendEmail } from "../_shared/email";
import { sha256Base64Url } from "../_shared/pkce";
import { MANAGERS } from "./lib";

const mailRecipient = v.union(
  v.null(),
  v.object({
    to: v.string(),
    workspaceId: v.id("workspaces"),
    name: v.string(),
    programId: v.optional(v.id("workspacePrograms")),
    targetView: v.optional(v.literal("schedules")),
  }),
);
export const inviteRecipient = internalQuery({
  args: { inviteId: v.id("workspaceInvites"), token: v.string() },
  returns: mailRecipient,
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.inviteId);
    const workspace = row ? await ctx.db.get(row.workspaceId) : null;
    if (
      !row ||
      !workspace ||
      workspace.archivedAt ||
      row.revokedAt ||
      row.acceptedAt ||
      row.expiresAt <= Date.now() ||
      row.tokenHash !== (await sha256Base64Url(args.token))
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
      !MANAGERS.includes(inviter.role) ||
      (row.role === "admin" && inviter.role !== "owner")
    )
      return null;
    return {
      to: row.email,
      workspaceId: row.workspaceId,
      name: workspace.name,
    };
  },
});

export const updateRecipient = internalQuery({
  args: { notificationId: v.id("workspaceNotifications") },
  returns: mailRecipient,
  handler: async (ctx, { notificationId }) => {
    const row = await ctx.db.get(notificationId);
    const member = row ? await ctx.db.get(row.memberId) : null;
    const user = row ? await ctx.db.get(row.userId) : null;
    const workspace = row ? await ctx.db.get(row.workspaceId) : null;
    if (
      !row ||
      !member ||
      !user?.email ||
      user.emailVerificationTime === undefined ||
      !workspace ||
      workspace.archivedAt ||
      member.userId !== row.userId ||
      member.workspaceId !== row.workspaceId ||
      !member.email ||
      row.delivery !== "pending"
    )
      return null;
    return {
      to: user.email,
      workspaceId: row.workspaceId,
      programId: row.programId,
      ...(row.targetView ? { targetView: row.targetView } : {}),
      name: workspace.name,
    };
  },
});

function appUrl() {
  if (
    !process.env.RESEND_API_KEY ||
    !process.env.EMAIL_FROM ||
    !process.env.APP_URL
  )
    throw new Error("Konfigurasi email belum lengkap.");
  const base = new URL(process.env.APP_URL);
  if (
    base.protocol !== "https:" ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    throw new Error("APP_URL email harus HTTPS.");
  return new URL("/dashboard/workspaces", base);
}

export const sendInvite = internalAction({
  args: { inviteId: v.id("workspaceInvites"), token: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const recipient = await ctx.runQuery(
      internal.workspaces.email.inviteRecipient,
      args,
    );
    if (!recipient) {
      await ctx.runMutation(internal.workspaces.mutations.setDelivery, {
        inviteId: args.inviteId,
        delivery: "suppressed",
      });
      return null;
    }
    try {
      const url = appUrl();
      url.searchParams.set("invite", args.token);
      if (
        await ctx.runQuery(internal.admin.unsubscribes._isUnsubscribed, {
          email: recipient.to.toLowerCase(),
        })
      ) {
        await ctx.runMutation(internal.workspaces.mutations.setDelivery, {
          inviteId: args.inviteId,
          delivery: "suppressed",
        });
        return null;
      }
      const subject = "Undangan workspace Careerpack";
      const bodyText = `Anda diundang ke workspace ${recipient.name}. Masuk menggunakan email penerima undangan yang telah diverifikasi. Nama dan email Anda terlihat oleh pengelola workspace. Dokumen pribadi hanya dibagikan setelah Anda memilih dan mengirimnya. Undangan berlaku tujuh hari. Abaikan jika tidak dikenal.`;
      const content = await renderEmail(
        {
          subject,
          preheader: "Undangan bergabung ke workspace",
          bodyHtml: `<p>${escapeHtml(bodyText)}</p>`,
          bodyText,
          ctaUrl: url.toString(),
          ctaLabel: "Lihat undangan",
        },
        recipient.to,
      );
      const result = await sendEmail(ctx, {
        to: recipient.to,
        ...content,
        tag: "workspace-invite",
      });
      await ctx.runMutation(internal.workspaces.mutations.setDelivery, {
        inviteId: args.inviteId,
        delivery: result.ok
          ? result.provider === "suppressed"
            ? "suppressed"
            : "sent"
          : "failed",
      });
    } catch {
      await ctx.runMutation(internal.workspaces.mutations.setDelivery, {
        inviteId: args.inviteId,
        delivery: "failed",
      });
    }
    return null;
  },
});

export const sendUpdate = internalAction({
  args: { notificationId: v.id("workspaceNotifications") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const recipient = await ctx.runQuery(
      internal.workspaces.email.updateRecipient,
      args,
    );
    if (!recipient) {
      await ctx.runMutation(internal.workspaces.mutations.setDelivery, {
        ...args,
        delivery: "suppressed",
      });
      return null;
    }
    try {
      const url = appUrl();
      url.searchParams.set("workspace", recipient.workspaceId);
      if (recipient.targetView) url.searchParams.set("view", recipient.targetView);
      if (recipient.programId)
        url.searchParams.set("program", recipient.programId);
      if (
        await ctx.runQuery(internal.admin.unsubscribes._isUnsubscribed, {
          email: recipient.to.toLowerCase(),
        })
      ) {
        await ctx.runMutation(internal.workspaces.mutations.setDelivery, {
          ...args,
          delivery: "suppressed",
        });
        return null;
      }
      const subject = "Pembaruan workspace Careerpack";
      const bodyText =
        "Ada pembaruan kiriman di workspace Anda. Masuk ke Careerpack untuk melihatnya. Email ini tidak memuat berkas, penilaian, atau catatan pribadi peserta.";
      const content = await renderEmail(
        {
          subject,
          preheader: "Lihat pembaruan di Careerpack",
          bodyHtml: `<p>${bodyText}</p>`,
          bodyText,
          ctaUrl: url.toString(),
          ctaLabel: "Buka workspace",
        },
        recipient.to,
      );
      const result = await sendEmail(ctx, {
        to: recipient.to,
        ...content,
        tag: "workspace-update",
      });
      await ctx.runMutation(internal.workspaces.mutations.setDelivery, {
        ...args,
        delivery: result.ok
          ? result.provider === "suppressed"
            ? "suppressed"
            : "sent"
          : "failed",
      });
    } catch {
      await ctx.runMutation(internal.workspaces.mutations.setDelivery, {
        ...args,
        delivery: "failed",
      });
    }
    return null;
  },
});

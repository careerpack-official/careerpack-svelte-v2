import { v } from "convex/values";
import { mutation, internalAction, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { authError, requireUser } from "../_shared/auth";
import { randomToken, sha256Base64Url } from "../_shared/pkce";
import {
  enforceGlobalWriteLimit,
  enforceRateLimit,
} from "../_shared/rateLimit";
import { renderEmail, sendEmail } from "../_shared/email";

export const request = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const user = await ctx.db.get(userId);
    if (!user?.email)
      throw authError("Masuk dengan akun beremail untuk verifikasi.");
    if (user.emailVerificationTime !== undefined) return null;
    if (
      !process.env.RESEND_API_KEY ||
      !process.env.EMAIL_FROM ||
      !process.env.APP_URL
    )
      throw authError("Email verifikasi belum dikonfigurasi.");
    await enforceRateLimit(ctx, userId, {
      key: "workspace:verify",
      max: 3,
      windowMs: 3_600_000,
    });
    await enforceGlobalWriteLimit(ctx, "workspace:verify", 100);
    const token = randomToken();
    const id = await ctx.db.insert("workspaceEmailVerifications", {
      userId,
      email: user.email.toLowerCase(),
      tokenHash: await sha256Base64Url(token),
      expiresAt: Date.now() + 86_400_000,
      delivery: "pending",
    });
    await ctx.scheduler.runAfter(
      0,
      internal.workspaces.emailVerification.send,
      { id, token },
    );
    return null;
  },
});

export const verify = mutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, { token }) => {
    const userId = await requireUser(ctx);
    if (!/^[a-f0-9]{64}$/.test(token))
      throw authError("Tautan verifikasi tidak berlaku.");
    const hash = await sha256Base64Url(token);
    const row = await ctx.db
      .query("workspaceEmailVerifications")
      .withIndex("by_hash", (q) => q.eq("tokenHash", hash))
      .unique();
    const user = await ctx.db.get(userId);
    if (
      !row ||
      row.userId !== userId ||
      !user?.email ||
      user.email.toLowerCase() !== row.email ||
      row.expiresAt <= Date.now()
    )
      throw authError(
        "Tautan verifikasi tidak berlaku untuk akun ini atau sudah kedaluwarsa.",
      );
    await ctx.db.patch(userId, { emailVerificationTime: Date.now() });
    await ctx.db.delete(row._id);
    return null;
  },
});

export const recipient = internalQuery({
  args: { id: v.id("workspaceEmailVerifications"), token: v.string() },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    const user = row ? await ctx.db.get(row.userId) : null;
    if (
      !row ||
      row.expiresAt <= Date.now() ||
      !user?.email ||
      user.email.toLowerCase() !== row.email ||
      user.emailVerificationTime !== undefined ||
      row.tokenHash !== (await sha256Base64Url(args.token))
    )
      return null;
    return row.email;
  },
});

export const send = internalAction({
  args: { id: v.id("workspaceEmailVerifications"), token: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const to = await ctx.runQuery(
      internal.workspaces.emailVerification.recipient,
      args,
    );
    if (!to) return null;
    try {
      if (
        !process.env.RESEND_API_KEY ||
        !process.env.EMAIL_FROM ||
        !process.env.APP_URL
      )
        throw new Error("Email verifikasi belum dikonfigurasi.");
      const url = new URL("/dashboard/workspaces", process.env.APP_URL);
      if (url.protocol !== "https:" || url.username || url.password)
        throw new Error("APP_URL email harus HTTPS.");
      url.searchParams.set("verify", args.token);
      const bodyText =
        "Anda meminta verifikasi email Careerpack agar dapat bergabung dan berbagi kiriman di workspace. Masuk menggunakan akun yang meminta verifikasi, lalu konfirmasi. Tautan berlaku 24 jam. Abaikan jika Anda tidak meminta email ini.";
      const content = await renderEmail(
        {
          subject: "Verifikasi email Careerpack",
          preheader: "Konfirmasi alamat email Anda",
          bodyHtml: `<p>${bodyText}</p>`,
          bodyText,
          ctaUrl: url.toString(),
          ctaLabel: "Verifikasi email",
        },
        to,
      );
      const result = await sendEmail(ctx, {
        to,
        ...content,
        tag: "workspace-verify",
        alwaysSend: true,
      });
      await ctx.runMutation(internal.workspaces.mutations.setDelivery, {
        verificationId: args.id,
        delivery: result.ok ? "sent" : "failed",
      });
    } catch {
      await ctx.runMutation(internal.workspaces.mutations.setDelivery, {
        verificationId: args.id,
        delivery: "failed",
      });
    }
    return null;
  },
});

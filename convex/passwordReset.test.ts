import { afterEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import schema from "./schema";
import { api, internal } from "./_generated/api";

const modules = Object.fromEntries(Object.entries(import.meta.glob("./**/*.{ts,js}")).filter(([p]) => !p.endsWith(".d.ts") && !/\.(test|config)\./.test(p)));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("password reset by sign-in provider", () => {
  it.each(["google", "password"])("sends appropriate help for %s without revealing the provider publicly", async (provider) => {
    vi.stubEnv("PASSWORD_RESET_HMAC_SECRET", "test-only-reset-secret");
    vi.stubEnv("RESEND_API_KEY", "test-only-sending-key");
    vi.stubEnv("APP_URL", "https://careerpack.example.test");
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const t = convexTest(schema, modules);
    await t.run(async ctx => {
      const userId = await ctx.db.insert("users", { email: "owner@example.test" });
      await ctx.db.insert("authAccounts", { userId, provider, providerAccountId: "owner@example.test", ...(provider === "password" ? { secret: "test-only-secret" } : {}) });
    });
    expect(await t.mutation(internal.passwordReset._ipGatedRequestReset, { email: " OWNER@example.test ", ipHash: "test-only-ip" })).toEqual({ ok: true });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const mail = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(mail.to).toEqual(["owner@example.test"]);
    if (provider === "google") {
      expect(mail.subject).toBe("Masuk ke akun CareerPack");
      expect(mail.text).toContain("Masuk dengan Google");
      expect(mail.text).not.toContain("/reset-password/");
    } else {
      expect(mail.subject).toBe("Reset kata sandi CareerPack");
      expect(mail.text).toContain("https://careerpack.example.test/reset-password/");
    }
    const tokens = await t.run(ctx => ctx.db.query("passwordResetTokens").collect());
    expect(Boolean(tokens[0].usedAt)).toBe(provider === "google");
    for (let i = 0; i < 5; i++) {
      await t.mutation(internal.passwordReset._ipGatedRequestReset, { email: "owner@example.test", ipHash: "test-only-ip" });
      await t.finishAllScheduledFunctions(vi.runAllTimers);
    }
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(await t.mutation(internal.passwordReset._ipGatedRequestReset, { email: "missing@example.test", ipHash: "test-other-ip" })).toEqual({ ok: true });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("returns a readable error for an old Google reset link without creating a password account", async () => {
    vi.stubEnv("PASSWORD_RESET_HMAC_SECRET", "test-only-reset-secret");
    const t = convexTest(schema, modules);
    const token = "legacy-google-test-token";
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("test-only-reset-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const hash = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(token)));
    await t.run(async ctx => {
      const userId = await ctx.db.insert("users", { email: "owner@example.test" });
      await ctx.db.insert("authAccounts", { userId, provider: "google", providerAccountId: "test-only-google" });
      await ctx.db.insert("passwordResetTokens", { userId, tokenHash: "hmacv1_" + Array.from(hash, b => b.toString(16).padStart(2, "0")).join(""), expiresAt: Date.now() + 60_000 });
    });
    const error = await t.mutation(api.passwordReset.resetPassword, { token, newPassword: "test-only-password-123" }).catch(e => e);
    expect(error).toBeInstanceOf(ConvexError);
    expect(error.data).toContain("Masuk dengan Google");
    expect((await t.run(ctx => ctx.db.query("authAccounts").collect())).map(a => a.provider)).toEqual(["google"]);
  });
});

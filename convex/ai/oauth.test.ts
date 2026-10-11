import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";
import { decryptCred } from "../_shared/aiCrypto";
import { sha256Base64Url } from "../_shared/pkce";

const modules = Object.fromEntries(Object.entries({
  ...import.meta.glob("../**/*.{ts,js}"),
  ...Object.fromEntries(Object.entries(import.meta.glob("./*.{ts,js}")).map(([path, loader]) => [path.replace(/^\.\//, "../ai/"), loader])),
}).filter(([path]) => !path.endsWith(".d.ts") && !/\.(test|spec|config)\./.test(path)));

beforeEach(() => {
  vi.stubEnv("APP_URL", "https://careerpack.org");
  vi.stubEnv("AI_CRED_SECRET", "test-only-master-secret");
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ key: "sk-or-test-new" })));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

async function setup(admin = false) {
  const t = convexTest(schema, modules);
  const userId = await t.run(async ctx => {
    const id = await ctx.db.insert("users", { email: "qa@example.test", emailVerificationTime: 1 });
    await ctx.db.insert("userProfiles", { userId: id, fullName: "QA", location: "", targetRole: "", experienceLevel: "", role: admin ? "admin" : "user" });
    return id;
  });
  const signed = t.withIdentity({ subject: `${userId}|session` });
  return { t, signed, userId };
}

describe("OpenRouter OAuth destination and transaction security", () => {
  it("binds PKCE and state, preserves the personal model, encrypts the key and leaves global settings alone", async () => {
    const { t, signed, userId } = await setup();
    await t.run(async ctx => {
      await ctx.db.insert("aiSettings", { userId, provider: "openrouter", model: "chosen-model", apiKey: "old-personal", baseUrl: "https://old.example/v1", enabled: true, updatedAt: 1 });
      await ctx.db.insert("globalAISettings", { provider: "openrouter", model: "global-model", apiKey: "global-key", enabled: true, updatedBy: userId, updatedAt: 1 });
      await ctx.db.insert("aiUserModelOverrides", { userId, model: "override-model", setBy: userId, updatedAt: 1 });
    });
    const { url } = await signed.mutation(api.ai.oauth.startOAuthConnect, { provider: "openrouter" });
    const params = new URL(url).searchParams;
    const flow = await t.run(ctx => ctx.db.query("aiOAuthFlows").first());
    expect(params.get("callback_url")).toBe("https://careerpack.org/oauth/openrouter/callback");
    expect(params.get("code_challenge")).toBe(await sha256Base64Url(flow!.verifier));
    expect(params.get("code_challenge_method")).toBe("S256");
    expect(params.get("state")).toBe(flow!.state);
    const result = await signed.action(api.ai.oauth.finishOAuthConnect, { provider: "openrouter", code: "test-code", state: params.get("state")! });
    expect(result).toEqual({ provider: "openrouter", model: "chosen-model", scope: "user" });
    const own = await t.run(ctx => ctx.db.query("aiSettings").first());
    expect(own!.apiKey).toMatch(/^encv1:/);
    expect(await decryptCred(own!.apiKey)).toBe("sk-or-test-new");
    expect(own!.baseUrl).toBeUndefined();
    expect((await t.run(ctx => ctx.db.query("globalAISettings").first()))!.apiKey).toBe("global-key");
    expect(await t.run(ctx => ctx.db.query("aiOAuthFlows").first())).toBeNull();
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toMatchObject({ code_verifier: flow!.verifier, code_challenge_method: "S256" });
  });

  it("writes an admin connection to the global row without changing personal AI", async () => {
    const { t, signed, userId } = await setup(true);
    await t.run(async ctx => {
      await ctx.db.insert("aiSettings", { userId, provider: "openai", model: "personal-model", apiKey: "personal-key", enabled: true, updatedAt: 1 });
      await ctx.db.insert("globalAISettings", { provider: "openrouter", model: "chosen-global", apiKey: "old-global", baseUrl: "https://old.example/v1", enabled: true, updatedBy: userId, updatedAt: 1 });
    });
    const { url } = await signed.mutation(api.ai.oauth.startOAuthConnect, { provider: "openrouter", scope: "global" });
    expect(await signed.action(api.ai.oauth.finishOAuthConnect, { provider: "openrouter", code: "test-code", state: new URL(url).searchParams.get("state")! })).toMatchObject({ scope: "global", model: "chosen-global" });
    const global = await t.run(ctx => ctx.db.query("globalAISettings").first());
    expect(await decryptCred(global!.apiKey)).toBe("sk-or-test-new");
    expect(global!.updatedBy).toBe(userId);
    expect(global!.baseUrl).toBeUndefined();
    expect((await t.run(ctx => ctx.db.query("aiSettings").first()))!.apiKey).toBe("personal-key");
  });

  it("rejects non-admin global access and rechecks admin permission on callback", async () => {
    const regular = await setup();
    await expect(regular.signed.mutation(api.ai.oauth.startOAuthConnect, { provider: "openrouter", scope: "global" })).rejects.toThrow("Bukan admin");
    const { t, signed } = await setup(true);
    const { url } = await signed.mutation(api.ai.oauth.startOAuthConnect, { provider: "openrouter", scope: "global" });
    await t.run(async ctx => { const profile = await ctx.db.query("userProfiles").first(); await ctx.db.patch(profile!._id, { role: "user" }); });
    await expect(signed.action(api.ai.oauth.finishOAuthConnect, { provider: "openrouter", code: "code", state: new URL(url).searchParams.get("state")! })).rejects.toThrow("Bukan admin");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects mismatched, replaced, expired and replayed states before contacting OpenRouter", async () => {
    const { t, signed } = await setup();
    const first = await signed.mutation(api.ai.oauth.startOAuthConnect, { provider: "openrouter" });
    const second = await signed.mutation(api.ai.oauth.startOAuthConnect, { provider: "openrouter" });
    const finish = (state: string) => signed.action(api.ai.oauth.finishOAuthConnect, { provider: "openrouter", code: "code", state });
    await expect(finish("wrong-state")).rejects.toThrow("Sesi penyambungan");
    await expect(finish(new URL(first.url).searchParams.get("state")!)).rejects.toThrow("Sesi penyambungan");
    const state = new URL(second.url).searchParams.get("state")!;
    await t.run(async ctx => { const flow = await ctx.db.query("aiOAuthFlows").first(); await ctx.db.patch(flow!._id, { createdAt: Date.now() - 600_000 }); });
    await expect(finish(state)).rejects.toThrow("Sesi penyambungan");
    expect(fetch).not.toHaveBeenCalled();
    const third = await signed.mutation(api.ai.oauth.startOAuthConnect, { provider: "openrouter" });
    const current = new URL(third.url).searchParams.get("state")!;
    await finish(current);
    await expect(finish(current)).rejects.toThrow("Sesi penyambungan");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps the existing key when upstream refuses the exchange", async () => {
    const { t, signed, userId } = await setup();
    await t.run(ctx => ctx.db.insert("aiSettings", { userId, provider: "openrouter", model: "old-model", apiKey: "old-key", enabled: true, updatedAt: 1 }));
    vi.mocked(fetch).mockResolvedValue(Response.json({ error: "refused" }, { status: 401 }));
    const { url } = await signed.mutation(api.ai.oauth.startOAuthConnect, { provider: "openrouter" });
    await expect(signed.action(api.ai.oauth.finishOAuthConnect, { provider: "openrouter", code: "code", state: new URL(url).searchParams.get("state")! })).rejects.toThrow("Penukaran kode OpenRouter gagal (401)");
    expect((await t.run(ctx => ctx.db.query("aiSettings").first()))!.apiKey).toBe("old-key");
  });
});

describe("saved AI credentials and scoped connectivity tests", () => {
  it("does not reuse a stored key when either settings form changes provider", async () => {
    const { t, signed, userId } = await setup(true);
    await t.run(async ctx => {
      await ctx.db.insert("aiSettings", { userId, provider: "openrouter", model: "old", apiKey: "old-own", enabled: true, updatedAt: 1 });
      await ctx.db.insert("globalAISettings", { provider: "openrouter", model: "old", apiKey: "old-global", enabled: true, updatedBy: userId, updatedAt: 1 });
    });
    const args = { provider: "openai", model: "new", apiKey: "", enabled: true };
    await expect(signed.mutation(api.ai.mutations.setMyAISettings, args)).rejects.toThrow("Provider berubah");
    await expect(signed.mutation(api.ai.mutations.setGlobalAISettings, args)).rejects.toThrow("Provider berubah");
    await signed.mutation(api.ai.mutations.setMyAISettings, { ...args, provider: "openrouter" });
    expect((await t.run(ctx => ctx.db.query("aiSettings").first()))!.apiKey).toBe("old-own");
  });

  it("tests the global key and model even when the admin has personal AI", async () => {
    const { t, signed, userId } = await setup(true);
    await t.run(async ctx => {
      await ctx.db.insert("aiSettings", { userId, provider: "openrouter", model: "personal-model", apiKey: "personal-key", enabled: true, updatedAt: 1 });
      await ctx.db.insert("globalAISettings", { provider: "openrouter", model: "global-model", apiKey: "global-key", enabled: true, updatedBy: userId, updatedAt: 1 });
      await ctx.db.insert("aiUserModelOverrides", { userId, model: "override-model", setBy: userId, updatedAt: 1 });
    });
    vi.mocked(fetch).mockResolvedValue(Response.json({ choices: [{ message: { content: "OK" } }] }));
    expect(await signed.action(api.ai.actions.testConnection, { scope: "global" })).toEqual({ ok: true, reply: "OK" });
    expect(vi.mocked(fetch).mock.calls[0][1]!.headers).toMatchObject({ Authorization: "Bearer global-key" });
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string).model).toBe("global-model");
  });

  it("refuses a non-admin global connectivity test before making a paid request", async () => {
    const { signed } = await setup();
    await expect(signed.action(api.ai.actions.testConnection, { scope: "global" })).rejects.toThrow("Bukan admin");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("cannot redeem another user's callback", async () => {
    const { t, signed } = await setup();
    const otherId = await t.run(ctx => ctx.db.insert("users", { email: "other@example.test" }));
    const other = t.withIdentity({ subject: `${otherId}|session` });
    const { url } = await signed.mutation(api.ai.oauth.startOAuthConnect, { provider: "openrouter" });
    await expect(other.action(api.ai.oauth.finishOAuthConnect, { provider: "openrouter", code: "code", state: new URL(url).searchParams.get("state")! })).rejects.toThrow("Sesi penyambungan");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not claim success for an empty AI response", async () => {
    const { t, signed, userId } = await setup();
    await t.run(ctx => ctx.db.insert("aiSettings", { userId, provider: "openrouter", model: "model", apiKey: "key", enabled: true, updatedAt: 1 }));
    vi.mocked(fetch).mockResolvedValue(Response.json({ choices: [] }));
    await expect(signed.action(api.ai.actions.testConnection, {})).rejects.toThrow("Respons AI tidak valid");
  });
});

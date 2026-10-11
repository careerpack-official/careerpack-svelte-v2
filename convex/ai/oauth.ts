/**
 * Provider OAuth connect — "masuk dengan <provider>" instead of pasting a key.
 *
 * Split in two because only half of it can `fetch`: `startOAuthConnect` is a
 * mutation (mint verifier, park it, hand back the authorize URL) and
 * `finishOAuthConnect` is an action (exchange the code upstream, store the
 * result). Same split as `convex/mcp/oauth.ts`, and the PKCE primitives are
 * that file's — `_shared/pkce.ts` — not a second copy.
 *
 * Adding a provider is an entry in `AI_PROVIDERS[x].auth.oauth` plus an entry
 * in `OAUTH_ADAPTERS` below. Nothing else in this file, and nothing in the UI,
 * learns the provider's name.
 *
 * The parked transaction binds both its owner and destination: personal AI
 * settings or the admin-managed system default.
 */
import { action, internalMutation, mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { ConvexError, v } from "convex/values";
import { activeUserId as getAuthUserId } from "../_shared/authSession";
import { authError, requireAdmin, requireUser } from "../_shared/auth";
import { randomToken, sha256Base64Url } from "../_shared/pkce";
import { AI_PROVIDERS, providerOAuth } from "../_shared/aiProviders";
import { credEncryptionAvailable, encryptCred } from "../_shared/aiCrypto";
import { fetchWithTimeout, FETCH_TIMEOUTS } from "../_shared/fetchWithTimeout";
import { requireEnv } from "../_shared/env";

/**
 * How long a parked verifier stays usable. Long enough for a user to read a
 * consent screen and sign in on the provider's side; short enough that an
 * abandoned flow is not a standing replay window.
 */
const FLOW_TTL_MS = 10 * 60 * 1000;
const scopeValidator = v.union(v.literal("user"), v.literal("global"));

/**
 * ConvexError, not Error: prod Convex redacts an uncaught Error to a bare
 * "Server Error", which drops every Indonesian sentence below before the user
 * reads it — and "set AI_CRED_SECRET" is advice only the operator can act on.
 * Same reason `aiUnavailableError` is a ConvexError.
 */
const connectError = (message: string) => new ConvexError({ message });

interface OAuthAdapter {
  /** Where to send the browser. `callbackUrl` is already absolute. */
  authorizeUrl(args: { challenge: string; callbackUrl: string; state: string }): string;
  /** Redeem the code. Returns the secret to store as `aiSettings.apiKey`. */
  exchange(args: {
    code: string;
    verifier: string;
    callbackUrl: string;
  }): Promise<string>;
}

const OAUTH_ADAPTERS: Record<string, OAuthAdapter> = {
  // https://openrouter.ai/docs/use-cases/oauth-pkce — the exchange returns a
  // provisioned `sk-or-…` key, which is why this provider is the cheap one:
  // the result is indistinguishable from a pasted key from here on.
  openrouter: {
    authorizeUrl: ({ challenge, callbackUrl, state }) =>
      `https://openrouter.ai/auth?callback_url=${encodeURIComponent(callbackUrl)}` +
      `&code_challenge=${challenge}&code_challenge_method=S256&state=${state}` +
      "&key_label=Careerpack",
    exchange: async ({ code, verifier }) => {
      const res = await fetchWithTimeout("https://openrouter.ai/api/v1/auth/keys", {
        // Same endpoint class as the model catalog: small JSON, fast.
        timeoutMs: FETCH_TIMEOUTS.modelList,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          code_verifier: verifier,
          code_challenge_method: "S256",
        }),
      });
      if (!res.ok) {
        throw connectError(
          `Penukaran kode OpenRouter gagal (${res.status}). Coba sambungkan lagi.`,
        );
      }
      const key = (await res.json())?.key;
      if (typeof key !== "string" || key === "") {
        throw connectError("OpenRouter tidak mengembalikan API key.");
      }
      return key;
    },
  },
};

/** `${APP_URL}${callbackPath}` — the URL the provider is told to return to. */
function callbackUrlFor(provider: string): string {
  const spec = providerOAuth(provider);
  if (!spec?.callbackPath) {
    throw new Error(`Provider ${provider} tidak memakai callback redirect`);
  }
  // Required, not defaulted: a wrong origin means the provider redirects the
  // user somewhere that cannot finish the exchange, and the flow dies silently
  // minutes after the button was clicked.
  return requireEnv("APP_URL").replace(/\/+$/, "") + spec.callbackPath;
}

export const startOAuthConnect = mutation({
  args: { provider: v.string(), scope: v.optional(scopeValidator) },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, { provider, scope = "user" }) => {
    const userId = scope === "global" ? await requireAdmin(ctx) : await requireUser(ctx);
    const spec = providerOAuth(provider);
    if (!spec || !OAUTH_ADAPTERS[provider]) {
      throw connectError(`Provider ${provider} tidak mendukung login OAuth`);
    }
    // Refuse rather than mint a credential we would have to keep in the clear.
    // The user never sees this key, so they can never rotate one they did not
    // know had leaked — storing it unencrypted is a risk nobody accepted.
    if (!credEncryptionAvailable()) {
      throw connectError(
        "Login provider belum aktif — admin perlu mengatur AI_CRED_SECRET dulu.",
      );
    }

    // 64 hex chars: inside RFC 7636's 43–128 window and within its charset.
    const verifier = randomToken(32);
    const challenge = await sha256Base64Url(verifier);
    const state = randomToken(32);

    const existing = await ctx.db
      .query("aiOAuthFlows")
      .withIndex("by_user_provider", (q) => q.eq("userId", userId).eq("provider", provider))
      .first();
    // Replace, never accumulate: restarting a connect must invalidate the
    // previous verifier, otherwise an abandoned flow stays redeemable.
    if (existing) await ctx.db.delete(existing._id);
    await ctx.db.insert("aiOAuthFlows", { userId, provider, verifier, state, scope, createdAt: Date.now() });

    return {
      url: OAUTH_ADAPTERS[provider].authorizeUrl({
        challenge,
        callbackUrl: callbackUrlFor(provider),
        state,
      }),
    };
  },
});

export const finishOAuthConnect = action({
  args: { provider: v.string(), code: v.string(), state: v.string() },
  returns: v.object({ provider: v.string(), model: v.string(), scope: scopeValidator }),
  handler: async (ctx, { provider, code, state }): Promise<{ provider: string; model: string; scope: "user" | "global" }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw authError("Tidak terautentikasi");
    const adapter = OAUTH_ADAPTERS[provider];
    if (!adapter) throw connectError(`Provider ${provider} tidak mendukung login OAuth`);

    if (!code || code.length > 2048 || !state || state.length > 128) {
      throw connectError("Respons OpenRouter tidak valid. Ulangi penyambungan.");
    }
    const flow = await ctx.runMutation(internal.ai.oauth._consumeFlow, { userId, provider, state });
    if (!flow) {
      throw connectError(
        "Sesi penyambungan tidak ditemukan atau sudah kedaluwarsa. Ulangi dari Setelan → AI.",
      );
    }

    const key = await adapter.exchange({
      code,
      verifier: flow.verifier,
      callbackUrl: callbackUrlFor(provider),
    });

    const model = await ctx.runMutation(internal.ai.oauth._storeConnectedKey, {
      userId,
      provider,
      scope: flow.scope,
      apiKey: await encryptCred(key),
    });
    return { provider, model, scope: flow.scope };
  },
});

// ----- flow state -----

// Atomically consume before exchange: concurrent callbacks cannot redeem twice.
export const _consumeFlow = internalMutation({
  args: { userId: v.id("users"), provider: v.string(), state: v.string() },
  returns: v.union(v.object({ verifier: v.string(), scope: scopeValidator }), v.null()),
  handler: async (ctx, { userId, provider, state }) => {
    const row = await ctx.db
      .query("aiOAuthFlows")
      .withIndex("by_user_provider", (q) => q.eq("userId", userId).eq("provider", provider))
      .first();
    if (!row) return null;
    if (!row.state || row.state !== state || Date.now() - row.createdAt >= FLOW_TTL_MS) return null;
    const scope = row.scope ?? "user";
    if (scope === "global" && await requireAdmin(ctx) !== userId) throw authError("Bukan admin");
    await ctx.db.delete(row._id);
    return { verifier: row.verifier, scope };
  },
});

/**
 * Write the connected key into the transaction's settings scope. Keeps whatever
 * model they had picked — reconnecting an expired key must not silently move
 * a user off the model they chose — and only falls back to the provider
 * default on a first connect or a provider switch.
 */
export const _storeConnectedKey = internalMutation({
  args: { userId: v.id("users"), provider: v.string(), apiKey: v.string(), scope: scopeValidator },
  returns: v.string(),
  handler: async (ctx, { userId, provider, apiKey, scope }) => {
    if (scope === "global") {
      const adminId = await requireAdmin(ctx);
      if (adminId !== userId) throw authError("Bukan admin");
      const existing = await ctx.db.query("globalAISettings").first();
      const model = existing?.provider === provider && existing.model
        ? existing.model : AI_PROVIDERS[provider].defaultModel;
      const patch = { provider, model, apiKey, baseUrl: undefined, enabled: true, updatedBy: adminId, updatedAt: Date.now() };
      if (existing) await ctx.db.patch(existing._id, patch);
      else await ctx.db.insert("globalAISettings", patch);
      return model;
    }
    const existing = await ctx.db
      .query("aiSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const model =
      existing && existing.provider === provider && existing.model
        ? existing.model
        : AI_PROVIDERS[provider].defaultModel;
    const patch = {
      userId,
      provider,
      model,
      apiKey,
      // A custom baseUrl belongs to whatever the user pointed at before; it
      // would send this provider's key to that host.
      baseUrl: undefined,
      enabled: true,
      updatedAt: Date.now(),
    };
    if (existing) await ctx.db.patch(existing._id, patch);
    else await ctx.db.insert("aiSettings", patch);
    return model;
  },
});

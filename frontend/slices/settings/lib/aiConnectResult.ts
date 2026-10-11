/**
 * Outcome of a provider OAuth round-trip, read back off the `?ai=` param that
 * `app/oauth/<provider>/callback` leaves on `/dashboard/settings`.
 *
 * Its own module because the two outcomes share one namespace: success is the
 * provider id (`?ai=openrouter`), failure is the literal `?ai=error`. The check
 * order below is therefore load-bearing, and `AI_PROVIDERS` never having an id
 * called "error" is what keeps it safe — pinned by `aiProviders.test.ts`.
 */
export { parseAIConnectResult, type AIConnectResult } from "@/shared/components/ai-settings/connectResult";

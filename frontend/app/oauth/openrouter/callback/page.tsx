import type { Metadata } from "next";
import { OpenRouterCallback } from "./OpenRouterCallback";

/**
 * Where OpenRouter drops the user back after they approve the connect.
 *
 * A client page, not a `route.ts` handler, because this app authenticates
 * with `ConvexAuthProvider` (@convex-dev/auth/react) — the session lives in
 * the browser, not in a cookie a Next server handler can read. A handler here
 * would have no user to attribute the exchange to and `requireUser` would
 * reject every callback. Same reason `/oauth/authorize` is a client page.
 */
export const metadata: Metadata = {
  title: "Menyambungkan OpenRouter | CareerPack",
  // The URL carries a live authorization code.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function OpenRouterCallbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const code = typeof sp.code === "string" ? sp.code : "";
  const state = typeof sp.state === "string" ? sp.state : "";
  return <OpenRouterCallback code={code} oauthState={state} />;
}

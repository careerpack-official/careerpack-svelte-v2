"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useAuth } from "@/shared/hooks/useAuth";
import { humanMessage } from "@/shared/lib/notify";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

const SETTINGS_HREF = "/dashboard/settings";

export function OpenRouterCallback({ code, oauthState }: { code: string; oauthState: string }) {
  const router = useRouter();
  const { state } = useAuth();
  const finish = useAction(api.ai.oauth.finishOAuthConnect);
  const [error, setError] = useState<string | null>(code && oauthState ? null : "Sesi OpenRouter tidak lengkap. Ulangi penyambungan dari pengaturan AI.");
  // React 18 StrictMode mounts effects twice in dev, and the exchange is
  // single-use upstream — the second call would fail on a code that already
  // worked and show the user an error for a connect that succeeded.
  const started = useRef(false);

  useEffect(() => {
    if (!code || !oauthState || state.isLoading || !state.user || started.current) return;
    started.current = true;
    window.history.replaceState({}, "", window.location.pathname);
    finish({ provider: "openrouter", code, state: oauthState })
      .then((result) => router.replace(`${result.scope === "global" ? "/dashboard/admin-panel" : SETTINGS_HREF}?ai=openrouter`))
      .catch((err: unknown) =>
        setError(humanMessage(err, "Gagal menyambungkan OpenRouter.")),
      );
  }, [code, oauthState, state.isLoading, state.user, finish, router]);

  // Session gone while the user was on openrouter.ai. The code is bound to a
  // verifier stored under their account, so it can only be redeemed by them —
  // saying so beats a spinner that never resolves.
  const signedOut = !state.isLoading && !state.user;

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {error
              ? "Gagal menyambungkan"
              : signedOut
                ? "Masuk dulu"
                : "Menyambungkan OpenRouter…"}
          </CardTitle>
          <CardDescription>
            {error ??
              (signedOut
                ? "Sesi Anda berakhir. Masuk lagi, lalu ulangi dari Setelan → AI."
                : "Menukar kode dengan API key. Jangan tutup halaman ini sebentar.")}
          </CardDescription>
        </CardHeader>
        {error || signedOut ? (
          <CardContent>
            <Button
              className="w-full"
              onClick={() =>
                router.replace(signedOut ? "/login" : `${SETTINGS_HREF}?ai=error`)
              }
            >
              {signedOut ? "Masuk ke CareerPack" : "Kembali ke Setelan"}
            </Button>
          </CardContent>
        ) : null}
      </Card>
    </main>
  );
}

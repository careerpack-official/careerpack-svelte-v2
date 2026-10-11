import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { sha256Base64Url } from "../_shared/pkce";

export const readFile = httpAction(async (ctx, request) => {
  const token = new URL(request.url).searchParams.get("t");
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Access-Control-Allow-Origin": "*",
  };
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    return new Response("Berkas tidak tersedia.", { status: 404, headers });
  const file = await ctx.runQuery(internal.workspaces.queries.resolveTicket, {
    hash: await sha256Base64Url(token),
  });
  if (!file)
    return new Response("Berkas tidak tersedia.", { status: 404, headers });
  const blob = await ctx.storage.get(file.storageId);
  if (!blob)
    return new Response("Berkas tidak tersedia.", { status: 404, headers });
  return new Response(blob, {
    headers: {
      ...headers,
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    },
  });
});

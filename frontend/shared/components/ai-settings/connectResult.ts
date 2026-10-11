export type AIConnectResult = { status: "ok"; provider: string } | { status: "failed" };

export function parseAIConnectResult(search: string): AIConnectResult | null {
  const value = new URLSearchParams(search).get("ai");
  if (!value) return null;
  return value === "error" ? { status: "failed" } : { status: "ok", provider: value };
}

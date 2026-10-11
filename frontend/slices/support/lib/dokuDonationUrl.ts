export function dokuDonationUrl(value?: string): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.hostname !== "pay.doku.com" ||
        url.username || url.password || url.port || url.pathname === "/") return null;
    return url.href;
  } catch {
    return null;
  }
}

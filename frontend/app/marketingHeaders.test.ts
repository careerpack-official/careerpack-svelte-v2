import { describe, expect, it } from "vitest";
import config from "../next.config";

describe("Tavus homepage permissions", () => {
  it("allows the embed and bot challenge only on the homepage", async () => {
    const rules = await config.headers!();
    const home = rules.find((rule) => rule.source === "/")!;
    const app = rules.find((rule) => rule.source.includes("(?!"))!;
    const header = (rule: typeof home, key: string) =>
      rule.headers.find((item) => item.key === key)!.value;
    const csp = header(home, "Content-Security-Policy");

    expect(csp).toContain("https://unpkg.com");
    expect(csp).toContain("https://tavusapi.com");
    expect(csp).toContain("https://cdn.replica.tavus.io");
    expect(csp).toContain("https://challenges.cloudflare.com");
    expect(csp).toContain("wss://*.daily.co");
    expect(csp).toContain("https://*.dailywebrtc.com");
    expect(csp).toContain("https://*.dailywebrtc.net");
    expect(csp).toContain("'unsafe-eval'");
    const directive = (policy: string, name: string) =>
      policy.split("; ").find((item) => item.startsWith(`${name} `))!.split(" ").slice(1);
    expect(directive(csp, "script-src")).toContain("blob:");
    expect(directive(csp, "frame-src")).toContain("https://tavusapi.com");
    expect(directive(csp, "script-src")).toContain("https://static.cloudflareinsights.com");
    expect(directive(csp, "connect-src")).toContain("https://cloudflareinsights.com");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(header(home, "Permissions-Policy")).toContain("microphone=(self)");
    expect(header(app, "Permissions-Policy")).toContain("microphone=()");
    expect(header(app, "Content-Security-Policy")).not.toContain("tavus");
    expect(header(app, "Content-Security-Policy")).not.toContain("'unsafe-eval'");
    expect(directive(header(app, "Content-Security-Policy"), "script-src")).not.toContain("blob:");
    const appPattern = new RegExp(`^${app.source}$`);
    expect(appPattern.test("/")).toBe(false);
    expect(appPattern.test("/dashboard")).toBe(true);
    expect(appPattern.test("/personal-branding/templates/starter.html")).toBe(false);
  });
});

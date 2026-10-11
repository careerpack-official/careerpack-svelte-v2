import { describe, it, expect } from "vitest";
import { loginRedirect, postLoginTarget } from "./routes";

describe("workspace invitation login return", () => {
  it("preserves the invitation through the login query", () => {
    const destination = "/dashboard/workspaces?invite=" + "a".repeat(64);
    const url = new URL(loginRedirect(destination), "https://careerpack.org");
    expect(postLoginTarget(url.searchParams.get("redirect"))).toBe(destination);
  });
  it.each([
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/\nevil.test",
    "javascript:alert(1)",
  ])("rejects external or malformed redirect %s", (input) => {
    expect(postLoginTarget(input)).toBe("/dashboard");
  });
});

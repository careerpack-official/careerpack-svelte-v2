import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const roles = vi.hoisted(() => ({ admin: undefined as boolean | undefined, superAdmin: undefined as boolean | undefined }));
vi.mock("convex/react", () => ({
  useQuery: (query: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(query);
    if (name.endsWith(":amIAdmin")) return roles.admin;
    if (name.endsWith(":amISuperAdmin")) return roles.superAdmin;
    return undefined;
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));

import { AdminPanel } from "./AdminPanel";

describe("admin permission loading", () => {
  beforeEach(() => {
    roles.admin = undefined;
    roles.superAdmin = undefined;
  });

  it("waits for both permissions without showing a false restriction", () => {
    roles.admin = true;
    const html = renderToStaticMarkup(React.createElement(AdminPanel));
    expect(html).toContain('role="status"');
    expect(html).not.toContain("Akses terbatas");
  });

  it("keeps non-admins out even when the super-admin query resolves first", () => {
    roles.admin = false;
    roles.superAdmin = true;
    const html = renderToStaticMarkup(React.createElement(AdminPanel));
    expect(html).toContain('role="status"');
    expect(html).not.toContain("Pengguna");
  });

  it("shows the restricted analytics notice only for a resolved role admin", () => {
    roles.admin = true;
    roles.superAdmin = false;
    expect(renderToStaticMarkup(React.createElement(AdminPanel))).toContain("Akses terbatas");
  });

  it("shows super-admin analytics without a restriction", () => {
    roles.admin = true;
    roles.superAdmin = true;
    const html = renderToStaticMarkup(React.createElement(AdminPanel));
    expect(html).toContain("Analitik semua pengguna");
    expect(html).not.toContain("Akses terbatas");
  });
});

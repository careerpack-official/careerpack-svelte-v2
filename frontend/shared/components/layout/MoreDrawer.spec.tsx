import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const search = vi.hoisted(() => ({ query: "", unread: 0 }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: unknown) => [
      initial === "" ? search.query : initial,
      vi.fn(),
    ],
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/shared/components/ui/drawer", () => {
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  return {
    Drawer: wrapper,
    DrawerClose: wrapper,
    DrawerContent: wrapper,
    DrawerDescription: wrapper,
    DrawerHeader: wrapper,
    DrawerTitle: wrapper,
  };
});
vi.mock("@/shared/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));
vi.mock("@/shared/hooks/useVisibleMoreApps", async () => {
  const { MORE_APPS } = await import("./navConfig");
  return {
    useVisibleMoreApps: () => MORE_APPS.filter((tile) => !tile.superAdminOnly),
  };
});
vi.mock("@/shared/hooks/useWorkspaceNavigation", async () => {
  const { PRIMARY_NAV } = await import("./navConfig");
  return {
    useWorkspaceNavigation: () => ({
      primary: PRIMARY_NAV,
      selected: undefined,
    }),
  };
});
vi.mock("@/shared/hooks/useUnreadNotifications", () => ({
  useUnreadNotifications: () => search.unread,
  formatUnreadBadge: (count: number) => (count ? String(count) : undefined),
}));
vi.mock("@/shared/hooks/usePWAInstall", () => ({
  usePWAInstall: () => ({ canInstall: false }),
}));
vi.mock("@/shared/hooks/useAuth", () => ({
  useAuth: () => ({ state: { isAuthenticated: false } }),
}));
vi.mock("../interactions/MicroInteractions", () => ({
  useHapticPress: () => ({}),
}));

import { MoreDrawer } from "./MoreDrawer";
const render = () =>
  renderToStaticMarkup(
    React.createElement(MoreDrawer, { open: true, onOpenChange: vi.fn() }),
  );

describe("all-features mobile menu", () => {
  beforeEach(() => {
    search.query = "";
    search.unread = 0;
  });

  it("includes the primary destinations while preserving admin visibility", () => {
    const html = render();
    for (const label of ["Dashboard", "CV", "Kalender"])
      expect(html).toContain(`aria-label="${label}"`);
    expect(html).not.toContain('aria-label="Admin Panel"');
  });

  it("finds Calendar by its label and id, ignoring case and whitespace", () => {
    for (const query of [" KaLeNdEr ", "calendar"]) {
      search.query = query;
      const html = render();
      expect(html).toContain('aria-label="Kalender"');
      expect(html).not.toContain('aria-label="Dashboard"');
      expect(html).toContain("Hasil (1)");
    }
  });

  it("keeps the unread notification badge and the empty search message", () => {
    search.unread = 12;
    search.query = "notifications";
    expect(render()).toContain(">12</");
    search.query = "no-such-feature";
    expect(render()).toContain("Tidak ada fitur cocok");
  });
});

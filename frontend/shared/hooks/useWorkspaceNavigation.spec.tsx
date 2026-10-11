import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  pathname: "/dashboard/workspaces",
  query: "workspace=mine&view=cv",
  authenticated: true,
  loading: false,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
  useSearchParams: () => new URLSearchParams(state.query),
}));
vi.mock("convex/react", () => ({
  useConvexAuth: () => ({
    isAuthenticated: state.authenticated,
    isLoading: state.loading,
  }),
  useQuery: () => [
    { _id: "mine", name: "HR", kind: "business", sector: "hr", role: "member" },
  ],
}));
vi.mock("@/shared/components/feedback/PageSkeleton", () => ({
  PageSkeleton: () => null,
}));
import { useWorkspaceNavigation } from "./useWorkspaceNavigation";

function Probe() {
  const nav = useWorkspaceNavigation();
  return (
    <div
      data-workspace={nav.selected?._id ?? "personal"}
      data-view={nav.view}
      data-label={nav.active?.label}
      data-count={nav.mine?.length}
    />
  );
}
const render = () => renderToStaticMarkup(<Probe />);
describe("membership-aware workspace navigation", () => {
  beforeEach(() =>
    Object.assign(state, {
      pathname: "/dashboard/workspaces",
      query: "workspace=mine&view=cv",
      authenticated: true,
      loading: false,
    }),
  );
  it("resolves only a current member's workspace and allowed menu", () => {
    expect(render()).toContain('data-label="CV saya"');
    state.query = "workspace=mine&view=members";
    expect(render()).toContain('data-view="overview"');
    state.query = "workspace=someone-else&view=cv";
    expect(render()).toContain('data-workspace="personal"');
  });
  it("does not carry workspace identity onto personal pages or anonymous/demo sessions", () => {
    state.pathname = "/dashboard/cv";
    expect(render()).toContain('data-workspace="personal"');
    state.pathname = "/dashboard/workspaces";
    state.authenticated = false;
    expect(render()).toContain('data-count="0"');
    expect(render()).toContain('data-workspace="personal"');
  });
  it("keeps legacy program links and safely falls back for unsupported views", () => {
    state.query = "workspace=mine&program=some-program";
    expect(render()).toContain('data-view="programs"');
    state.query = "workspace=mine&view=https://evil.example";
    expect(render()).toContain('data-view="overview"');
  });
  it("keeps dedicated workspace pages scoped and resolves their feature menu", () => {
    state.pathname = "/dashboard/workspaces/mine/vacancies";
    state.query = "";
    expect(render()).toContain('data-workspace="mine"');
    expect(render()).toContain('data-label="Lowongan"');
    state.pathname = "/dashboard/workspaces/mine/schedules";
    expect(render()).toContain('data-view="schedules"');
    state.pathname = "/dashboard/workspaces/someone-else/vacancies";
    expect(render()).toContain('data-workspace="personal"');
  });
});

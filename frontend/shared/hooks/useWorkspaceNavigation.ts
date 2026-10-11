"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  PRIMARY_NAV,
  MORE_APPS,
  activeNavForPath,
  workspaceNavigation,
  workspaceLocation,
} from "@/shared/lib/dashboardRegistry";

export function useWorkspaceNavigation() {
  const pathname = usePathname();
  const search = useSearchParams();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const result = useQuery(
    api.workspaces.queries.listMine,
    isAuthenticated && pathname.startsWith("/dashboard") ? {} : "skip",
  );
  const mine = isAuthenticated ? result : isLoading ? undefined : [];
  const location = workspaceLocation(pathname, search);
  const selected = mine?.find((w) => w._id === location.id);
  const navigation = selected
    ? workspaceNavigation(selected, search.get("program") ?? undefined)
    : { primary: PRIMARY_NAV, more: MORE_APPS };
  const all = [...navigation.primary, ...navigation.more];
  const requestedView = location.view;
  const active = selected
    ? (all.find(
        (item) =>
          workspaceLocation(
            new URL(item.href, "https://careerpack.org").pathname,
            new URLSearchParams(),
          ).view === requestedView,
      ) ?? navigation.primary[0])
    : activeNavForPath(pathname);
  const view =
    selected && active
      ? workspaceLocation(
          new URL(active.href, "https://careerpack.org").pathname,
          new URLSearchParams(),
        ).view
      : "overview";
  return {
    ...navigation,
    mine,
    selected,
    active,
    view,
    requestedWorkspace: location.id,
  };
}

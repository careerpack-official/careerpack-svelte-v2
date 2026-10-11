"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  PRIMARY_NAV,
  MORE_APPS,
  activeNavForPath,
  workspaceNavigation,
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
  const selected =
    pathname === "/dashboard/workspaces"
      ? mine?.find((w) => w._id === search.get("workspace"))
      : undefined;
  const navigation = selected
    ? workspaceNavigation(selected, search.get("program") ?? undefined)
    : { primary: PRIMARY_NAV, more: MORE_APPS };
  const all = [...navigation.primary, ...navigation.more];
  const requestedView =
    search.get("view") ?? (search.has("program") ? "programs" : "overview");
  const active = selected
    ? (all.find(
        (item) =>
          new URL(item.href, "https://careerpack.org").searchParams.get(
            "view",
          ) === requestedView,
      ) ?? navigation.primary[0])
    : activeNavForPath(pathname);
  const view =
    selected && active
      ? (new URL(active.href, "https://careerpack.org").searchParams.get(
          "view",
        ) ?? "overview")
      : "overview";
  return { ...navigation, mine, selected, active, view };
}

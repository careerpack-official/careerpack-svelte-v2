"use client";

import { useRouter } from "next/navigation";
import {
  Building2,
  ChevronsUpDown,
  Check,
  UserRound,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { useWorkspaceNavigation } from "@/shared/hooks/useWorkspaceNavigation";
import { workspaceHref } from "@/shared/lib/dashboardRegistry";
import { cn } from "@/shared/lib/utils";

export function WorkspaceSwitcher({ mobile = false }: { mobile?: boolean }) {
  const router = useRouter();
  const { mine, selected } = useWorkspaceNavigation();
  const label = selected?.name ?? "Careerpack pribadi";
  const Icon = selected ? Building2 : UserRound;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          aria-label={`Ganti workspace: ${label}`}
          className={cn(
            "min-w-0 justify-start gap-2",
            mobile
              ? "h-11 flex-1 px-0"
              : "h-12 w-full px-2 group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-2",
          )}
        >
          <Icon className="size-4 shrink-0" />
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-left text-sm",
              !mobile && "group-data-[collapsible=icon]:hidden",
            )}
          >
            {label}
          </span>
          <ChevronsUpDown
            className={cn(
              "size-4 shrink-0",
              !mobile && "group-data-[collapsible=icon]:hidden",
            )}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-72 max-w-[calc(100vw-2rem)]"
      >
        <DropdownMenuLabel>Pilih workspace</DropdownMenuLabel>
        <DropdownMenuItem
          className="min-h-[44px]"
          onSelect={() => router.push("/dashboard")}
        >
          <UserRound />
          <span className="min-w-0 flex-1">Careerpack pribadi</span>
          {!selected && <Check className="shrink-0" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {mine === undefined ? (
          <DropdownMenuItem disabled>Memuat workspace…</DropdownMenuItem>
        ) : (
          mine.map((w) => (
            <DropdownMenuItem
              key={w._id}
              className="min-h-[44px] items-start"
              onSelect={() => router.push(workspaceHref(w._id))}
            >
              <Building2 className="mt-1" />
              <span className="min-w-0 flex-1">
                <span className="block break-words">{w.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {w.sector === "hr" ? "HR" : "Interior design"} ·{" "}
                  {w.kind === "institution" ? "Institusi" : "Bisnis"}
                </span>
              </span>
              {selected?._id === w._id && <Check className="mt-1 shrink-0" />}
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="min-h-[44px]"
          onSelect={() => router.push("/dashboard/workspaces")}
        >
          <LayoutGrid />
          Kelola workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


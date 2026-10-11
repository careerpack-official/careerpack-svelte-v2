"use client";

import { CheckCircle2, Circle, Calendar, ChevronRight, FileText } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { indonesianCategoryLabels } from "@/shared/data/indonesianData";
import type { ChecklistItem } from "../../types";
import { categoryIcons } from "../../constants/icons";

export type ChecklistView = "list" | "detail" | "thumbnail";

interface Props {
  item: ChecklistItem;
  view?: ChecklistView;
  onToggle: (id: string) => void;
  onSelect: (item: ChecklistItem) => void;
}

/**
 * One document row in the checklist.
 *
 * a11y — this card used to be `<div role="button" tabIndex={0}>` that
 * *contained* the toggle `<Button>`: a control inside a control, which
 * axe reports as `nested-interactive` (SERIOUS). Keyboard users tabbed
 * into the toggle while the wrapper still claimed to be the focused
 * button, and the wrapper's role lied about what Enter would do.
 *
 * The fix keeps both affordances without nesting: there is exactly one
 * real `<button>` per action, as siblings. The title button carries a
 * stretched `::after` overlay pinned to the card box, so clicking dead
 * space anywhere on the card still opens the detail dialog; the toggle
 * sits on a higher stacking layer (`z-10`) so it owns its own hit area.
 * Dropping `role`/`tabIndex` instead would have traded a reported
 * violation for an unoperable div — the overlay is what preserves the
 * click-anywhere behaviour.
 *
 * Border/radius are `sm:`-gated on purpose: below `sm` this renders as one
 * row inside the parent's single grouped-list card (see `CategorySection`),
 * so an individual border here would double up against the group's own
 * border. From `sm` up each row is its own gapped card again.
 */
export function ChecklistItemCard({ item, view = "detail", onToggle, onSelect }: Props) {
  const Icon = categoryIcons[item.subcategory] || FileText;

  return (
    <div
      className={cn(
        "group relative flex min-w-0 items-start gap-4 p-4 transition-all duration-200 sm:rounded-xl sm:border-2",
        view === "thumbnail" && "flex-col rounded-xl border-2",
        item.completed
          ? "bg-brand/10 sm:border-brand/30"
          : item.required
            ? "bg-card sm:border-border sm:hover:border-brand"
            : "bg-muted/50 sm:border-border sm:hover:border-border",
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={
          item.completed
            ? `Tandai "${item.title}" belum selesai`
            : `Tandai "${item.title}" selesai`
        }
        onClick={() => onToggle(item.id)}
        className={cn(
          // z-10 keeps the toggle above the title button's stretched
          // overlay, so its own click never falls through to "open detail".
          "relative z-10 flex h-8 w-8 min-w-[44px] flex-shrink-0 items-center justify-center rounded-lg transition-all duration-200 lg:min-w-0",
          view === "thumbnail" && "absolute right-3 top-3",
          item.completed
            ? "bg-brand text-brand-foreground hover:bg-brand/90"
            : "bg-muted text-muted-foreground hover:bg-brand-muted hover:text-brand",
        )}
      >
        {item.completed ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
      </Button>

      {view === "thumbnail" && (
        <div aria-hidden="true" className="flex h-24 w-full items-center justify-center rounded-lg bg-muted">
          <Icon className="h-10 w-10 text-muted-foreground" />
        </div>
      )}

      <div className="min-w-0 flex-1 w-full">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className={cn(
              "break-words font-medium",
              item.completed ? "text-brand line-through" : "text-foreground",
            )}>
              <button
                type="button"
                onClick={() => onSelect(item)}
                className={cn(
                  "min-h-[44px] max-w-full break-words text-left lg:min-h-0 after:absolute after:inset-0 after:content-[''] sm:after:rounded-xl",
                  "focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring",
                  "focus-visible:after:ring-offset-2 focus-visible:after:ring-offset-background",
                )}
              >
                {item.title}
                <span className="sr-only"> — buka detail dokumen</span>
              </button>
            </h4>
            {view !== "list" && <p className="mt-0.5 break-words text-sm text-muted-foreground">{item.description}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {item.required && (
              <Badge variant="secondary" className="bg-destructive/10 text-destructive-text text-xs">
                Wajib
              </Badge>
            )}
            <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          </div>
        </div>

        {(view !== "list" || item.dueDate) && <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3">
          {view !== "list" && <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon className="w-3.5 h-3.5" />
            {indonesianCategoryLabels[item.subcategory]}
          </div>}
          {item.dueDate && (
            <div className="flex items-center gap-1.5 text-xs text-warning">
              <Calendar className="w-3.5 h-3.5" />
              Batas: {item.dueDate}
            </div>
          )}
        </div>}
      </div>
    </div>
  );
}

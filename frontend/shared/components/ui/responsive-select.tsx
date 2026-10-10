"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";

import { useIsMobile } from "@/shared/hooks/use-mobile";
import { cn } from "@/shared/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/shared/components/ui/drawer";

/**
 * Responsive Select.
 *
 * Desktop (≥lg): Radix Select (shadcn) — popup list.
 * Mobile (<lg): Drawer bottom-sheet — thumb-friendly, native mobile pattern.
 *
 * Props live on `ResponsiveSelect` root: `value` + `onValueChange`. Items are
 * <ResponsiveSelectItem value=...>. The trigger renders SelectValue on
 * desktop; on mobile a button that opens the drawer + shows selected label.
 */

type Mode = "select" | "drawer";

interface SelectCtx {
  mode: Mode;
  value?: string;
  label?: React.ReactNode;
  onValueChange?: (value: string) => void;
}

const SelectContext = React.createContext<SelectCtx>({
  mode: "select",
});

export interface ResponsiveSelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  children: React.ReactNode;
  forceMode?: Mode;
}

export function ResponsiveSelect({
  value,
  defaultValue,
  onValueChange,
  open,
  onOpenChange,
  disabled,
  children,
  forceMode,
}: ResponsiveSelectProps) {
  const isMobile = useIsMobile();
  const mode: Mode = forceMode ?? (isMobile ? "drawer" : "select");
  const [internalValue, setInternalValue] = React.useState<string | undefined>(
    defaultValue,
  );
  const currentValue = value !== undefined ? value : internalValue;
  // Read labels before the portal mounts so closed mobile selects show their label.
  const findLabel = (nodes: React.ReactNode): React.ReactNode => {
    for (const node of React.Children.toArray(nodes)) {
      if (!React.isValidElement<{ value?: string; children?: React.ReactNode }>(node)) continue;
      if (node.type === ResponsiveSelectItem && node.props.value === currentValue) return node.props.children;
      const label = findLabel(node.props.children);
      if (label !== undefined) return label;
    }
    return undefined;
  };

  const handleChange = (v: string) => {
    if (value === undefined) setInternalValue(v);
    onValueChange?.(v);
  };

  if (mode === "select") {
    return (
      <SelectContext.Provider value={{ mode, value: currentValue, onValueChange: handleChange }}>
        <Select
          value={value}
          defaultValue={defaultValue}
          onValueChange={handleChange}
          open={open}
          onOpenChange={onOpenChange}
          disabled={disabled}
        >
          {children}
        </Select>
      </SelectContext.Provider>
    );
  }
  return (
    <SelectContext.Provider value={{ mode, value: currentValue, label: findLabel(children), onValueChange: handleChange }}>
      <Drawer open={open} onOpenChange={onOpenChange}>
        {children}
      </Drawer>
    </SelectContext.Provider>
  );
}

export interface ResponsiveSelectTriggerProps
  extends React.ComponentProps<typeof SelectTrigger> {
  /** Placeholder text when no value selected. */
  placeholder?: string;
}

export function ResponsiveSelectTrigger({
  className,
  placeholder,
  children,
  ...props
}: ResponsiveSelectTriggerProps) {
  const { mode, value, label: selectedLabel } = React.useContext(SelectContext);

  if (mode === "select") {
    return (
      <SelectTrigger className={className} {...props}>
        {children ?? <SelectValue placeholder={placeholder} />}
      </SelectTrigger>
    );
  }

  const label = value ? selectedLabel ?? value : placeholder;

  return (
    <DrawerTrigger asChild>
      <button
        type="button"
        data-slot="responsive-select-trigger"
        className={cn(
          "flex min-h-[44px] min-w-0 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
          "focus:outline-none focus:ring-1 focus:ring-ring",
          !value && "text-muted-foreground",
          className,
        )}
        {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        <span className="min-w-0 break-words text-left">{label}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
      </button>
    </DrawerTrigger>
  );
}

export interface ResponsiveSelectContentProps
  extends React.ComponentProps<typeof SelectContent> {
  drawerTitle?: string;
  drawerClassName?: string;
}

export function ResponsiveSelectContent({
  className,
  drawerTitle,
  drawerClassName,
  children,
  ...props
}: ResponsiveSelectContentProps) {
  const { mode } = React.useContext(SelectContext);
  if (mode === "select") {
    return (
        <SelectContent className={className} {...props}>
          {children}
        </SelectContent>
    );
  }
  return (
      <DrawerContent className={cn("mx-auto w-full min-w-0 max-h-[85dvh] sm:max-w-lg", drawerClassName)}>
        <DrawerHeader className={drawerTitle ? "pb-1" : "sr-only"}>
          <DrawerTitle className={drawerTitle ? "" : "sr-only"}>
            {drawerTitle ?? "Pilih opsi"}
          </DrawerTitle>
        </DrawerHeader>
        <div className="min-h-0 min-w-0 overflow-y-auto px-2 pb-[max(1rem,var(--safe-bottom))]">
          {children}
        </div>
      </DrawerContent>
  );
}

export interface ResponsiveSelectItemProps
  extends React.ComponentProps<typeof SelectItem> {
  value: string;
}

export function ResponsiveSelectItem({
  value,
  children,
  className,
  ...props
}: ResponsiveSelectItemProps) {
  const { mode, value: selected, onValueChange } = React.useContext(SelectContext);
  if (mode === "select") {
    return (
      <SelectItem value={value} className={className} {...props}>
        {children}
      </SelectItem>
    );
  }
  const checked = selected === value;
  return (
    <DrawerClose asChild>
      <button
        type="button"
        role="option"
        aria-selected={checked}
        onClick={() => onValueChange?.(value)}
        className={cn(
          "flex min-h-[44px] min-w-0 w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm outline-none",
          "hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
            checked ? "border-brand bg-brand text-brand-foreground" : "border-muted-foreground/40",
          )}
        >
          {checked && <Check className="h-3 w-3" />}
        </span>
        <span className="min-w-0 flex-1 break-words">{children}</span>
      </button>
    </DrawerClose>
  );
}

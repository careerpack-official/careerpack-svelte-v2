"use client";

import * as React from "react";

import { useIsMobile } from "@/shared/hooks/use-mobile";
import { cn } from "@/shared/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/components/ui/alert-dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/shared/components/ui/drawer";
import { Button, buttonVariants } from "@/shared/components/ui/button";

/**
 * Responsive AlertDialog.
 *
 * Desktop (≥lg): AlertDialog modal klasik — centred, destructive confirmations.
 * Mobile (<lg): Drawer bottom-sheet — lebih thumb-friendly, swipe-to-dismiss.
 *
 * API mirror `alert-dialog.tsx` dengan prefix `ResponsiveAlertDialog*`.
 * `Action` + `Cancel` render tombol native Drawer di mobile supaya tap-target
 * lebih besar (min 44px) — konversi otomatis via Context.
 */

type Mode = "dialog" | "drawer";

const ResponsiveAlertDialogContext = React.createContext<Mode>("dialog");

function useMode(): Mode {
  return React.useContext(ResponsiveAlertDialogContext);
}

export interface ResponsiveAlertDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  /** Force a specific mode (test / override). Default: auto via useIsMobile. */
  forceMode?: Mode;
}

export function ResponsiveAlertDialog({
  open,
  onOpenChange,
  children,
  forceMode,
}: ResponsiveAlertDialogProps) {
  const isMobile = useIsMobile();
  const mode: Mode = forceMode ?? (isMobile ? "drawer" : "dialog");
  const Root = mode === "dialog" ? AlertDialog : Drawer;

  return (
    <ResponsiveAlertDialogContext.Provider value={mode}>
      <Root open={open} onOpenChange={onOpenChange}>
        {children}
      </Root>
    </ResponsiveAlertDialogContext.Provider>
  );
}

export function ResponsiveAlertDialogTrigger(
  props: React.ComponentProps<typeof AlertDialogTrigger>,
) {
  const mode = useMode();
  const Trigger = mode === "dialog" ? AlertDialogTrigger : DrawerTrigger;
  return <Trigger {...props} />;
}

export interface ResponsiveAlertDialogContentProps
  extends React.ComponentProps<typeof AlertDialogContent> {
  drawerClassName?: string;
}

export function ResponsiveAlertDialogContent({
  className,
  drawerClassName,
  children,
  ...props
}: ResponsiveAlertDialogContentProps) {
  const mode = useMode();
  if (mode === "dialog") {
    return (
      <AlertDialogContent className={className} {...props}>
        {children}
      </AlertDialogContent>
    );
  }
  return (
    <DrawerContent
      className={cn("mx-auto w-full min-w-0 max-h-[90dvh] sm:max-w-lg", drawerClassName)}
      {...(props as React.ComponentProps<typeof DrawerContent>)}
    >
      <div className="min-h-0 min-w-0 space-y-4 overflow-y-auto p-4 pb-[max(1rem,var(--safe-bottom))]">{children}</div>
    </DrawerContent>
  );
}

export function ResponsiveAlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const mode = useMode();
  const Header = mode === "dialog" ? AlertDialogHeader : DrawerHeader;
  return <Header className={cn(mode === "drawer" && "p-0 text-left", className)} {...props} />;
}

export function ResponsiveAlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const mode = useMode();
  const Footer = mode === "dialog" ? AlertDialogFooter : DrawerFooter;
  return <Footer className={cn(mode === "drawer" && "m-0 p-0", className)} {...props} />;
}

export function ResponsiveAlertDialogTitle(
  props: React.ComponentProps<typeof AlertDialogTitle>,
) {
  const mode = useMode();
  const Title = mode === "dialog" ? AlertDialogTitle : DrawerTitle;
  return <Title {...props} />;
}

export function ResponsiveAlertDialogDescription(
  props: React.ComponentProps<typeof AlertDialogDescription>,
) {
  const mode = useMode();
  const Description =
    mode === "dialog" ? AlertDialogDescription : DrawerDescription;
  return <Description {...props} />;
}

/**
 * Destructive/confirm action button. Desktop: styled AlertDialogAction
 * (closes dialog + runs onClick). Mobile: plain Button inside DrawerClose so
 * swipe/tap auto-closes after action fires.
 */
export interface ResponsiveAlertDialogActionProps
  extends React.ComponentProps<typeof AlertDialogAction> {
  /** Tailwind variant — default "default"; pass "destructive" for delete etc. */
  variant?: "default" | "destructive";
}

export function ResponsiveAlertDialogAction({
  className,
  variant = "default",
  ...props
}: ResponsiveAlertDialogActionProps) {
  const mode = useMode();
  if (mode === "dialog") {
    return (
      <AlertDialogAction
        className={cn(
          variant === "destructive" &&
            "bg-destructive text-destructive-foreground hover:bg-destructive/90",
          className,
        )}
        {...props}
      />
    );
  }
  return (
    <DrawerClose asChild>
      <Button
        type="button"
        variant={variant === "destructive" ? "destructive" : "default"}
        className={className}
        {...(props as React.ComponentProps<typeof Button>)}
      />
    </DrawerClose>
  );
}

export function ResponsiveAlertDialogCancel({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogCancel>) {
  const mode = useMode();
  if (mode === "dialog") {
    return (
      <AlertDialogCancel
        className={cn(buttonVariants({ variant: "outline" }), className)}
        {...props}
      />
    );
  }
  return (
    <DrawerClose asChild>
      <Button
        type="button"
        variant="outline"
        className={className}
        {...(props as React.ComponentProps<typeof Button>)}
      />
    </DrawerClose>
  );
}

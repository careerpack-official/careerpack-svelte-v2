import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

/** Shared dashboard frame; the shell supplies horizontal gutters. */
export interface PageContainerProps {
  className?: string;
  children: ReactNode;
}

export function PageContainer({ className, children }: PageContainerProps) {
  return (
    <div className={cn("mx-auto w-full min-w-0 max-w-7xl py-4 sm:py-6", className)}>
      {children}
    </div>
  );
}

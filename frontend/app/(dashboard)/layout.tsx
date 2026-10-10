import type { ReactNode } from "react";
import { RouteGuard } from "@/shared/components/auth/RouteGuard";
import { ResponsiveContainer } from "@/shared/containers/ResponsiveContainer";
import { ErrorBoundary } from "@/shared/components/error/ErrorBoundary";
import { DemoBanner } from "@/shared/components/auth/DemoBanner";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <RouteGuard mode="auth">
      <ErrorBoundary title="Dashboard bermasalah">
        <ResponsiveContainer>
          {/* Renders only in anonymous/demo sessions. Real users
              never see it. Pinned above every dashboard page. */}
          <DemoBanner />
          {children}
        </ResponsiveContainer>
      </ErrorBoundary>
    </RouteGuard>
  );
}

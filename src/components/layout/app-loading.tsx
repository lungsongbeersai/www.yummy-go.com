"use client";

import { usePathname } from "next/navigation";
import { LoadingState } from "@/components/common/loading-state";
import { isPublicAppPath } from "@/components/layout/shell-menu-helpers";
import { AppShellSkeleton } from "@/components/layout/web/app-shell-skeleton";
import { useIsCapacitorNativeApp } from "@/hooks/use-capacitor-native-app";

// Route-level loading UI for the whole app (src/app/loading.tsx). Staff routes load inside
// the web shell, so their skeleton shows the sidebar + header too; public pages and the
// Capacitor build (which has its own native shell) keep the plain content skeleton.
export function AppLoading() {
  const pathname = usePathname();
  const isNativeApp = useIsCapacitorNativeApp();

  if (isNativeApp || isPublicAppPath(pathname)) return <LoadingState />;
  return <AppShellSkeleton />;
}

"use client";

import { useTranslation } from "react-i18next";
import { usePosOrderAlertListener } from "@/hooks/use-pos-order-alert-listener";
import { usePrinterSupportQueue } from "@/hooks/use-printer-support-queue";
import { useSharedPrinterQueue } from "@/hooks/use-shared-printer-queue";
import { DesktopShellFrame } from "@/components/layout/desktop-shell-frame";
import { useAppShellData } from "@/components/layout/use-app-shell-data";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useNavigationGuardStore } from "@/stores/navigation-guard-store";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const runGuardedNavigation = useNavigationGuardStore((state) => state.run);
  const collapsed = useAppStore((state) => state.collapsed);
  const setCollapsed = useAppStore((state) => state.setCollapsed);
  usePosOrderAlertListener({ branchUuid: user?.branch_uuid, language: i18n.language });
  useSharedPrinterQueue();
  usePrinterSupportQueue();
  const shellData = useAppShellData();

  return (
    <DesktopShellFrame
      shellData={shellData}
      user={user}
      collapsed={collapsed}
      onCollapsedChange={setCollapsed}
      onLogout={() => runGuardedNavigation(logout)}
    >
      {children}
    </DesktopShellFrame>
  );
}

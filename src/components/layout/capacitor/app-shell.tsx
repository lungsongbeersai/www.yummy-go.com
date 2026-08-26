"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { usePosOrderAlertListener } from "@/hooks/use-pos-order-alert-listener";
import { cn } from "@/lib/utils";
import { useAppShellData } from "@/components/layout/use-app-shell-data";
import { buildNativeNavigationModel } from "@/components/layout/native-navigation-model";
import { useAndroidBackButton } from "@/components/layout/capacitor/use-android-back-button";
import { useKeyboardVisible } from "@/components/layout/capacitor/use-keyboard-visible";
import { NativeTopBar } from "@/components/layout/capacitor/top-bar";
import { NativeBottomNav } from "@/components/layout/capacitor/bottom-nav";
import { NativeMoreSheet } from "@/components/layout/capacitor/more-sheet";
import { NativeSideRail } from "@/components/layout/capacitor/side-rail";
import { usePullToRefresh } from "@/components/layout/capacitor/use-pull-to-refresh";
import { NativePullToRefreshIndicator } from "@/components/layout/capacitor/pull-to-refresh-indicator";
import { useAuthStore } from "@/stores/auth-store";

export function NativeAppShell({ children }: { children: React.ReactNode }) {
  const { i18n, t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const {
    breadcrumbs,
    fixedDataScreen,
    menuError,
    menuItems,
    menuLoading,
    pathname,
    retrySidebarMenu,
  } = useAppShellData();
  usePosOrderAlertListener({
    branchUuid: user?.branch_uuid,
    language: i18n.language,
  });

  const model = useMemo(
    () => buildNativeNavigationModel(menuItems),
    [menuItems],
  );
  const [moreOpen, setMoreOpen] = useState(false);
  const keyboardVisible = useKeyboardVisible();
  const closeMore = useCallback(() => setMoreOpen(false), []);
  // ปิดบนหน้า fixedDataScreen (เช่น POS order/table) เพราะหน้าเหล่านี้มี scroll area
  // ของตัวเองแยกจาก document — ดึงที่ขอบบนสุดของหน้าจะไปชนกับท่าทางภายในจอนั้นแทน
  const { pullDistance, refreshing, threshold } = usePullToRefresh(!fixedDataScreen);

  useAndroidBackButton({
    model,
    onCloseOverlay: closeMore,
    overlayOpen: moreOpen,
    pathname,
  });

  // scroll-lock และ pos-android-system-screen จัดการอยู่ใน useAppShellData ร่วมกับ web shell

  return (
    <div
      className={cn(
        "app-shell flex min-h-0 w-full flex-col text-foreground",
        fixedDataScreen ? "h-dvh overflow-hidden" : "min-h-dvh",
      )}
      data-fixed-screen={fixedDataScreen ? "true" : "false"}
      data-keyboard-open={keyboardVisible ? "true" : "false"}
      data-platform="capacitor"
    >
      <a
        href="#app-main-content"
        className="fixed left-2 top-2 z-100 -translate-y-24 rounded-md bg-background px-4 py-3 font-bold text-foreground shadow-lg transition-transform focus:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t("app.skipToContent")}
      </a>

      <NativeTopBar
        breadcrumbs={breadcrumbs}
        model={model}
        pathname={pathname}
      />

      <NativePullToRefreshIndicator
        pullDistance={pullDistance}
        refreshing={refreshing}
        threshold={threshold}
      />

      {/* app-shell-body moves here from <main> — this div, not <main> alone, is now the
          flex-1 row occupying the space below the top bar (side rail + content side by
          side), matching how the web shell's .app-shell-body wraps sidebar + main together */}
      <div className="app-shell-body flex min-h-0 w-full flex-1">
        <NativeSideRail
          error={menuError}
          loading={menuLoading}
          model={model}
          moreOpen={moreOpen}
          onMoreClick={() => setMoreOpen(true)}
          onRetry={retrySidebarMenu}
          pathname={pathname}
        />
        <main
          id="app-main-content"
          tabIndex={-1}
          className={cn(
            "min-w-0 flex-1 pb-(--app-shell-bottom-nav-height)",
            fixedDataScreen ? "min-h-0 overflow-hidden" : "overflow-visible",
          )}
        >
          {children}
        </main>
      </div>

      <NativeBottomNav
        error={menuError}
        loading={menuLoading}
        model={model}
        moreOpen={moreOpen}
        onMoreClick={() => setMoreOpen(true)}
        onRetry={retrySidebarMenu}
        pathname={pathname}
      />

      <NativeMoreSheet
        model={model}
        onOpenChange={setMoreOpen}
        open={moreOpen}
        pathname={pathname}
      />
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { usePosOrderAlertListener } from "@/hooks/use-pos-order-alert-listener";
import { cn } from "@/lib/utils";
import { useAppShellData } from "@/components/layout/use-app-shell-data";
import { buildNativeNavigationModel } from "@/components/layout/native-navigation-model";
import { NativeTopBar } from "@/components/layout/capacitor/top-bar";
import { NativeBottomNav } from "@/components/layout/capacitor/bottom-nav";
import { NativeSideRail } from "@/components/layout/capacitor/side-rail";
import { useAuthStore } from "@/stores/auth-store";

export function NativeAppShell({ children }: { children: React.ReactNode }) {
  const { i18n, t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const { breadcrumbs, fixedDataScreen, menuItems, pathname } =
    useAppShellData();
  usePosOrderAlertListener({
    branchUuid: user?.branch_uuid,
    language: i18n.language,
  });

  const model = useMemo(
    () => buildNativeNavigationModel(menuItems),
    [menuItems],
  );
  const [moreOpen, setMoreOpen] = useState(false);

  // หน้าที่มี scroll ภายในของตัวเองต้องล็อก document ไม่งั้น Android เลื่อนสองชั้น
  useEffect(() => {
    if (!fixedDataScreen) return;
    document.documentElement.classList.add("data-screen-scroll-lock");
    document.body.classList.add("data-screen-scroll-lock");

    return () => {
      document.documentElement.classList.remove("data-screen-scroll-lock");
      document.body.classList.remove("data-screen-scroll-lock");
    };
  }, [fixedDataScreen]);

  return (
    <div
      className={cn(
        "app-shell flex min-h-0 w-full flex-col text-foreground",
        fixedDataScreen ? "h-dvh overflow-hidden" : "min-h-dvh",
      )}
      data-fixed-screen={fixedDataScreen ? "true" : "false"}
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

      {/* app-shell-body moves here from <main> — this div, not <main> alone, is now the
          flex-1 row occupying the space below the top bar (side rail + content side by
          side), matching how the web shell's .app-shell-body wraps sidebar + main together */}
      <div className="app-shell-body flex min-h-0 w-full flex-1">
        <NativeSideRail
          model={model}
          moreOpen={moreOpen}
          onMoreClick={() => setMoreOpen(true)}
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
        model={model}
        moreOpen={moreOpen}
        onMoreClick={() => setMoreOpen(true)}
        pathname={pathname}
      />
    </div>
  );
}

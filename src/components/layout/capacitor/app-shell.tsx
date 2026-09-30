"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { usePosOrderAlertListener } from "@/hooks/use-pos-order-alert-listener";
import { useSharedPrinterQueue } from "@/hooks/use-shared-printer-queue";
import { cn } from "@/lib/utils";
import { useAppShellData } from "@/components/layout/use-app-shell-data";
import {
  buildNativeNavigationModel,
  NATIVE_DIRECT_DESTINATION_COUNT,
} from "@/components/layout/native-navigation-model";
import { useAndroidBackButton } from "@/components/layout/capacitor/use-android-back-button";
import { useKeyboardVisible } from "@/components/layout/capacitor/use-keyboard-visible";
import { NativeTopBar } from "@/components/layout/capacitor/top-bar";
import { Swan1HomeTopBar } from "@/components/layout/capacitor/swan1-home-top-bar";
import { NativeBottomNav } from "@/components/layout/capacitor/bottom-nav";
import { NativeSideRail } from "@/components/layout/capacitor/side-rail";
import { usePullToRefresh } from "@/components/layout/capacitor/use-pull-to-refresh";
import { NativePullToRefreshIndicator } from "@/components/layout/capacitor/pull-to-refresh-indicator";
import { useAuthStore } from "@/stores/auth-store";
import { useSwan1DesktopPosLayout } from "@/hooks/use-swan1-desktop-pos-layout";
import { useSwan1DesktopHomeLayout } from "@/hooks/use-swan1-desktop-home-layout";
import { useAppStore } from "@/stores/app-store";

export function NativeAppShell({ children }: { children: React.ReactNode }) {
  const { i18n, t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const {
    breadcrumbs,
    fixedDataScreen,
    menuError,
    menuItems,
    menuLoading,
    openMenus,
    pathname,
    retrySidebarMenu,
    toggleMenu,
  } = useAppShellData();
  usePosOrderAlertListener({
    branchUuid: user?.branch_uuid,
    language: i18n.language,
  });
  useSharedPrinterQueue();

  // model นี้ตอนนี้ใช้แค่กับ NativeTopBar (เช็คว่าควรโชว์ปุ่ม back ไหม) กับ NativeBottomNav
  // (แถบล่างมือถือ ปลายทางจำกัดจำนวน) เท่านั้น — NativeSideRail (แท็บเล็ต/แนวนอน) เปลี่ยนไปใช้
  // AppSidebar ตัวเดียวกับเว็บที่โชว์ menuItems เต็มต้นไม้แล้ว ไม่ต้องมี count จำกัดแบบ rail อีก
  const model = useMemo(
    () => buildNativeNavigationModel(menuItems, NATIVE_DIRECT_DESTINATION_COUNT),
    [menuItems],
  );
  const keyboardVisible = useKeyboardVisible();
  const desktopPosLayout = useSwan1DesktopPosLayout();
  const desktopHomeLayout = useSwan1DesktopHomeLayout();
  const sidebarCollapsed = useAppStore((state) => state.collapsed);
  // ปิดบนหน้า fixedDataScreen (เช่น POS order/table) เพราะหน้าเหล่านี้มี scroll area
  // ของตัวเองแยกจาก document — ดึงที่ขอบบนสุดของหน้าจะไปชนกับท่าทางภายในจอนั้นแทน
  const { pullDistance, refreshing, threshold } = usePullToRefresh(!fixedDataScreen);

  useAndroidBackButton({ model, pathname });

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
      data-desktop-pos-layout={desktopPosLayout ? "true" : undefined}
      data-desktop-pos-order-layout={desktopPosLayout && pathname === "/posAll/order" ? "true" : undefined}
      data-desktop-home-layout={desktopHomeLayout ? "true" : undefined}
      data-home-sidebar-collapsed={desktopHomeLayout && sidebarCollapsed ? "true" : undefined}
    >
      <a
        href="#app-main-content"
        className="fixed left-2 top-2 z-100 -translate-y-24 rounded-md bg-background px-4 py-3 font-bold text-foreground shadow-lg transition-transform focus:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t("app.skipToContent")}
      </a>

      {/* Swan 1 uses its own desktop-style header on the dashboard and POS.
          NativeAppShell stays mounted so Android hardware Back still works. */}
      {desktopHomeLayout ? (
        <Swan1HomeTopBar breadcrumbs={breadcrumbs} />
      ) : !desktopPosLayout ? (
        <NativeTopBar
          breadcrumbs={breadcrumbs}
          model={model}
          pathname={pathname}
        />
      ) : null}

      <NativePullToRefreshIndicator
        pullDistance={pullDistance}
        refreshing={refreshing}
        threshold={threshold}
      />

      {/* app-shell-body moves here from <main> — this div, not <main> alone, is now the
          flex-1 row occupying the space below the top bar (side rail + content side by
          side), matching how the web shell's .app-shell-body wraps sidebar + main together */}
      <div className="app-shell-body flex min-h-0 w-full flex-1">
        {/* หน้าเลือกโต๊ะ (/posAll/tables) ซ่อน rail — ผังโต๊ะต้องใช้ความกว้างเต็มจอ และมีปุ่ม
            Back ในหัวข้อแทนแล้ว (ดู BACK_FALLBACK_PATHS ใน native-navigation-model.ts)
            ไม่ต้องพึ่งการนำทางผ่าน rail */}
        {desktopPosLayout || pathname === "/posAll/tables" ? null : (
          <NativeSideRail
            error={menuError}
            loading={menuLoading}
            menuItems={menuItems}
            onRetry={retrySidebarMenu}
            openMenus={openMenus}
            pathname={pathname}
            desktopHomeLayout={desktopHomeLayout}
            toggleMenu={toggleMenu}
          />
        )}
        <main
          id="app-main-content"
          tabIndex={-1}
          className={cn(
            "min-w-0 flex-1",
            // หน้าปกติ (ไม่ใช่ fixedDataScreen อย่าง POS/product-form) ไม่เคยมี padding
            // รอบเนื้อหาให้เลยบน Capacitor มาก่อน — ต่างจาก web/app-shell.tsx ที่ให้
            // "p-4 lg:p-6" เสมอ ผลคือทุกหน้าที่ไม่ได้เผื่อ padding ของตัวเอง (เช่น
            // order-queue-page.tsx) เนื้อหาแนบขอบจอเป๊ะ ๆ ไม่มีที่หายใจเลย
            //
            // ต้องเป็น "pt-3 px-3" ไม่ใช่ "p-3" — p-3 เป็น shorthand ตั้ง padding ทุกด้าน
            // รวม padding-bottom ด้วย tailwind-merge เห็นว่าชนกับ pb-(--app-shell-bottom-nav-
            // height) ด้านบนแล้วตัด class นั้นทิ้งไปเลย (ตัวหลังชนะ) เหลือ padding-bottom
            // แค่ 0.75rem ไม่พอกันแถบ nav ~64px+ เนื้อหาแถวสุดท้ายเลยโดนแถบ nav บัง
            //
            // pb-(--app-shell-bottom-nav-height) ย้ายเข้ามาเฉพาะ branch นี้ — หน้า fixedDataScreen
            // (products/stock/printers/settings/report ฯลฯ) จัดการ scroll เองข้างในอยู่แล้ว และ
            // ทุกหน้ามี footer/pagination ของตัวเองที่กันความสูงแถบ nav ไว้แล้ว (ดู stock-page.tsx,
            // report-table-card.tsx, settings-shell.tsx ฯลฯ) ถ้า main ชั้นนอกกันซ้ำอีกชั้นจะกลาย
            // เป็นจองพื้นที่ว่างสองรอบซ้อนกัน (~150px) ทำให้ footer ข้างในดูสูงเกินจริงตามที่รายงานมา
            //
            // max(...) ไม่ใช่แค่ตัวแปรเดียว — บนมือถือ bottom nav ทำหน้าที่เป็น safe-area
            // footer อยู่แล้วในตัว (--app-shell-bottom-nav-height รวม safe-area-inset-bottom
            // ไว้ใน globals.css แล้ว) แต่บน iPad/tablet (md:) แถบนี้เปลี่ยนไปเป็น side rail
            // แนวตั้งแทน ไม่ได้กินพื้นที่ล่างจอเลย --app-shell-bottom-nav-height เลยกลายเป็น 0
            // และไม่มีอะไรกันโซน safe-area (home indicator/gesture bar) ด้านล่างให้เนื้อหาอีก —
            // max() เลือกใช้ --pos-system-bottom-safe-area (โทเคน safe-area กลางของแอป) แทน
            // เมื่อ bottom-nav-height เป็น 0
            fixedDataScreen
              ? "min-h-0 overflow-hidden"
              : desktopHomeLayout
                ? "mx-auto w-full max-w-375 overflow-visible p-4 lg:p-6"
                : "overflow-visible pb-[max(var(--app-shell-bottom-nav-height,0px),var(--pos-system-bottom-safe-area,0px))] pt-3 px-3",
          )}
        >
          {children}
        </main>
      </div>

      {!desktopPosLayout ? (
        <NativeBottomNav
          error={menuError}
          loading={menuLoading}
          model={model}
          onRetry={retrySidebarMenu}
          pathname={pathname}
        />
      ) : null}
    </div>
  );
}

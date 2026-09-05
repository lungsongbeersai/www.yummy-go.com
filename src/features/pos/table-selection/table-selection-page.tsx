"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, RefreshCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { NotificationMenu } from "@/components/layout/notification-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { useIsAndroidNativeApp } from "@/hooks/use-android-native-app";
import { useIsNativeShellActive } from "@/hooks/use-native-shell-active";
import { useOfflineRefetchEpoch } from "@/hooks/use-offline-refetch";
import { cn } from "@/lib/utils";
import type { PosTable } from "@/services/pos";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useNativeHeaderStore } from "@/stores/native-header-store";
import { usePosStore } from "@/stores/pos-store";
import { useToastStore } from "@/stores/toast-store";
import { TableListSection } from "./table-list-section";
import type { TableStatusFilter } from "./types";
import { formatClock } from "./utils";
import { useTableAlerts } from "./hooks/use-table-alerts";

const headerIconButtonClass = "relative size-[40px] rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-0 text-primary-foreground shadow-sm backdrop-blur-sm hover:bg-primary-foreground/20 hover:text-primary-foreground dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 dark:hover:text-white";

export function TableSelectionPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const language = useAppStore((state) => state.language);
  const zones = usePosStore((state) => state.zones);
  const zoneOptions = usePosStore((state) => state.zoneOptions);
  const loading = usePosStore((state) => state.loading);
  const loadTables = usePosStore((state) => state.loadTables);
  const refreshTables = usePosStore((state) => state.refreshTables);
  const showToast = useToastStore((state) => state.show);
  const nativeShellActive = useIsNativeShellActive();
  const isAndroidNative = useIsAndroidNativeApp();
  const offlineSession = useAuthStore((state) => state.offlineSession);
  // Not useOfflineReadOnly(): that hook means "offline, full stop" and would
  // wrongly lock this out on web/Electron too, where opening a table while
  // offline works fine through the Local Agent. Only Android has no Agent to
  // create the order against — see the /pos/tables comment in offline-routes.ts
  // for why the page itself still stays visible (read-only) on Android offline.
  const androidOfflineWriteBlocked = isAndroidNative && offlineSession;
  const setHeaderRefreshAction = useNativeHeaderStore((state) => state.setRefreshAction);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TableStatusFilter>("all");
  const [now, setNow] = useState(() => new Date());

  const branchUuid = user?.branch_uuid ?? "";
  const skipTableSelection = user?.store_table_status === 2;
  // Refetch once when the backend transport verdict flips (net dropped or came
  // back) so the grid switches between Local Agent and backend data on its own.
  const refetchEpoch = useOfflineRefetchEpoch();

  // ไม่ส่ง zone_uuid เลย — โหลดทุกโซนมาแสดงพร้อมกันเสมอ การ "เลือกโซน" ที่หน้า
  // จอเป็นแค่การเลื่อนไปยัง section นั้น (ดู scrollToZone ใน table-list-section.tsx)
  // ไม่ใช่การกรองข้อมูล เพราะกรองแล้วจะซ่อนโต๊ะ/ป้ายออเดอร์ใหม่ของโซนอื่นไปหมด
  const load = useCallback(async () => {
    if (!branchUuid) return [];
    try {
      return await loadTables({ branch_uuid_fk: branchUuid, zone_uuid: "", lang: language });
    } catch (error) {
      showToast({ title: t("pos.failedTables"), description: error instanceof Error ? error.message : "", tone: "error" });
      return [];
    }
  }, [branchUuid, language, loadTables, showToast, t]);

  useTableAlerts({
    branchUuid: user?.branch_uuid,
    language,
    refreshTables
  });

  // ร้านไม่มีโต๊ะ (store_table_status === 2) ข้ามหน้าเลือกโต๊ะไปเลย —
  // ไม่ยิง loadTables และไม่ render grid ระหว่างรอ redirect
  useEffect(() => {
    if (skipTableSelection) router.replace("/pos/order");
  }, [router, skipTableSelection]);

  useEffect(() => {
    if (skipTableSelection) return;
    void load();
  }, [load, skipTableSelection]);

  // On an online<->offline flip, refresh silently (refreshTables carries no
  // loading flag) so the grid swaps its data source without a visible reload.
  useEffect(() => {
    if (skipTableSelection || !branchUuid || refetchEpoch === 0) return;
    void refreshTables({ branch_uuid_fk: branchUuid, zone_uuid: "", lang: language })
      .catch(() => undefined);
  }, [branchUuid, language, refetchEpoch, refreshTables, skipTableSelection]);

  // นาฬิกาในหัวข้อสีเขียวมีแค่ฝั่งเว็บ (ดูเหตุผลเรื่อง header ด้านล่าง) — ไม่ต้องนับ
  // ทุกวินาทีทิ้งเปล่า ๆ บน Capacitor ที่ไม่ได้เรนเดอร์มันอยู่แล้ว
  useEffect(() => {
    if (nativeShellActive) return;
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, [nativeShellActive]);

  // ปุ่มรีเฟรชย้ายเข้า NativeTopBar (capacitor/top-bar.tsx) แทนแถวโซนในตัวหน้า —
  // ลงทะเบียน action ผ่าน store กลางเพราะ top bar เรนเดอร์อยู่คนละต้นไม้กับหน้านี้
  // (ดู native-header-store.ts) ต้องเคลียร์ตอน unmount ไม่งั้นปุ่มจะค้างอยู่ในหน้าอื่น
  // ที่ไม่มีอะไรให้รีเฟรช ชี้ closure ของ load() เก่าของหน้านี้
  useEffect(() => {
    if (!nativeShellActive) return;
    setHeaderRefreshAction({ loading, onClick: () => void load() });
    return () => setHeaderRefreshAction(null);
  }, [nativeShellActive, loading, load, setHeaderRefreshAction]);

  function selectTable(table: PosTable) {
    if (androidOfflineWriteBlocked) {
      showToast({ title: t("pos.tableOpenUnavailableOffline"), tone: "info" });
      return;
    }
    const params = new URLSearchParams({ table_uuid: table.table_uuid });
    if (table.table_name) params.set("table_name", table.table_name);
    const target = `/pos/order?${params.toString()}` as const;
    // A document navigation lets the service worker use the warmed /pos/order
    // shell even when a Next.js RSC prefetch was not completed before Wi-Fi drops.
    if (navigator.onLine === false) {
      window.location.assign(target);
      return;
    }
    router.push(target);
  }

  if (skipTableSelection) return null;

  // ทั้งเว็บและ AppShell บน Capacitor (จอกว้าง/แนวนอน) ซ่อน AppHeader ทั้งก้อนบนหน้า
  // immersive แบบนี้ (ดู !immersiveScreen ใน app-shell.tsx) หน้านี้จึงไม่มี header ของ
  // shell ให้เลย ต้องมี header สีเขียว + พื้นหลังลายของตัวเองไว้ — ต่างจากตอน NativeAppShell
  // ทำงานจริง (nativeShellActive) ที่ NativeTopBar โชว์อยู่แล้วทุกหน้ารวมหน้านี้ด้วย
  // (ตามที่ตกลงกันไว้) ใส่ซ้ำจะกลายเป็น header 2 ชั้น
  if (nativeShellActive) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <TableListSection
          loading={loading}
          search={search}
          selectedTable={null}
          statusFilter={statusFilter}
          zoneOptions={zoneOptions}
          zones={zones}
          onSearchChange={setSearch}
          onSelectTable={selectTable}
          onStatusFilterChange={setStatusFilter}
        />
      </div>
    );
  }

  return (
    <div data-pos-pattern="true" className="relative h-full min-h-0 overflow-hidden bg-[url('/pos/background_wide.webp')] bg-cover bg-top dark:bg-none dark:bg-background">
      <div aria-hidden="true" data-pos-pattern-overlay="true" className="pointer-events-none absolute inset-0 bg-primary/45 dark:hidden" />
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
        {/* min-h ไม่ใช่ h คงที่ + pt safe-area — header นี้เป็น header บนสุดของหน้าจริง ๆ เสมอ
            (ไม่มี NativeTopBar/AppHeader ด้านบนให้บนหน้า immersive แบบนี้) ต้องกันพื้นที่
            status bar เองตอนรันบน Capacitor จอกว้าง/แนวนอน — env() เป็น 0 อยู่แล้วบนจอที่ไม่มี
            notch/status bar (เว็บเดสก์ท็อป) จึงไม่ต้องเช็ค platform เพิ่ม ปุ่ม/นาฬิกาที่ centered
            ด้วย items-center/top-1/2 ยังอยู่กึ่งกลางของกล่องใหม่ที่สูงขึ้นให้เองอัตโนมัติ */}
        <header className="relative flex min-h-18 shrink-0 items-center justify-between overflow-hidden px-3 pt-[env(safe-area-inset-top,0px)] text-primary-foreground shadow-sm sm:min-h-20 sm:px-4">
          <Button aria-label={t("actions.back")} className={headerIconButtonClass} size="icon" type="button" variant="ghost" onClick={() => router.replace("/")}>
            <ChevronLeft />
          </Button>
          <p className="absolute left-1/2 top-1/2 max-w-55 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-xl font-black leading-none tracking-wide tabular-nums text-primary-foreground dark:text-white sm:text-3xl">{formatClock(now)}</p>
          <div className="relative flex min-w-0 items-center gap-1.5">
            <NotificationMenu triggerClassName={cn(headerIconButtonClass, "hidden min-[430px]:inline-flex")} triggerVariant="ghost" />
            <LanguageSwitch className={cn(headerIconButtonClass, "hidden min-[500px]:inline-flex")} compact size="icon" variant="ghost" />
            <ThemeToggle className={headerIconButtonClass} size="icon" variant="ghost" />
            <Button aria-label={t("actions.refresh")} className={headerIconButtonClass} size="icon" type="button" variant="ghost" onClick={() => void load()}>
              <RefreshCcw />
            </Button>
          </div>
        </header>
        <TableListSection loading={loading} search={search} selectedTable={null} statusFilter={statusFilter} zoneOptions={zoneOptions} zones={zones} onSearchChange={setSearch} onSelectTable={selectTable} onStatusFilterChange={setStatusFilter} />
      </div>
    </div>
  );
}

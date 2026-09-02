"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, RefreshCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { NotificationMenu } from "@/components/layout/notification-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { useIsCapacitorNativeApp } from "@/hooks/use-capacitor-native-app";
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
  const isCapacitorNativeApp = useIsCapacitorNativeApp();
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
  }, [load, skipTableSelection, refetchEpoch]);

  // นาฬิกาในหัวข้อสีเขียวมีแค่ฝั่งเว็บ (ดูเหตุผลเรื่อง header ด้านล่าง) — ไม่ต้องนับ
  // ทุกวินาทีทิ้งเปล่า ๆ บน Capacitor ที่ไม่ได้เรนเดอร์มันอยู่แล้ว
  useEffect(() => {
    if (isCapacitorNativeApp) return;
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, [isCapacitorNativeApp]);

  // ปุ่มรีเฟรชย้ายเข้า NativeTopBar (capacitor/top-bar.tsx) แทนแถวโซนในตัวหน้า —
  // ลงทะเบียน action ผ่าน store กลางเพราะ top bar เรนเดอร์อยู่คนละต้นไม้กับหน้านี้
  // (ดู native-header-store.ts) ต้องเคลียร์ตอน unmount ไม่งั้นปุ่มจะค้างอยู่ในหน้าอื่น
  // ที่ไม่มีอะไรให้รีเฟรช ชี้ closure ของ load() เก่าของหน้านี้
  useEffect(() => {
    if (!isCapacitorNativeApp) return;
    setHeaderRefreshAction({ loading, onClick: () => void load() });
    return () => setHeaderRefreshAction(null);
  }, [isCapacitorNativeApp, loading, load, setHeaderRefreshAction]);

  function selectTable(table: PosTable) {
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

  // ฝั่งเว็บ (web/app-shell.tsx) ซ่อน AppHeader ทั้งก้อนบนหน้า immersive แบบนี้ (ดู
  // !immersiveScreen ใน app-shell.tsx) หน้านี้จึงไม่มี header ของ shell ให้เลย ต้องมี
  // header สีเขียว + พื้นหลังลายของตัวเองไว้ — ต่างจาก Capacitor ที่ NativeTopBar โชว์
  // อยู่แล้วทุกหน้ารวมหน้านี้ด้วย (ตามที่ตกลงกันไว้) ใส่ซ้ำจะกลายเป็น header 2 ชั้น
  if (isCapacitorNativeApp) {
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
        <header className="relative flex h-18 shrink-0 items-center justify-between overflow-hidden px-3 text-primary-foreground shadow-sm sm:h-20 sm:px-4">
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

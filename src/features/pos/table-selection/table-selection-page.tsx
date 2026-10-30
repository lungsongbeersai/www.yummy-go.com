"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, RefreshCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { NotificationMenu } from "@/components/layout/notification-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { BranchContractStatus } from "@/components/layout/branch-contract-status";
import { Button } from "@/components/ui/button";
import { useIsNativeShellActive } from "@/hooks/use-native-shell-active";
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
import { SimulatorLauncher } from "@/features/simulator/simulator-launcher";

const headerIconButtonClass = "relative size-[40px] rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-0 text-primary-foreground shadow-sm backdrop-blur-sm hover:bg-primary-foreground/20 hover:text-primary-foreground dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 dark:hover:text-white";

export function TableSelectionPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const language = useAppStore((state) => state.language);
  const zones = usePosStore((state) => state.zones);
  const zoneOptions = usePosStore((state) => state.zoneOptions);
  const loading = usePosStore((state) => state.loading);
  const loadTables = usePosStore((state) => state.loadTables);
  const refreshTables = usePosStore((state) => state.refreshTables);
  const updateTableStatus = usePosStore((state) => state.updateTableStatus);
  const showToast = useToastStore((state) => state.show);
  const nativeShellActive = useIsNativeShellActive();
  const setHeaderRefreshAction = useNativeHeaderStore((state) => state.setRefreshAction);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TableStatusFilter>("all");

  const branchUuid = user?.branch_uuid ?? "";
  const skipTableSelection = user?.store_table_status === 2;
  const initialZoneUuid = searchParams.get("zone_uuid")?.trim() ?? "";

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
    refreshTables,
    updateTableStatus,
  });

  // ร้านไม่มีโต๊ะ (store_table_status === 2) ข้ามหน้าเลือกโต๊ะไปเลย —
  // ไม่ยิง loadTables และไม่ render grid ระหว่างรอ redirect
  useEffect(() => {
    if (skipTableSelection) router.replace("/posAll/order");
  }, [router, skipTableSelection]);

  useEffect(() => {
    if (skipTableSelection) return;
    void load();
  }, [load, skipTableSelection]);

  // Table cards navigate programmatically, so Next cannot auto-prefetch them like a
  // visible <Link>. Warm the shared order route alongside the table request;
  // waiting for the grid response creates another network step before a quick tap.
  // Search params are read client-side, so one prefetch covers every table.
  useEffect(() => {
    if (branchUuid && !skipTableSelection) {
      router.prefetch("/posAll/order");
    }
  }, [branchUuid, router, skipTableSelection]);

  // ปุ่มรีเฟรชย้ายเข้า NativeTopBar (capacitor/top-bar.tsx) แทนแถวโซนในตัวหน้า —
  // ลงทะเบียน action ผ่าน store กลางเพราะ top bar เรนเดอร์อยู่คนละต้นไม้กับหน้านี้
  // (ดู native-header-store.ts) ต้องเคลียร์ตอน unmount ไม่งั้นปุ่มจะค้างอยู่ในหน้าอื่น
  // ที่ไม่มีอะไรให้รีเฟรช ชี้ closure ของ load() เก่าของหน้านี้
  useEffect(() => {
    if (!nativeShellActive) return;
    setHeaderRefreshAction({ loading, onClick: () => void load() });
    return () => setHeaderRefreshAction(null);
  }, [nativeShellActive, loading, load, setHeaderRefreshAction]);

  const selectTable = useCallback((table: PosTable, zoneUuid: string) => {
    const params = new URLSearchParams({ table_uuid: table.table_uuid });
    if (table.table_name) params.set("table_name", table.table_name);
    if (zoneUuid) params.set("zone_uuid", zoneUuid);
    const target = `/posAll/order?${params.toString()}` as const;
    router.push(target);
  }, [router]);

  if (skipTableSelection) return null;

  // Desktop and Swan 1 render this page's own patterned header; other native
  // devices retain NativeTopBar and must not receive a duplicate header.
  if (nativeShellActive) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <TableListSection
          initialZoneUuid={initialZoneUuid}
          loading={loading}
          search={search}
          selectedTable={null}
          statusFilter={statusFilter}
          zoneOptions={zoneOptions}
          zones={zones}
          onSearchChange={setSearch}
          onRefresh={load}
          onSelectTable={selectTable}
          onStatusFilterChange={setStatusFilter}
        />
      </div>
    );
  }

  return (
    <div data-pos-pattern="true" className="relative h-full min-h-0 overflow-hidden bg-[url('/posAll/background_wide.webp')] bg-cover bg-top dark:bg-none dark:bg-background">
      <div aria-hidden="true" data-pos-pattern-overlay="true" className="pointer-events-none absolute inset-0 bg-primary/45 dark:hidden" />
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
        {/* Keep these three children for Swan's grid fallback. Tool groups wrap
            within the right track so the centered clock never overlaps them. */}
        <header data-pos-table-header="true" className="relative grid min-h-18 shrink-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-2 overflow-hidden px-2 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] text-primary-foreground shadow-sm sm:px-4 md:min-h-20 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <Button aria-label={t("actions.back")} className={cn(headerIconButtonClass, "col-start-1 row-start-1 justify-self-start")} size="icon" type="button" variant="ghost" onClick={() => router.replace("/")}>
            <ChevronLeft />
          </Button>
          <TableClock />
          <div data-pos-table-header-actions="true" className="relative col-span-2 col-start-1 row-start-2 flex min-w-0 max-w-full flex-wrap items-center justify-end gap-1 justify-self-end sm:gap-1.5 md:col-span-1 md:col-start-3 md:row-start-1">
            <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
              <BranchContractStatus responsiveCompact />
              <SimulatorLauncher />
            </div>
            <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
              <NotificationMenu triggerClassName={headerIconButtonClass} triggerVariant="ghost" />
              <LanguageSwitch className={cn(headerIconButtonClass, "hidden min-[500px]:inline-flex")} compact size="icon" variant="ghost" />
              <ThemeToggle className={headerIconButtonClass} size="icon" variant="ghost" />
              <Button aria-label={t("actions.refresh")} className={headerIconButtonClass} size="icon" type="button" variant="ghost" onClick={() => void load()}>
                <RefreshCcw />
              </Button>
            </div>
          </div>
        </header>
        <TableListSection initialZoneUuid={initialZoneUuid} loading={loading} search={search} selectedTable={null} statusFilter={statusFilter} zoneOptions={zoneOptions} zones={zones} onSearchChange={setSearch} onRefresh={load} onSelectTable={selectTable} onStatusFilterChange={setStatusFilter} />
      </div>
    </div>
  );
}

function TableClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <p data-pos-table-clock="true" className="col-span-2 col-start-1 row-start-1 max-w-55 justify-self-center whitespace-nowrap text-xl font-black leading-none tracking-wide tabular-nums text-primary-foreground dark:text-white md:col-span-1 md:col-start-2 2xl:text-3xl">
      {formatClock(now)}
    </p>
  );
}

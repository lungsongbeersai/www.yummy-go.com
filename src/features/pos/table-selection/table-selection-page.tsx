"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, RefreshCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { NotificationMenu } from "@/components/layout/notification-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PosTable, PosZone } from "@/services/pos";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
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
  const loading = usePosStore((state) => state.loading);
  const loadTables = usePosStore((state) => state.loadTables);
  const refreshTables = usePosStore((state) => state.refreshTables);
  const updateTableCustomerOrderState = usePosStore((state) => state.updateTableCustomerOrderState);
  const showToast = useToastStore((state) => state.show);
  const [search, setSearch] = useState("");
  const [selectedZoneUuid, setSelectedZoneUuid] = useState("");
  const [zoneOptions, setZoneOptions] = useState<PosZone[]>([]);
  const [statusFilter, setStatusFilter] = useState<TableStatusFilter>("all");
  const [now, setNow] = useState(() => new Date());

  const branchUuid = user?.branch_uuid ?? "";

  const load = useCallback(async (zoneUuid = selectedZoneUuid) => {
    if (!branchUuid) return [];
    try {
      const nextZones = await loadTables({ branch_uuid_fk: branchUuid, zone_uuid: zoneUuid, lang: language });
      if (!zoneUuid) setZoneOptions(nextZones);
      return nextZones;
    } catch (error) {
      showToast({ title: t("pos.failedTables"), description: error instanceof Error ? error.message : "", tone: "error" });
      return [];
    }
  }, [branchUuid, language, loadTables, selectedZoneUuid, showToast, t]);

  const showOrderError = useCallback((error: unknown) => {
    showToast({ title: t("pos.orderFailed"), description: error instanceof Error ? error.message : "", tone: "error" });
  }, [showToast, t]);

  // No table stays selected on this screen anymore (tapping a table
  // navigates to the order page), so the alert hook only refreshes the
  // table grid and plays the new-order sound.
  useTableAlerts({
    branchUuid: user?.branch_uuid,
    language,
    onCartRefreshError: showOrderError,
    refreshSelectedCart: async () => null,
    refreshTables,
    selectedTableUuid: "",
    selectedZoneUuid,
    setSelectedTable: () => undefined,
    setZoneOptions,
    updateTableCustomerOrderState
  });

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const interval = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(interval); }, []);

  function selectTable(table: PosTable) {
    const params = new URLSearchParams({ table_uuid: table.table_uuid });
    if (table.table_name) params.set("table_name", table.table_name);
    router.push(`/sale/order-customer?${params.toString()}`);
  }

  return (
    <div data-pos-pattern="true" className="relative h-full min-h-0 overflow-hidden bg-[url('/pos/background_wide.webp')] bg-cover bg-top">
      <div aria-hidden="true" data-pos-pattern-overlay="true" className="pointer-events-none absolute inset-0 bg-primary/45 dark:bg-black/55" />
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
        <header className="relative flex h-18 shrink-0 items-center justify-between overflow-hidden px-3 text-primary-foreground shadow-sm sm:h-20 sm:px-4">
          <Button aria-label={t("actions.back")} className="relative size-11 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-0 text-primary-foreground shadow-sm backdrop-blur-sm hover:bg-primary-foreground/20 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 dark:hover:text-white" type="button" variant="ghost" onClick={() => router.replace("/")}>
            <ChevronLeft />
          </Button>
          <p className="absolute left-1/2 top-1/2 max-w-55 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[20px] font-black leading-none tracking-wide text-primary-foreground dark:text-white sm:text-[28px]">{formatClock(now)}</p>
          <div className="relative flex min-w-0 items-center gap-1.5">
            <NotificationMenu triggerClassName={cn(headerIconButtonClass, "hidden min-[430px]:inline-flex")} triggerVariant="ghost" />
            <LanguageSwitch className={cn(headerIconButtonClass, "hidden min-[500px]:inline-flex")} contentAlign="end" showShort={false} size="icon" variant="ghost" />
            <ThemeToggle className={headerIconButtonClass} size="icon" variant="ghost" />
            <Button aria-label={t("actions.refresh")} className={headerIconButtonClass} type="button" variant="ghost" onClick={() => void load()}>
              <RefreshCcw />
            </Button>
          </div>
        </header>
        <TableListSection loading={loading} search={search} selectedTable={null} selectedZoneUuid={selectedZoneUuid} statusFilter={statusFilter} zoneOptions={zoneOptions} zones={zones} onSearchChange={setSearch} onSelectTable={selectTable} onStatusFilterChange={setStatusFilter} onZoneChange={setSelectedZoneUuid} />
      </div>
    </div>
  );
}

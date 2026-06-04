"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, RefreshCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { NotificationMenu } from "@/components/layout/notification-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { PosTable, PosZone } from "@/services/pos";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { usePosStore } from "@/stores/pos-store";
import { useToastStore } from "@/stores/toast-store";
import { TableListSection } from "./table-list-section";
import { SelectedTableCartPanel, TableNextStepPanel } from "./selected-table-cart-panel";
import type { TableStatusFilter } from "./types";
import { formatClock } from "./utils";
import { useHasTableSidePanel } from "./hooks/use-has-table-side-panel";
import { useSelectedTableCart } from "./hooks/use-selected-table-cart";
import { useTableAlerts } from "./hooks/use-table-alerts";

const headerIconButtonClass = "relative size-[40px] rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-0 text-primary-foreground shadow-sm backdrop-blur-sm hover:bg-primary-foreground/20 hover:text-primary-foreground dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 dark:hover:text-white";

export function TableSelectionPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const hasSidePanel = useHasTableSidePanel();
  const user = useAuthStore((state) => state.user);
  const language = useAppStore((state) => state.language);
  const zones = usePosStore((state) => state.zones);
  const cart = usePosStore((state) => state.cart);
  const loading = usePosStore((state) => state.loading);
  const loadTables = usePosStore((state) => state.loadTables);
  const refreshTables = usePosStore((state) => state.refreshTables);
  const loadCartStore = usePosStore((state) => state.loadCart);
  const setCart = usePosStore((state) => state.setCart);
  const updateTableCustomerOrderState = usePosStore((state) => state.updateTableCustomerOrderState);
  const showToast = useToastStore((state) => state.show);
  const [search, setSearch] = useState("");
  const [selectedZoneUuid, setSelectedZoneUuid] = useState("");
  const [zoneOptions, setZoneOptions] = useState<PosZone[]>([]);
  const [statusFilter, setStatusFilter] = useState<TableStatusFilter>("all");
  const [selectedTable, setSelectedTable] = useState<PosTable | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const selectedTableUuid = selectedTable?.table_uuid ?? "";

  const load = useCallback(async (zoneUuid = selectedZoneUuid) => {
    if (!user?.branch_uuid) return [];
    try {
      const nextZones = await loadTables({ branch_uuid_fk: user.branch_uuid, zone_uuid: zoneUuid, lang: language });
      if (!zoneUuid) setZoneOptions(nextZones);
      return nextZones;
    } catch (error) {
      showToast({ title: t("pos.failedTables"), description: error instanceof Error ? error.message : "", tone: "error" });
      return [];
    }
  }, [language, loadTables, selectedZoneUuid, showToast, t, user?.branch_uuid]);

  const showOrderError = useCallback((error: unknown) => {
    showToast({ title: t("pos.orderFailed"), description: error instanceof Error ? error.message : "", tone: "error" });
  }, [showToast, t]);

  const {
    cart: panelCart,
    clearCart,
    loading: panelLoadingCart,
    refreshCartForTable,
    refreshSelectedCart
  } = useSelectedTableCart({
    language,
    loadCart: loadCartStore,
    onError: showOrderError,
    selectedTableUuid,
    setStoreCart: setCart
  });

  useTableAlerts({
    branchUuid: user?.branch_uuid,
    language,
    onCartRefreshError: showOrderError,
    refreshSelectedCart,
    refreshTables,
    selectedTableUuid,
    selectedZoneUuid,
    setSelectedTable,
    setZoneOptions,
    updateTableCustomerOrderState
  });

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const interval = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(interval); }, []);

  function selectTable(table: PosTable) {
    setSelectedTable(table);
    if (!hasSidePanel) setMobileSheetOpen(true);
  }

  const refreshTablesAndSelectedCart = useCallback(async (nextTableUuid?: string) => {
    const shouldResetZone = Boolean(nextTableUuid && selectedZoneUuid);
    const nextZones = await load(shouldResetZone ? "" : selectedZoneUuid);
    if (shouldResetZone) setSelectedZoneUuid("");
    const nextSelectedTableUuid = nextTableUuid ?? selectedTable?.table_uuid ?? "";
    const nextSelectedTable = nextSelectedTableUuid ? nextZones.flatMap((zone) => zone.tables ?? []).find((table) => table.table_uuid === nextSelectedTableUuid) ?? selectedTable : null;
    if (nextSelectedTable) setSelectedTable(nextSelectedTable);
    if (!nextSelectedTableUuid) {
      clearCart();
      return;
    }
    await refreshCartForTable(nextSelectedTableUuid);
  }, [clearCart, load, refreshCartForTable, selectedTable, selectedZoneUuid]);

  const activeCart = panelCart ?? cart;

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-[url('/pos/background_wide.webp')] bg-cover bg-top">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-primary/45 dark:bg-black/55" />
      <div className="relative grid h-full min-h-0 overflow-hidden xl:grid-cols-[minmax(0,1fr)_clamp(340px,24vw,420px)]">
        <section className="flex min-h-0 min-w-0 flex-col xl:border-r xl:border-border/60">
          <header className="relative flex h-[72px] shrink-0 items-center justify-between overflow-hidden px-3 text-primary-foreground shadow-sm sm:h-[80px] sm:px-4">
            <Button aria-label={t("actions.back")} className="relative size-[44px] rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-0 text-primary-foreground shadow-sm backdrop-blur-sm hover:bg-primary-foreground/20 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 dark:hover:text-white" type="button" variant="ghost" onClick={() => router.replace("/")}>
              <ChevronLeft />
            </Button>
            <p className="absolute left-1/2 top-1/2 max-w-[220px] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[20px] font-black leading-none tracking-wide text-primary-foreground dark:text-white sm:text-[28px]">{formatClock(now)}</p>
            <div className="relative flex min-w-0 items-center gap-1.5">
              <NotificationMenu triggerClassName={cn(headerIconButtonClass, "hidden min-[430px]:inline-flex")} triggerVariant="ghost" />
              <LanguageSwitch className={cn(headerIconButtonClass, "hidden min-[500px]:inline-flex")} contentAlign="end" showShort={false} size="icon" variant="ghost" />
              <ThemeToggle className={headerIconButtonClass} size="icon" variant="ghost" />
              <Button aria-label={t("actions.refresh")} className={headerIconButtonClass} type="button" variant="ghost" onClick={() => void load()}>
                <RefreshCcw />
              </Button>
            </div>
          </header>
          <TableListSection loading={loading} search={search} selectedTable={selectedTable} selectedZoneUuid={selectedZoneUuid} statusFilter={statusFilter} zoneOptions={zoneOptions} zones={zones} onSearchChange={setSearch} onSelectTable={selectTable} onStatusFilterChange={setStatusFilter} onZoneChange={setSelectedZoneUuid} />
        </section>
        <section className="hidden min-h-0 overflow-hidden xl:block">
          <TableNextStepPanel allZones={zones} cart={activeCart} loading={panelLoadingCart} selectedTable={selectedTable} onCartRefresh={() => refreshSelectedCart({ showLoading: false }).then(() => undefined)} onTableActionComplete={refreshTablesAndSelectedCart} />
        </section>
      </div>
      <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
        <SheetContent side="bottom" className="h-[calc(100dvh-8px)] max-h-none gap-0 overflow-hidden rounded-t-2xl border-primary/20 bg-[url('/pos/background_wide.webp')] bg-cover bg-top p-0 text-primary-foreground dark:border-primary/30">
          <SheetTitle className="sr-only">{selectedTable ? t("nav.table") + " " + selectedTable.table_name : t("pos.tables")}</SheetTitle>
          {selectedTable ? (
            <SelectedTableCartPanel allZones={zones} cart={activeCart} loading={panelLoadingCart} table={selectedTable} variant="sheet" onCartRefresh={() => refreshSelectedCart({ showLoading: false }).then(() => undefined)} onTableActionComplete={refreshTablesAndSelectedCart} />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

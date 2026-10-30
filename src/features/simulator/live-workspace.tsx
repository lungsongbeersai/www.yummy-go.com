"use client";

import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, CheckCheck, ChefHat, ChevronRight, ClipboardList, Clock3, Eye, Info, LayoutGrid, LogOut, ReceiptText, RefreshCw, Search, Users, UtensilsCrossed, Wifi, WifiOff } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { internalRoute } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useSimulatorLiveStore } from "@/stores/simulator-live-store";
import { SimSelect } from "./fields";
import { formatSimMoney, tableStatusLabel, tableStatusTone } from "./helpers";
import { simulatorI18n } from "./i18n";
import { createLiveCharacters, limitLiveSceneTables, liveItemStatusLabel, liveTableSceneStatus, liveTableStatusClass } from "./live-helpers";
import "./live-i18n";

const RestaurantScene = dynamic(() => import("./restaurant-scene"), { ssr: false,
  loading: () => <div className="absolute inset-0 grid place-content-center gap-4 p-8"><Skeleton className="h-48 w-64 rounded-3xl" /><Skeleton className="mx-auto h-4 w-40" /></div>,
});

class LiveSceneBoundary extends Component<{ children: ReactNode; message: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div role="alert" className="grid h-full place-content-center p-8 text-center text-sm text-muted-foreground">{this.props.message}</div> : this.props.children; }
}

function TablePlanIcon({ className, seats = 4 }: { className?: string; seats?: number }) {
  return <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" className={className}>
    <rect x="10" y="10" width="20" height="20" rx="5" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="1.5" />
    <path d="M16 6h8M16 34h8" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    {seats > 2 && <path d="M6 16v8M34 16v8" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />}
    {seats > 4 && <path d="M6 7v3M34 30v3" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />}
  </svg>;
}

export function LiveWorkspace({ modeControls }: { modeControls?: ReactNode }) {
  const { t, i18n } = useTranslation("simulatorLive");
  const { t: sim } = useTranslation("simulator");
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const appLanguage = useAppStore((state) => state.language);
  const state = useSimulatorLiveStore();
  const { bootstrap, snapshot, loading, refreshing, connected } = state;
  const [branch, setBranch] = useState(() => searchParams.get("branch_uuid")?.trim() || user?.branch_uuid || "");
  const [zone, setZone] = useState("all");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(false);
  const locale = i18n.language;
  const tables = snapshot?.tables ?? [];
  const orders = snapshot?.orders ?? [];
  const sceneTables = limitLiveSceneTables(tables, state.selectedTableId);
  const selectedTable = tables.find((table) => table.table_uuid === state.selectedTableId);
  const selectedOrder = orders.find((order) => order.order_uuid === state.selectedOrderId);
  const tableOrders = orders.filter((order) => order.table_uuid === state.selectedTableId && state.selectedTableId);
  const zones = useMemo(() => [...new Map((snapshot?.tables ?? []).map((table) => [table.zone_uuid, table.zone_name])).entries()], [snapshot?.tables]);
  const characters = useMemo(() => snapshot ? createLiveCharacters(snapshot, limitLiveSceneTables(snapshot.tables, state.selectedTableId)) : [], [snapshot, state.selectedTableId]);
  const kitchen = orders.flatMap((order) => order.items.filter((item) => [2, 3].includes(item.status)).map((item) => ({ order, item })));
  const availableCount = tables.filter((table) => table.status === 1).length;
  const visibleTables = tables.filter((table) => (zone === "all" || table.zone_uuid === zone)
    && (filter === "all" || (filter === "available" ? table.status === 1 : table.status !== 1))
    && table.name.toLocaleLowerCase(locale).includes(search.trim().toLocaleLowerCase(locale)));

  // react-i18next 17 returns a new i18n wrapper after each language change.
  // Sync the app preference through the stable instance so a local choice stays.
  useEffect(() => { void simulatorI18n.changeLanguage(appLanguage); }, [appLanguage]);
  useEffect(() => {
    useSimulatorLiveStore.getState().reset();
    return () => useSimulatorLiveStore.getState().reset();
  }, [branch]);
  useEffect(() => {
    const current = useSimulatorLiveStore.getState;
    const foreground = () => document.visibilityState === "visible" && document.hasFocus();
    const read = () => {
      if (!foreground() || navigator.onLine === false || !branch) return;
      if (current().bootstrap) void current().refresh(locale); else void current().initialize(branch, locale);
    };
    const visibility = () => {
      const visible = foreground();
      setActive(visible);
      if (visible) read(); else current().suspend();
    };
    const offline = () => current().disconnect();
    const online = () => { if (foreground()) read(); };
    visibility();
    const timer = window.setInterval(read, 10_000);
    window.addEventListener("focus", visibility);
    window.addEventListener("blur", visibility);
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", visibility);
      window.removeEventListener("blur", visibility);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", visibility);
      // A locale change replaces the in-flight read while retaining the same
      // authorized restaurant and mounted scene. Branch/unmount cleanup clears it.
      current().suspend();
    };
  }, [branch, locale]);

  const refresh = () => {
    if (bootstrap) void state.refresh(locale); else void state.initialize(branch, locale);
  };
  const nameForOrder = (tableId: string | null) => tables.find((table) => table.table_uuid === tableId)?.name ?? t("counter");
  const updated = snapshot ? new Date(snapshot.fetched_at).toLocaleTimeString(locale) : "—";

  return <main className="simulator-workspace flex min-h-dvh min-w-0 flex-col bg-muted/35 font-lao text-foreground lg:h-dvh lg:overflow-hidden" lang={locale}>
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-3 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><UtensilsCrossed className="size-5" strokeWidth={1.8} /></div>
        <div><p className="text-[10px] font-semibold tracking-[0.16em] text-primary-text">YUMMY GO <span className="font-normal tracking-normal text-muted-foreground">/ RESTAURANT</span></p><h1 className="mt-0.5 text-base font-semibold tracking-tight">{t("title")}</h1></div>
      </div>
      {modeControls}
      <div className="flex items-center gap-2">
        <SimSelect label={t("language")} className="h-10 w-24 border-transparent bg-muted/50" value={locale} onChange={(language) => void i18n.changeLanguage(language)} options={[{ value: "la", label: "ລາວ" }, { value: "th", label: "ไทย" }, { value: "en", label: "English" }]} />
        <ThemeToggle size="icon" variant="ghost" className="size-10" />
        <div className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <Button aria-label={t("close")} title={t("close")} className="size-10 text-muted-foreground" variant="ghost" size="icon" onClick={() => { if (window.opener || window.history.length <= 1) window.close(); else window.location.assign(internalRoute("/posAll/tables")); }}><LogOut className="size-4" /></Button>
      </div>
    </header>
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b bg-card px-4 py-2 sm:px-6">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="max-w-48 truncate text-xs font-medium text-muted-foreground">{snapshot?.branch.store_name ?? bootstrap?.branch.store_name ?? user?.store_name}</span>
        <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
        {bootstrap ? <SimSelect label={t("branch")} value={bootstrap.branch.branch_uuid} className="h-10 w-44 border-transparent bg-transparent font-medium shadow-none" onChange={(value) => { state.reset(); window.history.replaceState(null, "", internalRoute(`/simulator?${new URLSearchParams({ branch_uuid: value, mode: "live" })}`)); setZone("all"); setFilter("all"); setSearch(""); setBranch(value); }} options={bootstrap.branches.map((entry) => ({ value: entry.branch_uuid, label: entry.branch_name }))} /> : <span className="text-xs text-muted-foreground">{user?.branch_name}</span>}
        <Badge variant="outline" className={cn("gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium", connected ? "border-success/15 bg-success/5 text-success-text" : "border-destructive/20 text-destructive")}>
          {connected ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}{t(connected ? "online" : "disconnected")}
        </Badge>
        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="size-10 text-muted-foreground" aria-label={t("help")}><Info className="size-3.5" /></Button></TooltipTrigger><TooltipContent className="max-w-72 text-xs leading-relaxed">{t("help")}</TooltipContent></Tooltip>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-muted-foreground" data-testid="live-last-updated">{t("lastUpdated")}: <span className="tabular-nums">{updated}</span></span>
        <Button className="h-10 gap-2 border-border/70 bg-card px-3 text-xs shadow-none" variant="outline" disabled={loading || refreshing} onClick={refresh}><RefreshCw className={cn("size-3.5", refreshing && "motion-safe:animate-spin")} />{t("refresh")}</Button>
      </div>
    </div>
    {!connected && !loading && <Alert variant="destructive" className="m-3 w-auto shrink-0"><WifiOff /><AlertTitle>{snapshot ? t("stale") : t("disconnected")}</AlertTitle><AlertDescription>{state.error && <p>{state.error}</p>}<Button className="mt-2 h-10" variant="outline" disabled={loading || refreshing} onClick={refresh}>{t("reconnect")}</Button></AlertDescription></Alert>}
    {snapshot?.truncated && <Alert className="m-3 w-auto shrink-0"><AlertTitle>{t("truncated")}</AlertTitle></Alert>}
    {loading && !snapshot ? <div aria-label={t("loading")} className="grid flex-1 gap-4 p-4 lg:grid-cols-[14rem_minmax(0,1fr)_20rem]"><Skeleton className="h-48 lg:h-full" /><Skeleton className="h-96 lg:h-full" /><Skeleton className="h-48 lg:h-full" /></div> : !snapshot ? <Empty className="m-5 w-auto flex-1 border bg-card"><EmptyHeader><EmptyMedia><LayoutGrid className="size-8" /></EmptyMedia><EmptyTitle>{t("noData")}</EmptyTitle><EmptyDescription>{active ? t("waiting") : t("inactive")}</EmptyDescription></EmptyHeader></Empty> : <>
      <div className="grid shrink-0 grid-cols-2 border-b bg-card sm:grid-cols-4">{[
        { title: t("activeBills"), value: snapshot.summary.open_bills, icon: ReceiptText, tone: "bg-primary/8 text-primary-text" },
        { title: t("pending"), value: snapshot.summary.pending_items, icon: Clock3, tone: "bg-warning/8 text-warning-text" },
        { title: t("preparing"), value: snapshot.summary.preparing_items, icon: ChefHat, tone: "bg-info/8 text-info-text" },
        { title: t("served"), value: snapshot.summary.served_items, icon: CheckCheck, tone: "bg-success/8 text-success-text" },
      ].map((entry) => <div key={entry.title} className="flex min-w-0 items-center gap-3 border-l border-border/70 px-4 py-3 first:border-l-0 sm:px-6 sm:py-4">
        <div className={cn("grid size-10 shrink-0 place-items-center rounded-xl", entry.tone)}><entry.icon className="size-4.5" strokeWidth={1.7} /></div>
        <div className="min-w-0"><p className="truncate text-[11px] font-medium text-muted-foreground">{entry.title}</p><p className="mt-0.5 text-2xl leading-none font-semibold tracking-tight tabular-nums">{entry.value}</p></div>
      </div>)}</div>
      <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[13.5rem_minmax(0,1fr)_19rem] xl:grid-cols-[14.5rem_minmax(0,1fr)_21rem] 2xl:gap-4 2xl:p-4">
        <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-card">
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-semibold"><LayoutGrid className="size-4 text-primary-text" />{t("tables")}</h2><span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">{tables.length}</span></div>
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input type="search" aria-label={t("searchTables")} placeholder={t("searchTables")} value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 rounded-lg border-border/80 bg-background pl-9 text-xs shadow-none" /></div>
            <SimSelect label={t("allZones")} value={zone} onChange={setZone} className="h-10 w-full rounded-lg bg-muted/35 text-xs shadow-none" options={[{ value: "all", label: t("allZones") }, ...zones.map(([value, label]) => ({ value, label }))]} />
            <div className="flex gap-1 rounded-lg bg-muted/65 p-1">{["all", "available", "occupied"].map((value) => <Button key={value} variant="ghost" aria-pressed={filter === value} className={cn("h-10 min-w-0 flex-1 rounded-md px-1 text-[11px] font-medium", filter === value ? "bg-card text-primary-text shadow-sm hover:bg-card" : "text-muted-foreground")} onClick={() => setFilter(value)}>{t(value)}</Button>)}</div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 lg:overflow-y-auto">
            <div className="grid max-h-72 grid-cols-3 gap-2 sm:grid-cols-5 lg:max-h-none lg:grid-cols-2">{visibleTables.map((table) => <Button key={table.table_uuid} variant="outline" aria-pressed={table.table_uuid === state.selectedTableId} className={cn("h-auto min-h-24 min-w-0 flex-col items-stretch justify-between gap-2 rounded-lg border-border/80 bg-card px-3 py-3 text-left shadow-none hover:border-primary/45 hover:bg-primary/5", table.table_uuid === state.selectedTableId && "border-primary bg-primary/5 ring-1 ring-primary")} onClick={() => state.selectTable(table.table_uuid)}>
              <span className="flex w-full min-w-0 items-center justify-between gap-1"><span className="truncate text-sm font-semibold tracking-tight">{table.name}</span><TablePlanIcon className={cn("size-7 shrink-0", table.table_uuid === state.selectedTableId ? "text-primary-text" : "text-muted-foreground/60")} seats={table.seats} /></span>
              <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-medium"><span className={cn("size-1.5 shrink-0 rounded-full", tableStatusTone(table.status))} /><span className="truncate">{sim(tableStatusLabel(table.status))}</span></span>
              <span className="flex items-center gap-1 text-[10px] font-normal text-muted-foreground"><Users className="size-3" />{table.seats} {t("seats")}</span>
              {table.customer_order_state && <Badge className="max-w-full truncate rounded-md bg-destructive text-[9px] text-destructive-foreground">{t("customerOrder")}</Badge>}
            </Button>)}</div>
            {visibleTables.length === 0 && <Empty className="px-2 py-6"><EmptyHeader><EmptyMedia><Search className="size-5 text-muted-foreground" /></EmptyMedia><EmptyTitle className="text-xs">{t("noMatchingTables")}</EmptyTitle></EmptyHeader></Empty>}
            {orders.length > 0 && <div className="mt-4 flex flex-col gap-1 border-t pt-3"><h3 className="mb-1 flex items-center justify-between px-1 text-[11px] font-semibold text-muted-foreground">{t("activeBills")}<span className="tabular-nums">{orders.length}</span></h3>{orders.map((order) => <Button key={order.order_uuid} variant="ghost" className={cn("h-11 w-full justify-between gap-2 rounded-lg px-2 text-xs", state.selectedOrderId === order.order_uuid && "bg-primary/5 text-primary-text")} onClick={() => state.selectOrder(order.order_uuid)}><span className="flex min-w-0 items-center gap-2"><ReceiptText className="size-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{nameForOrder(order.table_uuid)}</span></span><span className="shrink-0 text-[10px] text-muted-foreground">#{order.order_uuid.slice(0, 5)}</span><ChevronRight className="size-3 shrink-0" /></Button>)}</div>}
          </div>
          <div className="shrink-0 border-t px-4 py-2.5 text-[10px] text-muted-foreground">{t("shownTables", { shown: visibleTables.length, total: tables.length })}</div>
        </aside>
        <section aria-label={sim("view3d")} className="flex min-h-128 min-w-0 flex-col overflow-hidden rounded-xl border bg-card lg:min-h-0">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5"><div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/8 text-primary-text"><LayoutGrid className="size-4" /></div><div className="min-w-0"><h2 className="text-sm font-semibold">{t("floorPlan")}</h2><p className="mt-0.5 truncate text-[10px] text-muted-foreground">{snapshot.branch.branch_name}</p></div></div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground"><span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-success" />{t("available")} <span className="font-semibold tabular-nums text-foreground">{availableCount}</span></span><span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-info" />{t("occupied")} <span className="font-semibold tabular-nums text-foreground">{tables.length - availableCount}</span></span><Badge variant="outline" className="rounded-md border-primary/20 bg-primary/5 text-[9px] font-semibold text-primary-text">3D</Badge></div>
          </div>
          <div className="relative min-h-112 flex-1 overflow-hidden bg-muted/35 lg:min-h-0">
            <LiveSceneBoundary message={t("webglError")}><RestaurantScene tables={sceneTables.map((table) => ({ id: table.table_uuid, name: table.name, zone: table.zone_name, status: liveTableSceneStatus(table.status), guests: table.guests, seats: table.seats }))} selectedTableId={state.selectedTableId} onSelectTable={state.selectTable} paused characters={characters.filter((character) => sceneTables.some((table) => table.table_uuid === character.tableId))} /></LiveSceneBoundary>
            {tables.length > sceneTables.length && <p className="pointer-events-none absolute left-4 top-4 max-w-[calc(100%-2rem)] rounded-lg border bg-card/95 px-3 py-2 text-[10px] text-muted-foreground">{t("sceneLimit", { shown: sceneTables.length, total: tables.length })}</p>}
          </div>
          <div className="flex shrink-0 items-start gap-2 border-t bg-card px-4 py-2.5"><Info className="mt-0.5 size-3 shrink-0 text-muted-foreground" /><p className="text-[10px] leading-relaxed text-muted-foreground">{t("illustrative")}</p></div>
        </section>
        <aside aria-label={t("statuses")} className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-card">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-4"><h2 className="text-sm font-semibold">{t("tableDetails")}</h2><Badge variant="outline" className="gap-1 rounded-md border-border/70 text-[9px] font-normal text-muted-foreground"><Eye className="size-3" />{t("readOnly")}</Badge></div>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            {(selectedTable || selectedOrder) && <div className="flex items-center gap-3 rounded-xl border border-primary/15 bg-primary/4 p-3"><div className="grid size-12 shrink-0 place-items-center rounded-lg border border-primary/15 bg-card text-primary-text"><TablePlanIcon className="size-9" seats={selectedTable?.seats} /></div><div className="min-w-0 flex-1"><h3 className="truncate text-lg font-semibold tracking-tight">{selectedTable?.name ?? nameForOrder(selectedOrder?.table_uuid ?? null)}</h3><p className="mt-0.5 truncate text-[10px] text-muted-foreground">{selectedTable ? `${selectedTable.zone_name} · ${selectedTable.seats} ${t("seats")}` : t("counter")}</p></div>{selectedTable && <Badge variant="outline" className={cn("max-w-24 truncate rounded-md px-2 py-1 text-[9px]", liveTableStatusClass(selectedTable.status))}>{sim(tableStatusLabel(selectedTable.status))}</Badge>}</div>}
            {tableOrders.length > 1 && <SimSelect label={t("order")} value={state.selectedOrderId ?? ""} onChange={state.selectOrder} className="h-10 w-full text-xs" options={tableOrders.map((order) => ({ value: order.order_uuid, label: `${t("order")} ${order.order_uuid.slice(0, 6)}` }))} />}
            {!selectedOrder ? <Empty className="min-h-44 flex-none rounded-xl bg-muted/25 px-4 py-7"><EmptyHeader><EmptyMedia className="mb-3 grid size-12 place-items-center rounded-2xl border border-primary/15 bg-card text-primary-text"><ClipboardList className="size-5" strokeWidth={1.5} /></EmptyMedia><EmptyTitle className="text-xs font-medium leading-relaxed">{selectedTable ? t("emptyOrder") : t("choose")}</EmptyTitle>{!selectedTable && <EmptyDescription className="mt-1 text-[10px]">{t("selectTableHelp")}</EmptyDescription>}</EmptyHeader></Empty> : <>
              <div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-xs font-semibold"><ReceiptText className="size-3.5 text-primary-text" />{t("orderItems")}</h3><span title={selectedOrder.order_uuid} className="max-w-28 truncate text-[10px] tabular-nums text-muted-foreground">#{selectedOrder.order_uuid.slice(0, 8)}</span></div>
              <div className="-mt-2 flex flex-col divide-y" data-testid="live-order-items">{selectedOrder.items.map((item) => <div key={item.item_uuid} className={cn("py-3", item.status === 9 && "opacity-60")}>
                <div className="flex items-start justify-between gap-3"><p className="min-w-0 break-words text-xs leading-relaxed font-medium">{item.name}</p><span className="shrink-0 rounded-md bg-muted px-2 py-1 text-[11px] font-semibold tabular-nums" aria-label={t("quantity")}>× {item.quantity}</span></div>
                <div className="mt-2 flex flex-wrap gap-1.5"><span className={cn("flex items-center gap-1.5 text-[10px]", item.status === 4 ? "text-success-text" : [2, 3].includes(item.status) ? "text-info-text" : "text-muted-foreground")}><span className={cn("size-1 rounded-full", item.status === 4 ? "bg-success" : [2, 3].includes(item.status) ? "bg-info" : "bg-muted-foreground")} />{t(liveItemStatusLabel(item.status), { status: item.status })}</span>{item.customer_order && <Badge variant="outline" className="rounded-md border-warning/30 text-[9px] text-warning-text">{t("customerOrder")}</Badge>}</div>
              </div>)}{selectedOrder.items.length === 0 && <p className="py-3 text-xs text-muted-foreground">{t("noItems")}</p>}</div>
              <div className="flex items-center justify-between gap-2 rounded-lg bg-primary/6 px-3 py-3"><span className="text-[11px] text-muted-foreground">{t("total")}</span><span className="text-base font-semibold tracking-tight tabular-nums text-primary-text">{formatSimMoney(selectedOrder.totals.total, locale)}</span></div>
            </>}
            <div className="border-t pt-4"><div className="mb-3 flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-xs font-semibold"><ChefHat className="size-4 text-primary-text" />{t("kitchen")}</h3><span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">{kitchen.length}</span></div>
              <div className="flex flex-col divide-y">{kitchen.slice(0, 30).map(({ order, item }) => <Button key={item.item_uuid} variant="ghost" className="h-auto min-h-14 justify-between gap-2 rounded-none px-0 py-3 text-left hover:bg-muted/40" onClick={() => state.selectOrder(order.order_uuid)}><span className="flex min-w-0 items-start gap-2"><span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-muted text-[10px] font-semibold tabular-nums">{item.quantity}</span><span className="min-w-0"><span className="block truncate text-[11px] font-medium">{item.name}</span><span className="mt-1 flex items-center gap-1 text-[10px] font-normal text-muted-foreground"><span className="size-1 rounded-full bg-info" />{nameForOrder(order.table_uuid)}</span></span></span><span className="flex shrink-0 items-center gap-1 text-[9px] font-normal text-info-text">{t(liveItemStatusLabel(item.status), { status: item.status })}<ArrowUpRight className="size-3" /></span></Button>)}</div>
              {kitchen.length === 0 && <p className="rounded-lg bg-muted/25 px-3 py-4 text-[11px] text-muted-foreground">{t("noKitchen")}</p>}
            </div>
          </div>
          <div className="flex shrink-0 items-start gap-2 border-t bg-muted/20 px-4 py-3"><Info className="mt-0.5 size-3 shrink-0 text-muted-foreground" /><p className="text-[10px] leading-relaxed text-muted-foreground">{t("readonlyHelp")}</p></div>
        </aside>
      </div>
    </>}
    <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-card px-4 py-2 text-[10px] text-muted-foreground sm:px-6"><span className="flex items-center gap-1.5"><span className={cn("size-1.5 rounded-full", connected ? "bg-success" : "bg-destructive")} />Yummy Go POS <span className="mx-1 text-border">/</span><Eye className="size-3" />{t("readOnly")}</span><span className="tabular-nums">{!active ? t("inactive") : refreshing ? t("loading") : `${t("lastUpdated")}: ${updated}`}</span></footer>
  </main>;
}

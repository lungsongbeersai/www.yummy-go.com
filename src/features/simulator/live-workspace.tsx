"use client";

import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Box, ChefHat, ChevronRight, ClipboardList, Eye, LayoutGrid, LogOut, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { internalRoute } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useSimulatorLiveStore } from "@/stores/simulator-live-store";
import { SimSelect } from "./fields";
import { formatSimMoney, tableStatusLabel } from "./helpers";
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

  return <main className="simulator-workspace flex min-h-dvh min-w-0 flex-col bg-background text-foreground lg:h-dvh lg:overflow-hidden" lang={locale}>
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-linear-to-r from-primary/10 via-card to-info/10 px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-3"><div className="grid size-11 shrink-0 place-items-center rounded-xl bg-info text-info-foreground"><Box className="size-6" /></div><div><p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">YUMMYGO / 3D</p><h1 className="text-base font-semibold sm:text-lg">{t("title")}</h1></div><Badge variant="outline" className="hidden gap-1.5 lg:flex"><Eye className="size-3" />{t("readOnly")}</Badge></div>
      {modeControls}
      <div className="flex flex-wrap items-center gap-2"><SimSelect label={t("language")} className="h-10 w-25" value={locale} onChange={(language) => void i18n.changeLanguage(language)} options={[{ value: "la", label: "ລາວ" }, { value: "th", label: "ไทย" }, { value: "en", label: "English" }]} /><ThemeToggle size="icon" variant="outline" className="size-10" /><Button aria-label={t("close")} className="size-10" variant="outline" size="icon" onClick={() => { if (window.opener || window.history.length <= 1) window.close(); else window.location.assign(internalRoute("/posAll/tables")); }}><LogOut /></Button></div>
    </header>
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-info/5 px-4 py-3 sm:px-5">
      <div className="flex min-w-0 flex-wrap items-center gap-2"><span className="text-sm font-medium">{snapshot?.branch.store_name ?? bootstrap?.branch.store_name ?? user?.store_name}</span><ChevronRight className="size-3 text-muted-foreground" />{bootstrap ? <SimSelect label={t("branch")} value={bootstrap.branch.branch_uuid} className="h-10 w-44" onChange={(value) => { state.reset(); window.history.replaceState(null, "", internalRoute(`/simulator?${new URLSearchParams({ branch_uuid: value, mode: "live" })}`)); setZone("all"); setFilter("all"); setBranch(value); }} options={bootstrap.branches.map((entry) => ({ value: entry.branch_uuid, label: entry.branch_name }))} /> : <span className="text-xs text-muted-foreground">{user?.branch_name}</span>}<Badge variant="outline" className="gap-1.5">{connected ? <Wifi className="size-3 text-success-text" /> : <WifiOff className="size-3 text-destructive" />}{t(connected ? "online" : "disconnected")}</Badge></div>
      <div className="flex items-center gap-3"><span className="text-[11px] text-muted-foreground" data-testid="live-last-updated">{t("lastUpdated")}: {updated}</span><Button className="h-10" variant="outline" disabled={loading || refreshing} onClick={refresh}><RefreshCw />{t("refresh")}</Button></div>
      <p className="basis-full text-xs leading-relaxed text-muted-foreground">{t("help")}</p>
    </div>
    {(!connected && !loading) && <Alert variant="destructive" className="m-3 w-auto shrink-0"><WifiOff /><AlertTitle>{snapshot ? t("stale") : t("disconnected")}</AlertTitle><AlertDescription>{state.error && <p>{state.error}</p>}<Button className="mt-2 h-10" variant="outline" disabled={loading || refreshing} onClick={refresh}>{t("reconnect")}</Button></AlertDescription></Alert>}
    {snapshot?.truncated && <Alert className="m-3 w-auto shrink-0"><AlertTitle>{t("truncated")}</AlertTitle></Alert>}
    {loading && !snapshot ? <div aria-label={t("loading")} className="grid flex-1 gap-4 p-5 lg:grid-cols-[13rem_minmax(0,1fr)_22rem]"><Skeleton className="h-48 lg:h-full" /><Skeleton className="h-96 lg:h-full" /><Skeleton className="h-48 lg:h-full" /></div> : !snapshot ? <Empty className="m-5 flex-1 border bg-card"><EmptyHeader><EmptyMedia><LayoutGrid className="size-8" /></EmptyMedia><EmptyTitle>{t("noData")}</EmptyTitle><EmptyDescription>{active ? t("waiting") : t("inactive")}</EmptyDescription></EmptyHeader></Empty> : <>
      <div className="grid shrink-0 grid-cols-2 gap-2 border-b bg-card p-3 sm:grid-cols-4 sm:gap-3 sm:px-5">{[
        { title: t("activeBills"), value: snapshot.summary.open_bills, className: "border-primary/20 bg-primary/5 text-primary-text" },
        { title: t("pending"), value: snapshot.summary.pending_items, className: "border-warning/20 bg-warning/5 text-warning-text" },
        { title: t("preparing"), value: snapshot.summary.preparing_items, className: "border-info/20 bg-info/5 text-info-text" },
        { title: t("served"), value: snapshot.summary.served_items, className: "border-success/20 bg-success/5 text-success-text" },
      ].map((entry) => <div key={entry.title} className={cn("flex min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-2", entry.className)}><span className="truncate text-xs font-medium">{entry.title}</span><span className="text-xl font-semibold tabular-nums">{entry.value}</span></div>)}</div>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[13rem_minmax(0,1fr)_22rem] xl:grid-cols-[14rem_minmax(0,1fr)_24rem]">
        <aside className="flex min-w-0 flex-col gap-4 border-b bg-card p-4 lg:overflow-y-auto lg:border-b-0 lg:border-r"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">{t("tables")}</h2><Badge variant="secondary">{tables.length}</Badge></div><SimSelect label={t("allZones")} value={zone} onChange={setZone} options={[{ value: "all", label: t("allZones") }, ...zones.map(([value, label]) => ({ value, label }))]} /><div className="flex gap-1">{["all", "available", "occupied"].map((value) => <Button key={value} variant={filter === value ? "secondary" : "ghost"} className="h-10 flex-1 px-1 text-xs" onClick={() => setFilter(value)}>{t(value)}</Button>)}</div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-2">{tables.filter((table) => (zone === "all" || table.zone_uuid === zone) && (filter === "all" || (filter === "available" ? table.status === 1 : table.status !== 1))).map((table) => <Button key={table.table_uuid} variant="outline" className={cn("h-auto min-h-20 min-w-0 flex-col items-start justify-center gap-1 rounded-xl px-3 py-2 text-left", liveTableStatusClass(table.status), table.table_uuid === state.selectedTableId && "ring-2 ring-primary")} onClick={() => state.selectTable(table.table_uuid)}><span className="w-full truncate text-sm font-semibold">{table.name}</span><span className="text-[10px]">{sim(tableStatusLabel(table.status))}</span><span className="text-[10px] text-muted-foreground">{table.seats} {t("seats")}</span>{table.customer_order_state && <Badge className="max-w-full truncate bg-destructive text-[9px] text-destructive-foreground">{t("customerOrder")}</Badge>}</Button>)}</div>
          <div className="flex flex-col gap-2 border-t pt-3"><h3 className="text-xs font-medium text-muted-foreground">{t("activeBills")}</h3>{orders.map((order) => <Button key={order.order_uuid} variant={state.selectedOrderId === order.order_uuid ? "secondary" : "outline"} className="h-11 w-full justify-between gap-2 px-2 text-xs" onClick={() => state.selectOrder(order.order_uuid)}><span className="truncate">{nameForOrder(order.table_uuid)} · {order.order_uuid.slice(0, 5)}</span><ChevronRight className="shrink-0" /></Button>)}</div>
        </aside>
        <section aria-label={sim("view3d")} className="relative min-h-96 overflow-hidden bg-muted/30 lg:min-h-0"><LiveSceneBoundary message={t("webglError")}><RestaurantScene tables={sceneTables.map((table) => ({ id: table.table_uuid, name: table.name, zone: table.zone_name, status: liveTableSceneStatus(table.status), guests: table.guests }))} selectedTableId={state.selectedTableId} onSelectTable={state.selectTable} paused characters={characters.filter((character) => sceneTables.some((table) => table.table_uuid === character.tableId))} /></LiveSceneBoundary>{tables.length > sceneTables.length && <p className="pointer-events-none absolute right-3 top-20 max-w-[calc(100%-1.5rem)] rounded-lg border bg-card/95 px-3 py-2 text-[10px] text-muted-foreground">{t("sceneLimit", { shown: sceneTables.length, total: tables.length })}</p>}<div className="pointer-events-none absolute left-3 top-3 max-w-[calc(100%-1.5rem)] rounded-xl border bg-card/95 px-3 py-2 shadow-sm"><p className="text-xs font-semibold">{snapshot.branch.branch_name}</p><p className="mt-1 text-[10px] text-muted-foreground">{t("readOnly")}</p></div><p className="pointer-events-none absolute bottom-10 left-3 right-3 rounded-lg border bg-card/95 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">{t("illustrative")}</p></section>
        <aside aria-label={t("statuses")} className="flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto border-t bg-card p-4 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">{selectedTable?.name ?? (selectedOrder ? nameForOrder(selectedOrder.table_uuid) : t("order"))}</h2><Badge variant="outline" className="gap-1 text-[10px]"><Eye className="size-3" />{t("readOnly")}</Badge></div>
          {tableOrders.length > 1 && <SimSelect label={t("order")} value={state.selectedOrderId ?? ""} onChange={state.selectOrder} options={tableOrders.map((order) => ({ value: order.order_uuid, label: `${t("order")} ${order.order_uuid.slice(0, 6)}` }))} />}
          {!selectedOrder ? <Empty className="border py-8"><EmptyHeader><EmptyMedia><ClipboardList className="size-7" /></EmptyMedia><EmptyTitle className="text-sm">{selectedTable ? t("emptyOrder") : t("choose")}</EmptyTitle></EmptyHeader></Empty> : <><p className="break-all text-[10px] text-muted-foreground">{selectedOrder.order_uuid}</p><div className="flex flex-col gap-2" data-testid="live-order-items">{selectedOrder.items.map((item) => <div key={item.item_uuid} className={cn("rounded-xl border p-3", item.status === 9 && "opacity-60")}><div className="flex items-start justify-between gap-3"><p className="min-w-0 break-words text-sm font-medium">{item.name}</p><span className="shrink-0 text-sm font-semibold tabular-nums" aria-label={t("quantity")}>× {item.quantity}</span></div><div className="mt-2 flex flex-wrap gap-1.5"><Badge variant="secondary" className="text-[10px]">{t(liveItemStatusLabel(item.status), { status: item.status })}</Badge>{item.customer_order && <Badge variant="outline" className="border-warning/40 text-[10px] text-warning-text">{t("customerOrder")}</Badge>}</div></div>)}{selectedOrder.items.length === 0 && <p className="text-xs text-muted-foreground">{t("noItems")}</p>}</div><div className="flex items-center justify-between gap-2 rounded-xl bg-primary/5 p-3"><span className="text-xs text-muted-foreground">{t("total")}</span><span className="text-sm font-semibold tabular-nums">{formatSimMoney(selectedOrder.totals.total, locale)}</span></div></>}
          <p className="border-t pt-3 text-xs leading-relaxed text-muted-foreground">{t("readonlyHelp")}</p>
          <div className="flex flex-col gap-2 border-t pt-3"><h3 className="flex items-center gap-2 text-xs font-semibold"><ChefHat className="size-4 text-info-text" />{t("kitchen")}</h3>{kitchen.slice(0, 30).map(({ order, item }) => <Button key={item.item_uuid} variant="ghost" className="h-auto min-h-11 justify-between gap-3 px-2 py-2 text-left" onClick={() => state.selectOrder(order.order_uuid)}><span className="min-w-0"><span className="block truncate text-xs">{item.name} × {item.quantity}</span><span className="text-[10px] text-muted-foreground">{nameForOrder(order.table_uuid)}</span></span><Badge variant="secondary" className="shrink-0 text-[10px]">{t(liveItemStatusLabel(item.status), { status: item.status })}</Badge></Button>)}{kitchen.length === 0 && <p className="text-xs text-muted-foreground">{t("noKitchen")}</p>}</div>
        </aside>
      </div>
    </>}
    <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-2 text-[10px] text-muted-foreground"><span className="flex items-center gap-1.5"><Eye className="size-3" />{t("readOnly")}</span><span>{!active ? t("inactive") : refreshing ? t("loading") : `${t("lastUpdated")}: ${updated}`}</span></footer>
  </main>;
}

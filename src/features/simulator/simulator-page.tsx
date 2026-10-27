"use client";

import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { I18nextProvider, useTranslation } from "react-i18next";
import { Box, ChevronRight, CirclePause, CirclePlay, Globe, LayoutGrid, LogOut, RotateCcw, Save, ShieldCheck, Users, Wifi, WifiOff } from "lucide-react";
import { AuthGuard } from "@/components/layout/auth-guard";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { internalRoute } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useSimulatorStore } from "@/stores/simulator-store";
import { SimConfirm } from "./confirmation";
import { SimField, SimSelect } from "./fields";
import { createSceneCharacters, formatSimMoney, orderName, tableStatusLabel } from "./helpers";
import { simulatorI18n, type SimulatorLanguage } from "./i18n";
import { OrderPanel } from "./order-panel";
import { ServicePanels } from "./service-panels";

const RestaurantScene = dynamic(() => import("./restaurant-scene"), { ssr: false,
  loading: () => <div className="absolute inset-0 grid place-content-center gap-4 p-8"><Skeleton className="h-48 w-64 rounded-3xl" /><Skeleton className="mx-auto h-4 w-40" /></div>,
});

class SceneBoundary extends Component<{ children: ReactNode; message: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div role="alert" className="grid h-full place-content-center p-8 text-center text-sm text-muted-foreground">{this.props.message}</div> : this.props.children; }
}

export function SimulatorPage() {
  return <AuthGuard><I18nextProvider i18n={simulatorI18n} defaultNS="simulator"><Suspense fallback={<WorkspaceLoading />}><SimulatorWorkspace /></Suspense></I18nextProvider></AuthGuard>;
}

function WorkspaceLoading() {
  return <div className="grid min-h-dvh gap-4 bg-background p-6"><Skeleton className="h-16 w-full" /><Skeleton className="h-96 w-full" /></div>;
}

function SimulatorWorkspace() {
  const { t, i18n } = useTranslation("simulator");
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const appLanguage = useAppStore((state) => state.language);
  const state = useSimulatorStore();
  const [branch, setBranch] = useState(() => searchParams.get("branch_uuid")?.trim() || user?.branch_uuid || "");
  const [zone, setZone] = useState("all");
  const [filter, setFilter] = useState("all");
  const [name, setName] = useState("");
  const [visible, setVisible] = useState(true);
  const [actor, setActor] = useState<string | null>(null);
  const attemptedSessions = useRef(new Set<string>());
  const { session, bootstrap, connected, loading, saving } = state;
  const permissions = session?.permissions ?? bootstrap?.permissions;
  const disabled = !connected || saving || loading || session?.status !== "running";
  const selectedTable = session?.tables.find((table) => table.table_uuid === state.selectedTableId);
  const selectedOrder = session?.orders.find((order) => order.order_uuid === state.selectedOrderId && order.status === "open");
  const characters = useMemo(() => session ? createSceneCharacters(session) : [], [session]);
  const zones = useMemo(() => [...new Map((session?.tables ?? []).map((table) => [table.zone_uuid, table.zone_name])).entries()], [session?.tables]);

  useEffect(() => { void simulatorI18n.changeLanguage(appLanguage); }, [appLanguage]);
  useEffect(() => {
    if (branch) void useSimulatorStore.getState().initialize(branch);
    return () => useSimulatorStore.getState().reset();
  }, [branch]);

  useEffect(() => {
    const setVisibility = () => setVisible(document.visibilityState === "visible" && document.hasFocus());
    const offline = () => useSimulatorStore.getState().disconnect();
    const online = () => { void useSimulatorStore.getState().reconnect(); };
    const focus = () => {
      setVisibility();
      const current = useSimulatorStore.getState();
      if (current.connected) void current.refresh(); else void current.reconnect();
    };
    setVisibility();
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    window.addEventListener("focus", focus);
    window.addEventListener("blur", setVisibility);
    document.addEventListener("visibilitychange", setVisibility);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      window.removeEventListener("focus", focus);
      window.removeEventListener("blur", setVisibility);
      document.removeEventListener("visibilitychange", setVisibility);
    };
  }, []);

  useEffect(() => {
    if (!session?.session_uuid || !connected || !visible || saving || loading || state.pending) return;
    const controller = new AbortController();
    const watch = async () => {
      while (!controller.signal.aborted && useSimulatorStore.getState().connected) {
        await useSimulatorStore.getState().watch(controller.signal);
      }
    };
    void watch();
    return () => controller.abort();
  }, [session?.session_uuid, connected, visible, saving, loading, state.pending]);

  useEffect(() => {
    if (!visible || !connected || session?.status !== "running" || session.mode !== "auto") return;
    const timer = window.setInterval(() => { void useSimulatorStore.getState().command("tick"); }, 2_000);
    return () => window.clearInterval(timer);
  }, [visible, connected, session?.status, session?.mode]);

  const sessionUuid = session?.session_uuid;
  const sessionBranch = session?.branch_uuid;
  useEffect(() => {
    if (!sessionUuid || !sessionBranch) return;
    const url = internalRoute(`/simulator?${new URLSearchParams({ branch_uuid: sessionBranch, session_uuid: sessionUuid })}`);
    window.history.replaceState(null, "", url);
  }, [sessionUuid, sessionBranch]);

  // A refresh/reopened window can recover its server session without storing any
  // transaction data in browser persistence.
  useEffect(() => {
    const sessionId = searchParams.get("session_uuid");
    const requestedBranch = searchParams.get("branch_uuid");
    if ((!requestedBranch || requestedBranch === branch) && bootstrap && !session && sessionId && !attemptedSessions.current.has(`${branch}:${sessionId}`) && bootstrap.branch.branch_uuid === branch && !loading && !saving) {
      attemptedSessions.current.add(`${branch}:${sessionId}`);
      void useSimulatorStore.getState().loadSession(sessionId);
    }
  }, [bootstrap, branch, loading, saving, searchParams, session]);

  const selectedActor = characters.find((entry) => entry.id === actor);
  const actorCustomer = session?.customers.find((entry) => entry.customer_uuid === actor);
  const tableCount = session?.tables.length ?? bootstrap?.tables.length ?? 0;
  const busy = saving || loading;

  return <main className="flex min-h-dvh flex-col bg-background text-foreground lg:h-dvh lg:overflow-hidden" lang={i18n.language}>
    <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-3"><div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Box className="size-6" /></div><div><p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">YUMMYGO / SIMULATION STUDIO</p><h1 className="text-base font-semibold sm:text-lg">{t("title")}</h1></div><Badge variant="outline" className="hidden gap-1.5 lg:flex">{connected ? <Wifi className="size-3 text-success" /> : <WifiOff className="size-3 text-destructive" />}{t(connected ? "online" : "disconnected")}</Badge></div>
      <div className="flex flex-wrap items-center gap-2"><span className="hidden text-xs text-muted-foreground xl:inline">{bootstrap?.actor.name ?? user?.name ?? user?.email}</span><SimSelect label={t("language")} className="h-10 w-25" value={i18n.language} onChange={(value) => void i18n.changeLanguage(value as SimulatorLanguage)} options={[{ value: "la", label: "ລາວ" }, { value: "th", label: "ไทย" }, { value: "en", label: "English" }]} /><ThemeToggle size="icon" variant="outline" className="size-10" /><Button aria-label={t("close")} className="size-10" variant="outline" size="icon" onClick={() => { if (window.opener || window.history.length <= 1) window.close(); else window.location.assign(internalRoute("/posAll/tables")); }}><LogOut /></Button></div>
    </header>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/25 px-4 py-3 sm:px-5">
      <div className="flex min-w-0 flex-wrap items-center gap-2"><span className="text-sm font-medium">{bootstrap?.branch.store_name ?? user?.store_name}</span><ChevronRight className="size-3 text-muted-foreground" />{bootstrap ? <SimSelect label={t("branch")} value={bootstrap.branch.branch_uuid} disabled={busy || Boolean(state.pending)} className="h-10 w-44" onChange={(value) => { window.history.replaceState(null, "", internalRoute(`/simulator?${new URLSearchParams({ branch_uuid: value })}`)); setZone("all"); setActor(null); setBranch(value); }} options={bootstrap.branches.map((entry) => ({ value: entry.branch_uuid, label: entry.branch_name }))} /> : <span className="text-xs text-muted-foreground">{user?.branch_name}</span>}
        {session && <><Badge variant="secondary">{t(session.status)}</Badge><span className="text-xs text-muted-foreground">{session.name} · v{session.version}</span></>}
      </div>
      {session && <div className="flex flex-wrap items-center gap-2"><Button className="h-10" variant="outline" disabled={busy || !connected} onClick={async () => { if (session.status === "running" && !await state.command("pause")) return; await state.initialize(branch); }}>{t("newSession")}</Button><SimSelect label={t("manual")} value={session.mode} disabled={busy || !connected} className="h-10 w-32" onChange={(mode) => void state.command("mode", { mode })} options={[{ value: "manual", label: t("manual") }, { value: "auto", label: t("auto") }]} />
        <Button className="h-10" disabled={busy || !connected} onClick={() => void state.command(session.status === "running" ? "pause" : "resume")}>{session.status === "running" ? <CirclePause /> : <CirclePlay />}{t(session.status === "running" ? "pause" : "resume")}</Button>
        <Button className="h-10" variant="outline" disabled={busy || !connected} title={session.saved_at ? `${t("snapshot")}: ${new Date(session.saved_at).toLocaleString()}` : t("save")} onClick={() => void state.command("save")}><Save /><span className="hidden sm:inline">{t("save")}</span></Button>
        <SimConfirm title={t("restoreTitle")} description={t("restoreHelp")} onConfirm={() => void state.command("restore")}><Button className="h-10" variant="outline" disabled={busy || !connected || !session.saved_at}>{t("restore")}</Button></SimConfirm>
        <SimConfirm title={t("resetTitle")} description={t("resetHelp")} onConfirm={() => void state.command("reset")}><Button className="size-10" variant="outline" aria-label={t("reset")} title={t("reset")} disabled={busy || !connected}><RotateCcw /></Button></SimConfirm>
      </div>}
    </div>
    {state.error && <Alert variant="destructive" className="m-3 w-auto shrink-0"><WifiOff /><AlertTitle>{connected ? state.error : t("disconnected")}</AlertTitle><AlertDescription><p>{connected ? "" : `${t("connectionHelp")} ${state.error}`}</p><Button className="mt-2 h-10" variant="outline" disabled={busy} onClick={() => bootstrap ? void state.reconnect() : void state.initialize(branch)}>{t("reconnect")}</Button></AlertDescription></Alert>}
    {!connected && !state.error && bootstrap && <Alert className="m-3 w-auto shrink-0"><WifiOff /><AlertTitle>{t("disconnected")}</AlertTitle><AlertDescription>{t("connectionHelp")}<Button className="ml-3 h-10" variant="outline" disabled={busy} onClick={() => void state.reconnect()}>{t("reconnect")}</Button></AlertDescription></Alert>}
    {loading && !bootstrap ? <WorkspaceLoading /> : !session ? <div className="grid flex-1 content-center gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_24rem] lg:p-12">
      <Empty className="items-start border bg-card p-8 text-left"><EmptyHeader className="items-start text-left"><EmptyMedia><div className="grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary"><UtensilsIcon /></div></EmptyMedia><p className="text-xs font-semibold uppercase tracking-widest text-primary">POSALL · 3D RESTAURANT</p><EmptyTitle className="text-2xl font-semibold sm:text-3xl">{t("noSession")}</EmptyTitle><EmptyDescription className="mt-3 max-w-lg text-sm leading-relaxed">{t("startHelp")}</EmptyDescription></EmptyHeader><div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground"><span className="rounded-lg border px-3 py-2"><LayoutGrid className="mr-2 inline size-4" />{tableCount} {t("tables")}</span><span className="rounded-lg border px-3 py-2">{bootstrap?.catalog.filter((product) => product.supported).length ?? 0} {t("menu")}</span><span className="rounded-lg border px-3 py-2"><ShieldCheck className="mr-2 inline size-4" />{t("onlineOnly")}</span></div></Empty>
      <section className="flex flex-col gap-5 rounded-2xl border bg-card p-6"><h2 className="font-semibold">{t("newSession")}</h2><SimField label={t("name")}><Input className="h-11" aria-label={t("name")} value={name} maxLength={100} onChange={(event) => setName(event.target.value)} /></SimField><Button className="h-12 w-full" disabled={!bootstrap || !connected || busy || !permissions?.operate} onClick={() => void state.startSession(name || undefined)}><CirclePlay />{t("start")}</Button><p className="text-xs leading-relaxed text-muted-foreground">{t("branchHelp")}</p>{state.sessions.length > 0 && <div className="flex flex-col gap-2 border-t pt-4"><p className="text-xs font-medium text-muted-foreground">{t("savedSessions")}</p>{state.sessions.map((entry) => <Button className="h-11 w-full justify-between" variant="outline" key={entry.session_uuid} disabled={busy || !connected} onClick={() => void state.loadSession(entry.session_uuid)}>{entry.name}<ChevronRight /></Button>)}</div>}</section>
    </div> : <>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[13rem_minmax(0,1fr)_22rem] xl:grid-cols-[14rem_minmax(0,1fr)_24rem]">
        <aside className="flex flex-col gap-4 border-b bg-card p-4 lg:overflow-y-auto lg:border-b-0 lg:border-r"><div className="flex items-center justify-between"><h2 className="text-sm font-semibold">{t("tables")}</h2><Badge variant="secondary">{tableCount}</Badge></div><SimSelect label={t("allZones")} value={zone} onChange={setZone} options={[{ value: "all", label: t("allZones") }, ...zones.map(([value, label]) => ({ value, label }))]} /><div className="flex gap-1">{["all", "available", "occupied"].map((value) => <Button key={value} variant={filter === value ? "secondary" : "ghost"} className="h-10 flex-1 px-1 text-xs" onClick={() => setFilter(value)}>{t(value)}</Button>)}</div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-2">{session.tables.filter((table) => (zone === "all" || table.zone_uuid === zone) && (filter === "all" || (filter === "available" ? table.status === 1 : table.status !== 1))).map((table) => <Button key={table.table_uuid} variant="outline" className={cn("h-auto min-h-20 flex-col items-start justify-center gap-1 rounded-xl px-3 py-2 text-left", table.table_uuid === state.selectedTableId && "border-primary bg-primary/5 ring-1 ring-primary", table.status !== 1 && "border-info/35")} onClick={() => state.selectTable(table.table_uuid)}><div className="flex w-full items-center justify-between gap-1"><span className="text-sm font-semibold">{table.name}</span><span className={cn("size-1.5 rounded-full", table.status === 1 ? "bg-success" : "bg-info")} /></div><span className="text-[10px] text-muted-foreground">{t(tableStatusLabel(table.status))}</span><span className="text-[10px] text-muted-foreground">{table.guests || table.seats} <Users className="ml-1 inline size-3" /></span></Button>)}</div>
          {session.config.use_tables === false && <Button className="h-11 w-full" disabled={disabled} onClick={() => { state.selectOrder(""); }}><CirclePlay />{t("openCounter")}</Button>}
          {session.orders.some((order) => order.status === "open") && <div className="flex flex-col gap-2 border-t pt-3"><h3 className="text-xs font-medium text-muted-foreground">{t("activeBills")}</h3>{session.orders.filter((order) => order.status === "open").map((order) => <Button key={order.order_uuid} variant={state.selectedOrderId === order.order_uuid ? "secondary" : "outline"} className="h-11 w-full justify-between" onClick={() => state.selectOrder(order.order_uuid)}>{orderName(order, session)} · {order.order_uuid.slice(0, 5)}<ChevronRight /></Button>)}</div>}
          <div className="flex flex-col gap-2 border-t pt-3"><h3 className="text-xs font-medium text-muted-foreground">{t("actor")}</h3>{characters.map((entry) => <Button key={entry.id} variant={actor === entry.id ? "secondary" : "ghost"} className="h-auto min-h-10 w-full justify-between gap-2 whitespace-normal py-2 text-left" onClick={() => { setActor(entry.id); if (entry.tableId) state.selectTable(entry.tableId); }}><span className="truncate">{session.customers.find((customer) => customer.customer_uuid === entry.id)?.name ?? t(`roles.${entry.role}`)}</span><span className="text-[10px] text-muted-foreground">{t(`states.${entry.state}`, { defaultValue: entry.state })}</span></Button>)}</div>
        </aside>
        <section aria-label={t("view3d")} className="relative min-h-96 overflow-hidden bg-muted/30 lg:min-h-0"><SceneBoundary message={t("webglError")}><RestaurantScene tables={session.tables.map((table) => ({ id: table.table_uuid, name: table.name, zone: table.zone_name, status: table.status === 1 ? "available" : table.status === 6 ? "billing" : "occupied", guests: table.guests }))} selectedTableId={state.selectedTableId} onSelectTable={state.selectTable} paused={session.status !== "running" || !connected || !visible} characters={characters} selectedCharacterId={actor} onStopFollowing={() => setActor(null)} onSelectCharacter={setActor} /></SceneBoundary>
          <div className="pointer-events-none absolute left-4 top-4 rounded-xl border bg-card/95 px-3 py-2 shadow-sm"><p className="text-xs font-semibold">{bootstrap?.branch.branch_name}</p><p className="mt-1 text-[10px] text-muted-foreground">{t("onlineOnly")}</p></div>
          {session.status === "paused" && <div className="pointer-events-none absolute inset-x-0 top-20 flex justify-center"><Badge variant="secondary" className="gap-2 px-4 py-2 shadow-sm"><CirclePause className="size-4" />{t("paused")}</Badge></div>}
          {selectedActor && <div className="absolute bottom-12 left-4 right-4 flex items-center justify-between gap-3 rounded-xl border bg-card/95 p-3 shadow-sm"><div><p className="text-sm font-medium">{actorCustomer?.name ?? t(`roles.${selectedActor.role}`)}</p><p className="text-xs text-muted-foreground">{t(`states.${selectedActor.state}`, { defaultValue: selectedActor.state })}</p></div><Button variant="ghost" className="h-10" onClick={() => setActor(null)}>{t("close")}</Button></div>}
          <div className="pointer-events-none absolute bottom-3 left-4 right-4 flex justify-end gap-2 text-[10px] text-muted-foreground"><span className="rounded-md bg-card/90 px-2 py-1 tabular-nums">{t("minutes")} {session.tick}</span></div>
        </section>
        <aside aria-label={t("operations")} className="min-h-0 overflow-y-auto border-t bg-card lg:border-l lg:border-t-0">{permissions && <OrderPanel key={selectedOrder?.order_uuid ?? selectedTable?.table_uuid ?? "counter"} session={session} order={selectedOrder} table={selectedTable} permissions={permissions} disabled={disabled} />}</aside>
      </div>
      <ServicePanels session={session} disabled={disabled || !permissions?.operate} />
    </>}
    <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-4 py-2 text-[10px] text-muted-foreground"><span className="flex items-center gap-1.5"><ShieldCheck className="size-3" />{t("onlineOnly")}</span><span className="flex items-center gap-3">{saving && t("processing")}{session?.saved_at && `${t("snapshot")}: ${new Date(session.saved_at).toLocaleTimeString()}`}{session && <span className="font-medium tabular-nums">{t("sales")}: {formatSimMoney(session.sales.total)}</span>}<Globe className="size-3" /></span></footer>
  </main>;
}

function UtensilsIcon() { return <LayoutGrid className="size-9" />; }

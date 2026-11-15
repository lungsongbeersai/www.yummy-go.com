"use client";

import { useEffect, useRef, useState } from "react";
import { Printer, RefreshCw, Search, UserRound, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppPagination } from "@/components/common/app-pagination";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatReportDateTime } from "@/features/report/shared/report-date-format";
import { printHtmlWithAndroidSystemPrint } from "@/lib/android-system-print";
import { isCapacitorNativeApp, openWindowOutsideNativeApp } from "@/lib/capacitor-platform";
import { money } from "@/lib/format";
import { ServiceError } from "@/lib/api";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { employeeWorkIdentity } from "@/stores/employee-work-helpers";
import { useEmployeeWorkStore } from "@/stores/employee-work-store";
import type { EmployeeWorkResponse } from "@/services/pos";
import { EMPLOYEE_WORK_KITCHEN, EMPLOYEE_WORK_PAYMENT, EMPLOYEE_WORK_SCOPES, employeeWorkKitchenLabel, employeeWorkPaymentLabels, employeeWorkScopeLabel } from "./employee-work-format";
import { EmployeeWorkOrders } from "./employee-work-orders";
import { renderEmployeeWorkReport } from "./employee-work-print";

async function waitForPrintFonts(target: Window, failedMessage: string) {
  let timer: number | undefined;
  const removeListeners: (() => void)[] = [];
  const selectedFamily = () => target.getComputedStyle(target.document.body).fontFamily.split(",")[0].trim().replace(/^["']|["']$/g, "");
  const definitionsReady = () => {
    const family = selectedFamily();
    const registered = new Set(Array.from(target.document.fonts, face => face.family.replace(/^["']|["']$/g, "")));
    return family.startsWith("App Document ") && registered.has(family) && registered.has("App Document Noto Sans");
  };
  try {
    await Promise.race([
      (async () => {
        const stylesheets = Array.from(target.document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
        if (!stylesheets.length) throw new Error(failedMessage);
        await Promise.all(stylesheets.map(stylesheet => {
          if (stylesheet.sheet && definitionsReady()) return;
          return new Promise<void>((resolve, reject) => {
            const loaded = () => resolve();
            const failed = () => reject(new Error(failedMessage));
            stylesheet.addEventListener("load", loaded, { once: true });
            stylesheet.addEventListener("error", failed, { once: true });
            removeListeners.push(() => { stylesheet.removeEventListener("load", loaded); stylesheet.removeEventListener("error", failed); });
            if (stylesheet.sheet && definitionsReady()) loaded();
          });
        }));
        const family = target.getComputedStyle(target.document.body).fontFamily;
        if (!definitionsReady()) throw new Error(failedMessage);
        const faces = await Promise.all([target.document.fonts.load(`400 12px ${family}`, "ລາຍງານ ABC 0123456789"), target.document.fonts.load(`700 12px ${family}`, "ລາຍງານ ABC 0123456789")]);
        await target.document.fonts.ready;
        if (faces.some(loaded => !loaded.some(face => face.family.replace(/^["']|["']$/g, "") === selectedFamily() && face.status === "loaded"))) throw new Error(failedMessage);
      })(),
      new Promise<never>((_, reject) => { timer = window.setTimeout(() => reject(new Error(failedMessage)), 15_000); }),
    ]);
  } finally { window.clearTimeout(timer); removeListeners.forEach(remove => remove()); }
}

export function EmployeeWorkLauncher() {
  const identity = useAuthStore(state => employeeWorkIdentity(state.user, state.token));
  const sessionVersion = useEmployeeWorkStore(state => state.sessionVersion);
  return <EmployeeWorkSession key={`${identity}:${sessionVersion}`} />;
}

function EmployeeWorkSession() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button type="button" variant="outline" className="min-h-11 shrink-0 gap-1.5 rounded-lg px-3 font-lao"><UserRound className="size-4" /><span>{t("employeeWork.title")}</span></Button></DialogTrigger>{open ? <EmployeeWorkPanel /> : null}</Dialog>;
}

function EmployeeWorkPanel() {
  const { t } = useTranslation();
  const l = (key: string) => key === "all" ? t("common.all") : t(`employeeWork.${key}`);
  const showAmount = (value: number | null) => value === null ? l("unknown") : money(value);
  const language = useAppStore(state => state.language);
  const laoFont = useAppStore(state => state.laoFont);
  const state = useEmployeeWorkStore();
  const { enter, leave, load, checkRollover, boundaryDelay } = state;
  const [search, setSearch] = useState("");
  const [printError, setPrintError] = useState<string | null>(null);
  const mounted = useRef(false);
  const printing = useRef(false);
  const printWindow = useRef<Window | null>(null);
  const response = state.response;

  useEffect(() => {
    mounted.current = true;
    const lease = enter();
    return () => { mounted.current = false; printWindow.current?.close(); printWindow.current = null; leave(lease); };
  }, [enter, leave]);
  useEffect(() => { void load({ lang: language }).catch(() => {}); }, [language, load]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible" && !checkRollover()) void load().catch(() => {}); };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [checkRollover, load]);
  useEffect(() => {
    let timer: number | undefined;
    const schedule = () => { const delay = boundaryDelay(); if (delay !== null) timer = window.setTimeout(() => { if (!checkRollover()) schedule(); }, delay); };
    schedule();
    return () => window.clearTimeout(timer);
  }, [boundaryDelay, checkRollover, state.clock, response]);
  useEffect(() => {
    if (response && !state.loading && response.pagination.page > Math.max(1, response.pagination.total_pages)) void load({ page: Math.max(1, response.pagination.total_pages) }).catch(() => {});
  }, [load, response, state.loading]);

  async function print() {
    if (printing.current || state.loading || state.reportLoading) return;
    printing.current = true;
    setPrintError(null);
    const native = isCapacitorNativeApp();
    const target = native ? null : openWindowOutsideNativeApp("", "_blank", "width=1000,height=800");
    if (!native && !target) { setPrintError(l("printPopupBlocked")); printing.current = false; return; }
    printWindow.current = target;
    if (target) { target.document.title = l("reportTitle"); target.document.body.textContent = l("printPreparing"); }
    let preparedReport: EmployeeWorkResponse | null = null;
    try {
      preparedReport = await useEmployeeWorkStore.getState().loadReport();
      const report = preparedReport;
      if (!report || !mounted.current || !useEmployeeWorkStore.getState().isCurrentReport(report)) { target?.close(); return; }
      const html = renderEmployeeWorkReport(report, l, laoFont, `${window.location.origin}/`);
      if (native) {
        if (!await printHtmlWithAndroidSystemPrint({ html, jobName: l("reportTitle") })) throw new Error(l("reportFailed"));
      } else if (target && !target.closed) {
        target.document.open(); target.document.write(html); target.document.close();
        await waitForPrintFonts(target, l("reportFailed"));
        if (!mounted.current || target.closed || !useEmployeeWorkStore.getState().isCurrentReport(report)) { target.close(); return; }
        target.focus(); target.print();
      }
    } catch (error) {
      target?.close();
      if (mounted.current && (!preparedReport || useEmployeeWorkStore.getState().isCurrentReport(preparedReport))) setPrintError(error instanceof ServiceError && error.statusCode === 413 ? l("reportTooLarge") : error instanceof Error ? error.message : l("reportFailed"));
    } finally { printing.current = false; }
  }

  const scope = state.params.scope ?? "current";
  const rangeStart = response?.data.length ? (response.pagination.page - 1) * response.pagination.limit + 1 : 0;
  const rangeEnd = response ? Math.min(response.pagination.total, rangeStart + response.data.length - 1) : 0;
  return <DialogContent showCloseButton={false} className="inset-0 top-0 left-0 flex h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 font-lao sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[min(90dvh,900px)] sm:max-h-[90dvh] sm:w-[calc(100%-2rem)] sm:max-w-6xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl">
    <div className="flex shrink-0 items-start justify-between gap-2 border-b bg-card px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top,0px))] sm:px-5 sm:py-3"><DialogHeader className="min-w-0 gap-1 rounded-none border-0 bg-transparent p-0"><DialogTitle className="flex items-center gap-2 text-base"><UserRound className="size-4 text-primary-text" />{l("title")}</DialogTitle><DialogDescription className="text-xs">{l("description")}</DialogDescription>{response ? <div className="grid gap-0.5 text-xs text-muted-foreground"><p>{l("responsibleEmployee")}: <strong className="text-foreground">{response.employee.display_name}</strong>{response.employee.branch_name ? ` · ${response.employee.branch_name}` : ""}</p><p>{formatReportDateTime(response.business_day.starts_at)} – {formatReportDateTime(new Date(Date.parse(response.business_day.ends_at) - 1).toISOString())}</p><p>{l("periodHint")}</p></div> : null}</DialogHeader><DialogClose asChild><Button type="button" variant="ghost" size="icon" className="size-11 shrink-0" aria-label={t("actions.close")}><X /></Button></DialogClose></div>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5">
      <div className="grid gap-3"><Tabs value={scope} onValueChange={value => { if (EMPLOYEE_WORK_SCOPES.includes(value as typeof scope)) void load({ scope: value as typeof scope, page: 1 }).catch(() => {}); }}><TabsList className="h-auto w-full gap-1 rounded-lg p-1">{EMPLOYEE_WORK_SCOPES.map(value => <TabsTrigger key={value} value={value} className="min-h-11 flex-1 whitespace-normal px-2 text-xs sm:text-sm">{l(value === "carryover" ? "previousDay" : employeeWorkScopeLabel(value))}<span className="ml-1 tabular-nums">{response?.scope_summary[value].order_count ?? "—"}</span></TabsTrigger>)}</TabsList></Tabs>
        {scope !== "current" ? <p className="text-xs text-muted-foreground">{l(scope === "carryover" ? "carryoverHint" : "undatedHint")}</p> : null}
        <form className="flex gap-2" onSubmit={event => { event.preventDefault(); void load({ search: search.trim(), page: 1 }).catch(() => {}); }}><Input aria-label={l("search")} placeholder={l("search")} value={search} maxLength={120} className="min-h-11 min-w-0 flex-1" onChange={event => setSearch(event.target.value)} /><Button type="submit" variant="outline" className="size-11 shrink-0" aria-label={t("actions.search")}><Search className="size-4" /></Button></form>
        <div className="grid grid-cols-2 gap-2"><div className="grid gap-1"><Label htmlFor="employee-work-kitchen">{l("kitchen")}</Label><Select value={state.params.kitchen_status ?? "all"} onValueChange={value => { const status = EMPLOYEE_WORK_KITCHEN.find(option => option === value); if (status) void load({ kitchen_status: status, page: 1 }).catch(() => {}); }}><SelectTrigger id="employee-work-kitchen" className="min-h-11 w-full"><SelectValue /></SelectTrigger><SelectContent className="font-lao">{EMPLOYEE_WORK_KITCHEN.map(status => <SelectItem key={status} value={status} className="min-h-11">{status === "all" ? t("common.all") : l(employeeWorkKitchenLabel(status))}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-1"><Label htmlFor="employee-work-payment">{l("settlement")}</Label><Select value={state.params.payment_status ?? "all"} onValueChange={value => { const status = EMPLOYEE_WORK_PAYMENT.find(option => option === value); if (status) void load({ payment_status: status, page: 1 }).catch(() => {}); }}><SelectTrigger id="employee-work-payment" className="min-h-11 w-full"><SelectValue /></SelectTrigger><SelectContent className="font-lao">{EMPLOYEE_WORK_PAYMENT.map(status => <SelectItem key={status} value={status} className="min-h-11">{status === "all" ? t("common.all") : employeeWorkPaymentLabels(status).map(l).join(" · ")}</SelectItem>)}</SelectContent></Select></div></div>
        {state.error ? <Alert variant="destructive"><AlertTitle>{l("loadFailed")}</AlertTitle><AlertDescription>{state.error}</AlertDescription><Button type="button" variant="outline" className="min-h-11" onClick={() => void load().catch(() => {})}>{t("mySales.retry")}</Button></Alert> : null}
        {response ? <><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[["bills", String(response.summary.order_count)], ["ownItems", String(response.summary.item_count)], ["ownTotal", showAmount(response.summary.total_amount)], ["unclosedBills", String(response.summary.open_count)]].map(([key, value]) => <div key={key} className="min-w-0 rounded-md border border-border bg-card p-2.5"><p className="text-xs text-muted-foreground">{l(key)}</p><p className="break-words text-sm font-semibold tabular-nums">{value}</p></div>)}</div><p className="text-xs text-muted-foreground">{l("amountsHint")}</p><p className="text-xs text-muted-foreground">{l("currentState")}</p>{response.summary.financial_unknown_count > 0 ? <p role="status" className="text-xs text-muted-foreground">{l("unknownAmounts")}</p> : null}</> : null}
        <section aria-label={l(employeeWorkScopeLabel(scope))} aria-busy={state.loading}>{!response && (state.loading || state.rollover) ? <LoadingState label={l(state.rollover ? "rollover" : "title")} variant="table" /> : response?.data.length ? <EmployeeWorkOrders orders={response.data} /> : !state.error ? <EmptyState title={l("empty")} description={l("emptyHint")} /> : null}</section>
        {response ? <AppPagination disabled={state.loading} page={response.pagination.page} totalPages={response.pagination.total_pages} onPageChange={page => void load({ page }).catch(() => {})} rangeLabel={t("mySales.range", { start: rangeStart, end: rangeEnd, total: response.pagination.total })} /> : null}
      </div>
    </div>
    <div className="grid shrink-0 gap-2 border-t bg-card px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] sm:px-5">{state.reportError || printError ? <p role="alert" className="break-words text-xs text-destructive">{l("reportFailed")}: {printError || state.reportError}</p> : null}<div className="flex items-center justify-between gap-2"><p className="min-w-0 text-xs text-muted-foreground">{response ? `${l("refreshedAt")}: ${formatReportDateTime(response.server_now)}` : ""}</p><div className="flex shrink-0 gap-2"><Button type="button" variant="outline" className="min-h-11 px-3" aria-label={t("actions.refresh")} disabled={state.loading} onClick={() => { if (!checkRollover()) void load().catch(() => {}); }}><RefreshCw className="size-4" /><span className="hidden sm:inline">{t("actions.refresh")}</span></Button><Button type="button" className="min-h-11 px-3" disabled={!response || state.loading || state.reportLoading} onClick={() => void print()}><Printer className="size-4" />{l(state.reportLoading ? "printPreparing" : "printOwnReport")}</Button></div></div></div>
  </DialogContent>;
}

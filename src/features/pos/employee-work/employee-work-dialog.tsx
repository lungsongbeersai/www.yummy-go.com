"use client";

import { useEffect, useRef, useState } from "react";
import { Clock3, Info, Inbox, Printer, RefreshCw, UserRound, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppPagination } from "@/components/common/app-pagination";
import { LoadingState } from "@/components/common/loading-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatReportDate, formatReportDateTime } from "@/features/report/shared/report-date-format";
import { printHtmlWithAndroidSystemPrint } from "@/lib/android-system-print";
import { isCapacitorNativeApp, openWindowOutsideNativeApp } from "@/lib/capacitor-platform";
import { ServiceError } from "@/lib/api";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { employeeWorkIdentity } from "@/stores/employee-work-helpers";
import { useEmployeeWorkStore } from "@/stores/employee-work-store";
import type { EmployeeWorkResponse } from "@/services/pos";
import { employeeWorkScopeLabel } from "./employee-work-format";
import { EmployeeWorkScopes } from "./components/employee-work-scopes";
import { EmployeeWorkToolbar } from "./components/employee-work-toolbar";
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
  const rangeEnd = response?.data.length ? Math.min(response.pagination.total, rangeStart + response.data.length - 1) : 0;
  const updatedAt = response ? formatReportDateTime(response.server_now) : "";
  const updatedTime = updatedAt.split(" ")[1]?.slice(0, 5) ?? "—";
  return <DialogContent showCloseButton={false} className="inset-0 top-0 left-0 flex h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 font-lao sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[min(90dvh,900px)] sm:max-h-[90dvh] sm:w-[calc(100%-2rem)] sm:max-w-6xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl">
    <div className="flex shrink-0 items-start justify-between gap-2 border-b bg-card px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top,0px))] sm:px-5 sm:py-3">
      <DialogHeader className="min-w-0 flex-1 gap-1 rounded-none border-0 bg-transparent p-0 text-left">
        <DialogTitle className="flex min-h-9 items-center gap-2 text-base"><UserRound className="size-4 shrink-0 text-primary-text" /><span className="truncate">{l("title")}</span></DialogTitle>
        <DialogDescription className="sr-only">{l("description")}</DialogDescription>
        {response ? <div className="flex min-w-0 items-center justify-between gap-3 text-xs text-muted-foreground"><span className="truncate" title={response.employee.display_name}>{response.employee.display_name}</span><span className="shrink-0 tabular-nums">{formatReportDate(response.business_day.date)}</span></div> : null}
      </DialogHeader>
      <div className="flex shrink-0 gap-1">
        <Popover><PopoverTrigger asChild><Button type="button" variant="ghost" size="icon" className="size-11 text-muted-foreground" aria-label={l("details")}><Info className="size-4" /></Button></PopoverTrigger><PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] gap-3 p-4 font-lao">
          {response ? <><p className="text-sm font-medium">{response.employee.display_name}</p>{response.employee.branch_name ? <p>{response.employee.branch_name}</p> : null}<p className="tabular-nums">{formatReportDateTime(response.business_day.starts_at)} – {formatReportDateTime(new Date(Date.parse(response.business_day.ends_at) - 1).toISOString())}</p></> : null}
          <p className="text-muted-foreground">{l("amountsHint")}</p>
        </PopoverContent></Popover>
        <DialogClose asChild><Button type="button" variant="ghost" size="icon" className="size-11" aria-label={t("actions.close")}><X /></Button></DialogClose>
      </div>
    </div>
    <EmployeeWorkScopes scope={scope} counts={response?.scope_summary} onChange={value => void load({ scope: value, page: 1 }).catch(() => {})} toolbar={
      <EmployeeWorkToolbar response={response} params={state.params} search={search} onSearchChange={setSearch} onSearch={() => void load({ search: search.trim(), page: 1 }).catch(() => {})} onFilterChange={params => void load(params).catch(() => {})} />
    }>
      <div className="grid gap-3">
        {state.error ? <Alert variant="destructive"><AlertTitle>{l("loadFailed")}</AlertTitle><AlertDescription>{state.error}</AlertDescription><Button type="button" variant="outline" className="min-h-11" onClick={() => void load().catch(() => {})}>{t("mySales.retry")}</Button></Alert> : null}
        {response && response.summary.financial_unknown_count > 0 ? <p role="status" className="text-xs text-muted-foreground">{l("unknownAmounts")}</p> : null}
        <section aria-label={l(employeeWorkScopeLabel(scope))} aria-busy={state.loading}>
          {!response && (state.loading || state.rollover) ? <LoadingState label={l(state.rollover ? "rollover" : "title")} variant="table" /> : response?.data.length ? <EmployeeWorkOrders orders={response.data} /> : !state.error ? <Empty className="min-h-36 py-8"><EmptyHeader><EmptyMedia variant="icon"><Inbox /></EmptyMedia><EmptyTitle>{l("empty")}</EmptyTitle></EmptyHeader></Empty> : null}
        </section>
        {response && response.pagination.total > 0 ? <AppPagination disabled={state.loading} page={response.pagination.page} totalPages={response.pagination.total_pages} onPageChange={page => void load({ page }).catch(() => {})} rangeLabel={t("mySales.range", { start: rangeStart, end: rangeEnd, total: response.pagination.total })} /> : null}
      </div>
    </EmployeeWorkScopes>
    <div className="grid shrink-0 gap-2 border-t bg-card px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] sm:px-5">
      {state.reportError || printError ? <p role="alert" className="break-words text-xs text-destructive">{l("reportFailed")}: {printError || state.reportError}</p> : null}
      <div className="flex items-center justify-between gap-3">
        <time dateTime={response?.server_now} title={updatedAt} aria-label={`${l("refreshedAt")}: ${updatedAt}`} className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground tabular-nums"><Clock3 aria-hidden="true" className="size-3.5" />{updatedTime}</time>
        <div className="flex min-w-0 flex-1 justify-end gap-2"><Button type="button" variant="outline" size="icon" className="size-11 shrink-0" aria-label={t("actions.refresh")} disabled={state.loading} onClick={() => { if (!checkRollover()) void load().catch(() => {}); }}><RefreshCw className="size-4" /></Button><Button type="button" className="min-h-11 min-w-0 gap-2 px-3" disabled={!response || state.loading || state.reportLoading} aria-busy={state.reportLoading} aria-label={l(state.reportLoading ? "printPreparing" : "printOwnReport")} onClick={() => void print()}><Printer className="size-4 shrink-0" /><span className="truncate">{l("printShort")}</span></Button></div>
      </div>
    </div>
  </DialogContent>;
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Download, ExternalLink, FileText, LoaderCircle, Printer, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/common/loading-state";
import { createCommercialPdfLease, type CommercialPdfLease } from "@/features/commercial/commercial-pdf-download";
import { ServiceError } from "@/lib/api";
import { internalRoute } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { EmployeeWorkResponse } from "@/services/pos";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { employeeWorkIdentity } from "@/stores/employee-work-helpers";
import { useEmployeeWorkStore } from "@/stores/employee-work-store";
import { createSessionGuard } from "@/stores/session-store-registry";
import { EmployeeWorkReportPreview } from "./components/employee-work-report-preview";
import { createEmployeeWorkPdf, EmployeeWorkPdfError } from "./employee-work-pdf";
import { employeeWorkReportHref, parseEmployeeWorkReportDestination, type EmployeeWorkReportDestination } from "./employee-work-report-link";
import { renderEmployeeWorkReport } from "./employee-work-print";

interface PreparedReport { report: EmployeeWorkResponse; html: string }
interface ReadyPdf { file: File; lease: CommercialPdfLease }

function ReportNotice({ message, retry, signIn }: { message: string; retry?: () => void; signIn?: () => void }) {
  const { t } = useTranslation();
  return <div className="mx-auto grid w-full max-w-3xl gap-4 p-3 font-lao sm:p-5">
    <Alert variant="destructive"><AlertDescription>{message}</AlertDescription></Alert>
    <div className="flex flex-wrap gap-2"><Button asChild variant="outline" className="min-h-11"><Link href="/posAll/tables"><ArrowLeft />{t("employeeWork.backToTables")}</Link></Button>{retry ? <Button type="button" className="min-h-11" onClick={retry}><RefreshCw />{t("mySales.retry")}</Button> : null}{signIn ? <Button type="button" className="min-h-11 h-auto whitespace-normal" onClick={signIn}>{t("employeeWork.signInAppAccount")}</Button> : null}</div>
  </div>;
}

export function EmployeeWorkReportPage() {
  const { t } = useTranslation();
  const search = useSearchParams().toString();
  const destination = useMemo(() => parseEmployeeWorkReportDestination(new URLSearchParams(search)), [search]);
  const user = useAuthStore(state => state.user);
  const token = useAuthStore(state => state.token);
  const version = useEmployeeWorkStore(state => state.sessionVersion);
  const identity = employeeWorkIdentity(user, token);
  if (!destination) return <ReportNotice message={t("employeeWork.invalidReportLink")} />;
  if (user?.uuid !== destination.employeeUuid || user.branch_uuid !== destination.branchUuid) return <ReportNotice message={t("employeeWork.reportAccountMismatch")} signIn={() => {
    const target = internalRoute(`/login?redirect=${encodeURIComponent(employeeWorkReportHref(destination))}`);
    useAuthStore.getState().logout();
    window.location.assign(target);
  }} />;
  return <EmployeeWorkReportSession key={`${identity}:${version}:${employeeWorkReportHref(destination)}`} destination={destination} identity={identity} />;
}

function EmployeeWorkReportSession({ destination, identity }: { destination: EmployeeWorkReportDestination; identity: string }) {
  const { t, i18n } = useTranslation();
  const decorated = useAppStore(state => state.decorBackground);
  const label = useMemo(() => {
    const fixed = i18n.getFixedT(destination.language);
    return (key: string) => fixed(key === "all" ? "common.all" : `employeeWork.${key}`);
  }, [destination.language, i18n]);
  const [attempt, setAttempt] = useState(0);
  const [prepared, setPrepared] = useState<PreparedReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [preparingPdf, setPreparingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdf, setPdf] = useState<ReadyPdf | null>(null);
  const storeReport = useEmployeeWorkStore(state => state.report);
  const storeError = useEmployeeWorkStore(state => state.error);
  const storeLoading = useEmployeeWorkStore(state => state.loading);
  const frame = useRef<HTMLIFrameElement>(null);
  const active = useRef(false);
  const sessionCurrent = useRef<() => boolean>(() => false);
  const pdfPending = useRef(false);
  const pdfGeneration = useRef(0);
  const pdfLease = useRef<CommercialPdfLease | null>(null);
  const leaseOwner = useRef({});

  const identityCurrent = useCallback(() => {
    const auth = useAuthStore.getState();
    return active.current && sessionCurrent.current() && employeeWorkIdentity(auth.user, auth.token) === identity && auth.user?.uuid === destination.employeeUuid && auth.user.branch_uuid === destination.branchUuid;
  }, [destination.branchUuid, destination.employeeUuid, identity]);
  const reportCurrent = useCallback(() => Boolean(prepared && identityCurrent() && useEmployeeWorkStore.getState().isCurrentReport(prepared.report) && prepared.report.business_day.date === destination.businessDate), [destination.businessDate, identityCurrent, prepared]);

  useEffect(() => {
    active.current = true;
    sessionCurrent.current = createSessionGuard();
    const store = useEmployeeWorkStore.getState();
    const lease = store.enter();
    let cancelled = false;
    const current = () => !cancelled && identityCurrent();
    void (async () => {
      try {
        await i18n.loadLanguages(destination.language);
        if (!current()) return;
        await store.load({ scope: destination.scope, kitchen_status: destination.kitchenStatus, payment_status: destination.paymentStatus, search: destination.search, lang: destination.language, page: 1 });
        if (!current()) return;
        const snapshot = useEmployeeWorkStore.getState().response;
        if (!snapshot || snapshot.business_day.date !== destination.businessDate) { setError(t("employeeWork.reportDayMismatch")); return; }
        const report = await useEmployeeWorkStore.getState().loadReport();
        if (!current()) return;
        if (!report || report.business_day.date !== destination.businessDate || !useEmployeeWorkStore.getState().isCurrentReport(report)) { setError(t("employeeWork.reportDayMismatch")); return; }
        setPrepared({ report, html: renderEmployeeWorkReport(report, label, destination.laoFont, `${window.location.origin}/`) });
      } catch (cause) {
        if (current()) setError(t(cause instanceof ServiceError && cause.statusCode === 413 ? "employeeWork.reportTooLarge" : "employeeWork.reportFailed"));
      }
    })();
    return () => {
      cancelled = true;
      active.current = false;
      pdfGeneration.current += 1;
      pdfLease.current?.release();
      store.leave(lease);
    };
  }, [attempt, destination, i18n, identityCurrent, label, t]);

  useEffect(() => {
    if (!prepared) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      const delay = useEmployeeWorkStore.getState().boundaryDelay();
      if (delay !== null) timer = setTimeout(() => { if (!useEmployeeWorkStore.getState().checkRollover()) schedule(); }, delay);
    };
    const refresh = () => {
      if (document.visibilityState !== "visible" || !identityCurrent()) return;
      const store = useEmployeeWorkStore.getState();
      if (!store.checkRollover()) void store.load().catch(() => {});
    };
    schedule();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const interval = setInterval(refresh, 30_000);
    const unsubscribe = useEmployeeWorkStore.subscribe(state => { if (state.report !== prepared.report) pdfLease.current?.release(); });
    return () => { clearTimeout(timer); clearInterval(interval); unsubscribe(); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [identityCurrent, prepared]);

  function retry() {
    pdfGeneration.current += 1;
    pdfPending.current = false;
    pdfLease.current?.release();
    setPrepared(null); setError(null); setPreviewReady(false); setPreviewError(false); setPdf(null); setPreparingPdf(false); setPdfError(null); setAttempt(value => value + 1);
  }

  async function preparePdf() {
    if (!prepared || !reportCurrent() || !previewReady || pdfPending.current) return;
    pdfPending.current = true;
    const generation = ++pdfGeneration.current;
    const session = createSessionGuard();
    setPreparingPdf(true); setPdfError(null);
    pdfLease.current?.release(); setPdf(null);
    const current = () => generation === pdfGeneration.current && session() && reportCurrent() && !useEmployeeWorkStore.getState().error;
    try {
      const result = await createEmployeeWorkPdf({ report: prepared.report, html: prepared.html, fileName: `my-orders-${destination.businessDate}.pdf`, isCurrent: current });
      if (!current()) return;
      const lease = createCommercialPdfLease(result.file, {
        isCurrent: current, owner: leaseOwner.current,
        watchIdentity: invalidate => useAuthStore.subscribe(state => { if (employeeWorkIdentity(state.user, state.token) !== identity) invalidate(); }),
      });
      pdfLease.current = lease;
      setPdf({ file: result.file, lease });
      void lease.released.then(() => {
        if (identityCurrent()) setPdf(existing => existing?.lease === lease ? null : existing);
      });
    } catch (cause) { if (current()) setPdfError(t(cause instanceof EmployeeWorkPdfError && cause.code === "too-large" ? "employeeWork.reportTooLarge" : "employeeWork.reportFailed")); }
    finally { if (generation === pdfGeneration.current) { pdfPending.current = false; if (identityCurrent()) setPreparingPdf(false); } }
  }

  function transfer(event: MouseEvent<HTMLAnchorElement>) {
    const store = useEmployeeWorkStore.getState();
    if (store.loading || store.error || !reportCurrent() || !pdf?.lease.transfer()) event.preventDefault();
  }

  function print() {
    const store = useEmployeeWorkStore.getState();
    if (!previewReady || !reportCurrent() || store.loading || store.error) return;
    const target = frame.current?.contentWindow;
    if (!target) { setPdfError(t("employeeWork.reportFailed")); return; }
    try { target.focus(); target.print(); }
    catch { if (reportCurrent()) setPdfError(t("employeeWork.reportFailed")); }
  }

  if (error) return <ReportNotice message={error} retry={retry} />;
  if (!prepared) return <LoadingState label={t("employeeWork.printPreparing")} variant="table" />;
  if (storeError) return <ReportNotice message={t("employeeWork.reportFailed")} retry={retry} />;
  if (storeReport !== prepared.report || !useEmployeeWorkStore.getState().isCurrentReport(prepared.report)) return <ReportNotice message={t("employeeWork.reportDayMismatch")} />;
  const disabled = !previewReady || previewError || storeLoading || Boolean(storeError) || preparingPdf;
  const readyPdf = pdf?.lease.isAvailable() ?? false;
  return <div className="mx-auto grid w-full max-w-6xl gap-4 pb-4 font-lao">
    <header className={cn("pos-decor-surface flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 sm:p-4", decorated ? "border-primary-foreground/20 text-primary-foreground" : "border-border bg-card text-card-foreground")}>
      <div className="min-w-0"><h1 className="flex items-center gap-2 text-base font-semibold"><FileText className="size-5 shrink-0" />{t("employeeWork.browserReportTitle")}</h1><p className={cn("mt-1 text-xs", decorated ? "text-primary-foreground/80" : "text-muted-foreground")}>{prepared.report.employee.display_name} · {prepared.report.employee.branch_name} · {destination.businessDate}</p></div>
      <Button asChild variant="outline" className="min-h-11"><Link href="/posAll/tables"><ArrowLeft />{t("employeeWork.backToTables")}</Link></Button>
    </header>
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
      <Button type="button" className="min-h-11" disabled={disabled} onClick={print}><Printer />{t("employeeWork.printPdf")}</Button>
      {!readyPdf ? <Button type="button" variant="outline" className="min-h-11" disabled={disabled} onClick={() => void preparePdf()}>{preparingPdf ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : <Download />}{t(preparingPdf ? "employeeWork.preparePdf" : "employeeWork.downloadPdf")}</Button> : null}
      {readyPdf && pdf ? <><Button asChild variant="outline" className="min-h-11"><a href={pdf.lease.url} target="_blank" rel="noopener" onClick={transfer}><ExternalLink />{t("employeeWork.openPdf")}</a></Button><Button asChild className="min-h-11"><a href={pdf.lease.url} download={pdf.file.name} onClick={transfer}><Download />{t("employeeWork.downloadPdf")}</a></Button><span role="status" className="text-xs text-muted-foreground">{t("employeeWork.pdfReady")}</span></> : null}
    </div>
    {previewError || pdfError || storeError ? <Alert variant="destructive"><AlertDescription>{pdfError ?? t("employeeWork.reportFailed")}</AlertDescription><Button type="button" variant="outline" className="min-h-11" onClick={retry}>{t("mySales.retry")}</Button></Alert> : null}
    {!previewReady && !previewError ? <p role="status" className="text-sm text-muted-foreground">{t("employeeWork.printPreparing")}</p> : null}
    <EmployeeWorkReportPreview key={prepared.html} html={prepared.html} title={label("reportTitle")} frameRef={frame} isCurrent={reportCurrent} onReady={() => { if (reportCurrent()) setPreviewReady(true); }} onError={() => { if (reportCurrent()) { setPreviewReady(false); setPreviewError(true); } }} />
  </div>;
}

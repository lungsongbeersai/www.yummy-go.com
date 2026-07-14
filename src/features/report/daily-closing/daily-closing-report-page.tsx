"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Printer,
  RefreshCcw,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { BlockingLoadingDialog } from "@/components/common/blocking-loading-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useIsCapacitorNativeApp } from "@/hooks/use-capacitor-native-app";
import { money } from "@/lib/format";
import { DailyClosingPaymentCards } from "./daily-closing-payment-cards";
import { DailyClosingReportControls } from "./daily-closing-report-controls";
import { DailyClosingReceiptPreview } from "./daily-closing-receipt-preview";
import { useDailyClosingReportWorkflow } from "./use-daily-closing-report-workflow";

export function DailyClosingReportPage() {
  const { t } = useTranslation();
  const nativeApp = useIsCapacitorNativeApp();
  const closing = useDailyClosingReportWorkflow();
  const showInitialLoading = Boolean(!closing.report && !closing.error && closing.branchUuid);

  const scrollRef = useRef<HTMLDivElement>(null);
  const printActionsRef = useRef<HTMLDivElement>(null);
  const [printActionsHidden, setPrintActionsHidden] = useState(false);

  // แสดงปุ่มพิมพ์ลอยเมื่อปุ่ม Print ในหัวข้อถูกเลื่อนพ้นพื้นที่แสดงผลของหน้า
  useEffect(() => {
    const target = printActionsRef.current;
    const root = scrollRef.current;
    if (!target || !root) return;

    const observer = new IntersectionObserver(
      ([entry]) => setPrintActionsHidden(!entry.isIntersecting),
      { root, threshold: 0 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const showFloatingPrint = printActionsHidden && Boolean(closing.report) && !nativeApp;

  return (
    <div
      ref={scrollRef}
      className="h-full min-h-0 min-w-0 overflow-x-hidden overflow-y-auto"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-3 sm:p-4 lg:p-6">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-bold text-primary">
              <ClipboardCheck aria-hidden="true" />
              {t("nav.report_menu")}
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
              {closing.reportTitle}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              {t("report.dailyClosing.description")}
            </p>
          </div>

          <div ref={printActionsRef} className="flex flex-wrap items-center gap-2">
            {closing.report ? (
              <Badge
                variant="outline"
                className={closing.balanced ? "gap-1.5 text-primary" : "gap-1.5 text-destructive"}
              >
                {closing.balanced ? (
                  <CheckCircle2 aria-hidden="true" />
                ) : (
                  <AlertCircle aria-hidden="true" />
                )}
                {closing.balanced
                  ? t("report.dailyClosing.balancedShort")
                  : t("report.dailyClosing.reviewRequired")}
              </Badge>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={!closing.branchUuid || closing.loading || closing.printing}
              onClick={() => void closing.load()}
            >
              <RefreshCcw
                data-icon="inline-start"
                className={closing.loading ? "animate-spin" : undefined}
                aria-hidden="true"
              />
              {t("actions.refresh")}
            </Button>
            <Button
              type="button"
              disabled={closing.printDisabled || nativeApp}
              onClick={() => void closing.printReport()}
            >
              {closing.printing ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Printer data-icon="inline-start" aria-hidden="true" />
              )}
              {t("report.dailyClosing.printClosingReport")}
            </Button>
          </div>
        </header>

        <DailyClosingReportControls
          branchLoading={closing.branchLoading}
          branchLocked={!closing.canSelectBranch}
          branchOptions={closing.branchOptions}
          canApply={closing.canApply}
          disabled={closing.loading || closing.printing}
          draftFilters={closing.draftFilters}
          onApply={closing.applyFilters}
          onDraftChange={closing.setDraftFilters}
        />

        {!closing.branchUuid ? (
          <ReportAlert
            title={t("report.dailyClosing.branchMissingTitle")}
            description={t("report.branchRequired")}
          />
        ) : null}
        {closing.branchError ? (
          <ReportAlert title={t("report.dailyClosing.branchLoadFailed")} description={closing.branchError} />
        ) : null}
        {closing.error ? (
          <ReportAlert title={t("report.dailyClosing.loadFailed")} description={closing.error} />
        ) : null}
        {closing.report && !closing.balanced ? (
          <ReportAlert
            title={t("report.dailyClosing.unbalanced")}
            description={t("report.dailyClosing.unbalancedDescription", {
              amount: money(closing.paymentDifference),
            })}
          />
        ) : null}

        {closing.report ? (
          <DailyClosingPaymentCards
            balanced={closing.balanced}
            paymentDifference={closing.paymentDifference}
            report={closing.report}
          />
        ) : null}

        {closing.loading || showInitialLoading ? (
          <LoadingState label={t("report.dailyClosing.loading")} variant="page" />
        ) : closing.previewData ? (
          <DailyClosingReceiptPreview data={closing.previewData} />
        ) : closing.error ? (
          <EmptyState
            title={t("report.dailyClosing.noReportTitle")}
            description={t("report.dailyClosing.noReportDescription")}
          />
        ) : null}
      </div>

      <BlockingLoadingDialog
        open={closing.printing}
        title={t("report.preparingPrint")}
        description={t("report.dailyClosing.refreshBeforePrint")}
      />

      {showFloatingPrint ? (
        <Button
          type="button"
          aria-label={t("report.dailyClosing.printClosingReport")}
          disabled={closing.printDisabled}
          onClick={() => void closing.printReport()}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full p-0 shadow-lg transition-transform duration-200 hover:scale-105"
        >
          {closing.printing ? (
            <Spinner aria-hidden="true" />
          ) : (
            <Printer aria-hidden="true" style={{ height: 22, width: 22 }} />
          )}
        </Button>
      ) : null}
    </div>
  );
}

function ReportAlert({ description, title }: { description: string; title: string }) {
  return (
    <Alert variant="destructive">
      <AlertCircle aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  );
}

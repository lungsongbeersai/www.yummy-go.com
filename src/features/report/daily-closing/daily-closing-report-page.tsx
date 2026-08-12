"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Printer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BlockingLoadingDialog } from "@/components/common/blocking-loading-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { DailyClosingPaymentCards } from "./daily-closing-payment-cards";
import { DailyClosingReportControls } from "./daily-closing-report-controls";
import { DailyClosingReceiptPreview } from "./daily-closing-receipt-preview";
import { useDailyClosingReportWorkflow } from "./use-daily-closing-report-workflow";

export function DailyClosingReportPage() {
  const { t } = useTranslation();
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

  const showFloatingPrint = printActionsHidden && Boolean(closing.report);

  return (
    <div
      ref={scrollRef}
      className="h-full min-h-0 min-w-0 overflow-x-hidden overflow-y-auto"
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-3 sm:p-4 lg:p-6">
        <h1 className="sr-only">{t("report.dailyClosing.title")}</h1>

        <DailyClosingReportControls
          actionsRef={printActionsRef}
          branchLoading={closing.branchLoading}
          branchLocked={!closing.canSelectBranch}
          branchOptions={closing.branchOptions}
          canApply={closing.canApply}
          disabled={closing.loading || closing.printing}
          draftFilters={closing.draftFilters}
          loading={closing.loading}
          printDisabled={closing.printDisabled}
          printing={closing.printing}
          refreshDisabled={!closing.branchUuid || closing.loading || closing.printing}
          onApply={closing.applyFilters}
          onDraftChange={closing.setDraftFilters}
          onPrint={() => void closing.printReport()}
          onRefresh={() => void closing.load()}
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

        {closing.report ? <DailyClosingPaymentCards report={closing.report} /> : null}

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

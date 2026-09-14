"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Printer, RefreshCcw, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BlockingLoadingDialog } from "@/components/common/blocking-loading-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { FilterHeaderToolbar } from "@/components/common/filter-header-toolbar";
import { LoadingState } from "@/components/common/loading-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { DailyClosingPaymentCards } from "./daily-closing-payment-cards";
import { DailyClosingFilterBar, DailyClosingFilterSheet } from "./daily-closing-report-controls";
import { DailyClosingReceiptPreview } from "./daily-closing-receipt-preview";
import { useDailyClosingReportWorkflow } from "./use-daily-closing-report-workflow";

export function DailyClosingReportPage() {
  const { t } = useTranslation();
  const closing = useDailyClosingReportWorkflow();
  const showInitialLoading = Boolean(!closing.report && !closing.error && closing.branchUuid);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const printActionsRef = useRef<HTMLDivElement>(null);
  const [printActionsHidden, setPrintActionsHidden] = useState(false);
  const controlsDisabled = closing.loading || closing.printing;
  const dateRangeLabel = closing.appliedFilters.dateFrom === closing.appliedFilters.dateTo
    ? closing.appliedFilters.dateFrom
    : `${closing.appliedFilters.dateFrom} - ${closing.appliedFilters.dateTo}`;

  // แสดงปุ่มพิมพ์ลอยเมื่อปุ่ม Print ในแถบตัวกรอง (จอ lg) ถูกเลื่อนพ้นพื้นที่แสดงผลของหน้า
  // จอเล็กที่แถบตัวกรองถูกซ่อนไว้ (ปุ่มไม่เคย intersect) ปุ่มลอยจึงโชว์ตลอดโดยธรรมชาติ
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

  const filterFieldProps = {
    branchLoading: closing.branchLoading,
    branchLocked: !closing.canSelectBranch,
    branchOptions: closing.branchOptions,
    disabled: controlsDisabled,
    draftFilters: closing.draftFilters,
    onDraftChange: closing.setDraftFilters,
  };

  return (
    <div
      ref={scrollRef}
      className="flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden overflow-y-auto"
    >
      <h1 className="sr-only">{t("report.dailyClosing.title")}</h1>

      <div className="shrink-0 border-b border-border bg-card px-2 py-2 sm:px-3 lg:hidden">
        <FilterHeaderToolbar
          dateRange={{
            ariaLabel: `${t("report.filters.openFilters")}: ${dateRangeLabel}`,
            disabled: controlsDisabled,
            label: dateRangeLabel,
            onClick: () => setMobileFilterOpen(true),
          }}
          filterControl={
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="h-9 w-9 shrink-0"
              aria-label={t("report.filters.openFilters")}
              disabled={controlsDisabled}
              onClick={() => setMobileFilterOpen(true)}
            >
              <SlidersHorizontal data-icon="inline-start" />
              <span className="sr-only">{t("report.filters.openFilters")}</span>
            </Button>
          }
          refreshControl={
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="h-9 w-9 shrink-0"
              aria-label={t("actions.refresh")}
              disabled={!closing.branchUuid || controlsDisabled}
              onClick={() => void closing.load()}
            >
              <RefreshCcw className={closing.loading ? "animate-spin" : undefined} data-icon="inline-start" />
              <span className="sr-only">{t("actions.refresh")}</span>
            </Button>
          }
        />
      </div>

      <DailyClosingFilterBar
        actionsRef={printActionsRef}
        canApply={closing.canApply}
        printDisabled={closing.printDisabled}
        printing={closing.printing}
        refreshDisabled={!closing.branchUuid || controlsDisabled}
        loading={closing.loading}
        onApply={closing.applyFilters}
        onPrint={() => void closing.printReport()}
        onRefresh={() => void closing.load()}
        {...filterFieldProps}
      />

      <DailyClosingFilterSheet
        canApply={closing.canApply}
        loading={closing.loading}
        open={mobileFilterOpen}
        onApply={() => { closing.applyFilters(); setMobileFilterOpen(false); }}
        onOpenChange={setMobileFilterOpen}
        {...filterFieldProps}
      />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-3 sm:p-4 lg:p-6">
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

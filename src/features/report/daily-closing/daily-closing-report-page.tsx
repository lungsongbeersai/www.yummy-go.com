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
import { ReportMobileFilterBar, ReportPage, ReportRefreshButton, ReportToolbar } from "../shared/report-layout";
import { DailyClosingPaymentCards } from "./daily-closing-payment-cards";
import { DailyClosingFilterBar, DailyClosingFilterSheet } from "./daily-closing-report-controls";
import { DailyClosingReceiptPreview } from "./daily-closing-receipt-preview";
import { useDailyClosingReportWorkflow } from "./use-daily-closing-report-workflow";

// โครงเดียวกับรายงานหน้าอื่น (shared/report-layout.tsx) แต่รายงานนี้ไม่มีตาราง — เนื้อหาคือ
// การ์ดสรุปรายรับ (แถวบน) + ตัวอย่างใบพิมพ์ปิดร้านวางกึ่งกลางด้านล่าง
export function DailyClosingReportPage() {
  const { t } = useTranslation();
  const closing = useDailyClosingReportWorkflow();
  const showInitialLoading = Boolean(!closing.report && !closing.error && closing.branchUuid);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const printButtonRef = useRef<HTMLButtonElement>(null);
  const [printButtonHidden, setPrintButtonHidden] = useState(false);
  const controlsDisabled = closing.loading || closing.printing;

  // ปุ่มพิมพ์ลอยโผล่เมื่อปุ่มพิมพ์ในแถบเครื่องมือเลื่อนพ้นพื้นที่สกรอลของหน้า
  // root ต้องเป็น element ที่สกรอลเอง — ถ้าใช้ viewport ปุ่มที่เลื่อนไปอยู่ใต้ header ของ app shell
  // (ซึ่งยังอยู่ในจอ) จะถูกนับว่ายังมองเห็นอยู่
  useEffect(() => {
    const target = printButtonRef.current;
    const root = scrollRef.current;
    if (!target || !root) return;

    const observer = new IntersectionObserver(([entry]) => setPrintButtonHidden(!entry.isIntersecting), {
      root,
      threshold: 0,
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const filterFieldProps = {
    branchLoading: closing.branchLoading,
    branchLocked: !closing.canSelectBranch,
    branchOptions: closing.branchOptions,
    disabled: controlsDisabled,
    draftFilters: closing.draftFilters,
    locationOptions: closing.locationOptions,
    onDraftChange: closing.setDraftFilters,
  };
  const refreshButton = (
    <ReportRefreshButton
      disabled={!closing.branchUuid || controlsDisabled}
      loading={closing.loading}
      onRefresh={() => void closing.load()}
    />
  );
  const printIcon = closing.printing ? <Spinner data-icon="inline-start" /> : <Printer data-icon="inline-start" />;

  return (
    <>
      <ReportPage pageScroll scrollRef={scrollRef} title={t("report.dailyClosing.title")}>
        <ReportMobileFilterBar
          dateFrom={closing.appliedFilters.dateFrom}
          dateTo={closing.appliedFilters.dateTo}
          disabled={controlsDisabled}
          refreshButton={refreshButton}
          onOpenFilters={() => setMobileFilterOpen(true)}
        />
        <DailyClosingFilterBar
          actions={refreshButton}
          canApply={closing.canApply}
          loading={closing.loading}
          onApply={closing.applyFilters}
          {...filterFieldProps}
        />
        <DailyClosingFilterSheet
          canApply={closing.canApply}
          loading={closing.loading}
          open={mobileFilterOpen}
          onApply={() => {
            closing.applyFilters();
            setMobileFilterOpen(false);
          }}
          onOpenChange={setMobileFilterOpen}
          {...filterFieldProps}
        />

        {!closing.branchUuid ? (
          <ReportAlert title={t("report.dailyClosing.branchMissingTitle")} description={t("report.branchRequired")} />
        ) : null}
        {closing.branchError ? (
          <ReportAlert title={t("report.dailyClosing.branchLoadFailed")} description={closing.branchError} />
        ) : null}
        {closing.error ? <ReportAlert title={t("report.dailyClosing.loadFailed")} description={closing.error} /> : null}

        <ReportToolbar
          title={t("report.dailyClosing.salesSummary")}
          actions={
            <Button
              ref={printButtonRef}
              type="button"
              disabled={closing.printDisabled}
              onClick={() => void closing.printReport()}
            >
              {printIcon}
              {t("report.dailyClosing.printClosingReport")}
            </Button>
          }
        />

        {closing.loading || showInitialLoading ? (
          <LoadingState label={t("report.dailyClosing.loading")} variant="page" />
        ) : closing.report ? (
          <>
            {/* 6 ใบ: จอ lg 3 คอลัมน์ (2 แถว), จอ xl เรียงแถวเดียว */}
            <DailyClosingPaymentCards className="lg:grid-cols-3 xl:grid-cols-6" report={closing.report} />
            {/* พื้นหลังของกรอบตัวอย่างเต็มความกว้าง ใบพิมพ์ (320px) จัดกึ่งกลางด้วย .daily-closing-receipt-preview */}
            {closing.previewData ? <DailyClosingReceiptPreview data={closing.previewData} /> : null}
          </>
        ) : closing.error ? (
          <EmptyState
            title={t("report.dailyClosing.noReportTitle")}
            description={t("report.dailyClosing.noReportDescription")}
          />
        ) : null}
      </ReportPage>

      <BlockingLoadingDialog
        open={closing.printing}
        title={t("report.preparingPrint")}
        description={t("report.dailyClosing.refreshBeforePrint")}
      />

      {/* ปุ่มพิมพ์ลอย 56px (เป้ากดนิ้วบนแท็บเล็ต — ขนาดปุ่มมาตรฐานเล็กเกินไป)
          ยกขึ้นเท่าความสูง bottom nav ของ Android ที่ fixed ทับอยู่ (เว็บ = 0) */}
      {printButtonHidden && closing.report ? (
        <Button
          type="button"
          size="icon-lg"
          aria-label={t("report.dailyClosing.printClosingReport")}
          disabled={closing.printDisabled}
          onClick={() => void closing.printReport()}
          className="fixed right-6 bottom-[calc(1.5rem+var(--app-shell-bottom-nav-height,0px))] z-50 size-14 rounded-full shadow-lg"
        >
          {closing.printing ? <Spinner /> : <Printer className="size-5" />}
        </Button>
      ) : null}
    </>
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

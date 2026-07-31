"use client";

import type { ReactNode } from "react";
import { Eye, EyeOff, RefreshCcw, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BlockingLoadingDialog } from "@/components/common/blocking-loading-dialog";
import { FilterHeaderToolbar } from "@/components/common/filter-header-toolbar";
import { Button } from "@/components/ui/button";
import { ReportError } from "./report-error";

export interface ReportPageShellProps {
  accessibleTitle: string;
  dateFrom: string;
  dateTo: string;
  // ข้อความ error ที่จะแสดงเรียงกัน (branchRequired/branchError/error ของแต่ละรายงาน) — ค่า falsy ถูกข้าม
  errors: Array<string | null | undefined>;
  exporting: boolean;
  exportingTitle: string;
  exportSurface?: ReactNode;
  // แถบ badge เฉพาะรายงาน วางถัดจากปุ่มช่วงวันที่ (payment-methods เท่านั้นที่ใช้)
  extraChips?: ReactNode;
  filterSheet: ReactNode;
  // แถบตัวกรองแบบอยู่บนหน้าเลย (จอ lg ขึ้นไป) — ตัวมันเองรับผิดชอบซ่อนตัวเองบนจอเล็ก
  // โครงเดียวกับ /settings/store: จอเล็กใช้ sheet, จอใหญ่กรองได้จากหน้าโดยไม่ต้องเปิดอะไร
  // รับเป็นฟังก์ชันเพื่อให้ shell ส่งปุ่มรีเฟรช/สลับการ์ดสรุปชุดเดียวกันลงไปวางท้ายแถบได้
  // (บน lg แถบเครื่องมือด้านบนถูกซ่อน ปุ่มสองตัวนี้จึงต้องมีที่อยู่ใหม่)
  inlineFilters?: (actions: ReactNode) => ReactNode;
  loading: boolean;
  summary: ReactNode;
  summaryCardsId: string;
  summaryVisible: boolean;
  table: ReactNode;
  variant: "compact" | "spacious";
  onOpenFilters: () => void;
  onRefresh: () => void;
  onToggleSummary: () => void;
}

// โครงหน้ารายงานมาตรฐานเริ่มจาก toolbar แล้วตามด้วย filter, errors, summary, table และ export state
export function ReportPageShell({
  accessibleTitle,
  dateFrom,
  dateTo,
  errors,
  exporting,
  exportingTitle,
  exportSurface,
  extraChips,
  filterSheet,
  inlineFilters,
  loading,
  summary,
  summaryCardsId,
  summaryVisible,
  table,
  variant,
  onOpenFilters,
  onRefresh,
  onToggleSummary,
}: ReportPageShellProps) {
  const { t } = useTranslation();
  const dateRangeLabel = `${dateFrom} - ${dateTo}`;
  const controlsDisabled = loading || exporting;

  const filterControl = (
    <Button
      type="button"
      variant="outline"
      size="iconSm"
      className="h-9 w-9 shrink-0"
      aria-label={t("report.filters.openFilters")}
      disabled={controlsDisabled}
      onClick={onOpenFilters}
    >
      <SlidersHorizontal data-icon="inline-start" />
      <span className="sr-only">{t("report.filters.openFilters")}</span>
    </Button>
  );

  const refreshControl = (
    <Button
      type="button"
      variant="outline"
      size="iconSm"
      className="h-9 w-9 shrink-0"
      aria-label={t("actions.refresh")}
      disabled={controlsDisabled}
      onClick={onRefresh}
    >
      <RefreshCcw className={loading ? "animate-spin" : undefined} data-icon="inline-start" />
      <span className="sr-only">{t("actions.refresh")}</span>
    </Button>
  );

  const summaryControl = (
    <Button
      type="button"
      variant="outline"
      size="iconSm"
      className="h-9 w-9 shrink-0"
      aria-controls={summaryCardsId}
      aria-expanded={summaryVisible}
      aria-label={summaryVisible ? t("report.hideSummary") : t("report.showSummary")}
      onClick={onToggleSummary}
    >
      {summaryVisible ? <EyeOff data-icon="inline-start" /> : <Eye data-icon="inline-start" />}
      <span className="sr-only">{summaryVisible ? t("report.hideSummary") : t("report.showSummary")}</span>
    </Button>
  );

  const errorBanners = errors
    .filter((message): message is string => Boolean(message))
    .map((message, index) => <ReportError key={index} message={message} />);

  return (
    <>
      {/* เต็มหน้าจอแบบ /settings/store: ไม่มี padding รอบนอก แถบตัวกรองกับตารางชนขอบ
          และตารางกินความสูงที่เหลือทั้งหมด แทนที่จะลอยอยู่ในกรอบที่มีขอบรอบด้าน
          variant "spacious" ยังเลื่อนทั้งหน้าได้ เพราะตารางของมันสูงกว่าจอ */}
      <div
        className={
          variant === "compact"
            ? "flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
            : "flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden overflow-y-auto"
        }
      >
        <h1 className="sr-only">{accessibleTitle}</h1>

        <div
          className={
            inlineFilters
              ? "shrink-0 border-b border-border bg-card px-2 py-2 sm:px-3 lg:hidden"
              : "shrink-0 border-b border-border bg-card px-2 py-2 sm:px-3"
          }
        >
          <FilterHeaderToolbar
            dateRange={{
              ariaLabel: `${t("report.filters.openFilters")}: ${dateRangeLabel}`,
              disabled: controlsDisabled,
              label: dateRangeLabel,
              onClick: onOpenFilters,
            }}
            extraChips={extraChips}
            filterControl={filterControl}
            refreshControl={refreshControl}
            summaryControl={summaryControl}
          />
        </div>

        {inlineFilters?.(
          <>
            {summaryControl}
            {refreshControl}
          </>,
        )}

        {filterSheet}

        {/* ส่วนที่ไม่ใช่ตารางต้องมีระยะในของตัวเอง เพราะพ่อแม่ไม่มี padding แล้ว */}
        {errorBanners.length ? (
          <div className="flex shrink-0 flex-col gap-2 px-2 py-2 sm:px-3">{errorBanners}</div>
        ) : null}

        <div id={summaryCardsId} className="shrink-0 px-2 py-2 sm:px-3" hidden={!summaryVisible}>
          {summary}
        </div>

        {table}
      </div>
      {exportSurface}
      <BlockingLoadingDialog
        open={exporting}
        title={exportingTitle}
        description={t("report.exportingDescription")}
      />
    </>
  );
}

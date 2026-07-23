"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Eye, EyeOff, RefreshCcw, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BlockingLoadingDialog } from "@/components/common/blocking-loading-dialog";
import { FilterHeaderToolbar } from "@/components/common/filter-header-toolbar";
import { Button } from "@/components/ui/button";
import { ReportError } from "./report-error";

export interface ReportPageShellProps {
  dateFrom: string;
  dateTo: string;
  description: string;
  // ข้อความ error ที่จะแสดงเรียงกัน (branchRequired/branchError/error ของแต่ละรายงาน) — ค่า falsy ถูกข้าม
  errors: Array<string | null | undefined>;
  exporting: boolean;
  exportingTitle: string;
  exportSurface?: ReactNode;
  // แถบ badge เฉพาะรายงาน วางถัดจากปุ่มช่วงวันที่ (payment-methods เท่านั้นที่ใช้)
  extraChips?: ReactNode;
  filterSheet: ReactNode;
  icon: LucideIcon;
  loading: boolean;
  summary: ReactNode;
  summaryCardsId: string;
  summaryVisible: boolean;
  table: ReactNode;
  title: string;
  variant: "compact" | "spacious";
  onOpenFilters: () => void;
  onRefresh: () => void;
  onToggleSummary: () => void;
}

// โครงหน้ารายงานมาตรฐาน: header (ไอคอน+ชื่อ+คำอธิบาย) + toolbar (ช่วงวันที่/filter/refresh/summary
// toggle) + filter sheet + error banners + summary cards (ซ่อน/โชว์ได้) + การ์ดตาราง + export surface +
// dialog บล็อกระหว่าง export — เดิมก๊อปวางไว้ทั้งไฟล์ page.tsx ของทุกรายงาน ต่างกันแค่ไอคอน/ข้อความ/
// องค์ประกอบเฉพาะที่ส่งมาเป็น children
export function ReportPageShell({
  dateFrom,
  dateTo,
  description,
  errors,
  exporting,
  exportingTitle,
  exportSurface,
  extraChips,
  filterSheet,
  icon: Icon,
  loading,
  summary,
  summaryCardsId,
  summaryVisible,
  table,
  title,
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
      <div
        className={
          variant === "compact"
            ? "h-full min-h-0 min-w-0 overflow-x-hidden overflow-y-auto lg:overflow-hidden"
            : "h-full min-h-0 min-w-0 overflow-x-hidden overflow-y-auto"
        }
      >
        <div
          className={
            variant === "compact"
              ? "flex min-h-full w-full min-w-0 flex-col gap-2 p-2 sm:p-3 lg:h-full lg:min-h-0"
              : "mx-auto flex w-full max-w-full flex-col gap-3 p-3 sm:p-4 lg:p-4 2xl:max-w-375"
          }
        >
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            {variant === "compact" ? (
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-bold text-primary">
                  <Icon className="size-4" />
                  {t("nav.report_menu")}
                </div>
                <h1 className="truncate text-xl font-black tracking-normal text-foreground sm:text-2xl">
                  {title}
                </h1>
                <p className="text-xs text-muted-foreground sm:text-sm">{description}</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-primary">
                  <Icon className="size-4" />
                  {t("nav.report_menu")}
                </div>
                <h1 className="text-2xl font-black tracking-normal text-foreground">{title}</h1>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            )}
          </div>

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

          {filterSheet}

          {errorBanners}

          <div id={summaryCardsId} hidden={!summaryVisible}>
            {summary}
          </div>

          {table}
        </div>
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

"use client";

import type { ReactNode, Ref } from "react";
import {
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  Printer,
  RefreshCcw,
  SlidersHorizontal,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { FilterHeaderToolbar } from "@/components/common/filter-header-toolbar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { formatReportDateRange } from "@/features/report/shared/report-date-format";

// ชิ้นส่วนโครงหน้ารายงานแบบใหม่ (daily-sales / best-selling / payment-methods):
// ตัวกรอง → แถบเครื่องมือ → การ์ดสรุป → ตารางในกรอบ → แบ่งหน้า
// ใช้ component ของ shadcn ตามค่าเริ่มต้น ไม่ใส่ขนาด/ระยะเอง — ต่างจาก ReportPageShell เดิม
// (ที่ยังมีรายงานหน้าอื่นใช้อยู่) ซึ่งเป็นแถบชนขอบจอและปรับความสูงปุ่มเอง

/**
 * กรอบนอกของหน้า — จอ lg ขึ้นไปตารางสกรอลในกรอบของมันเอง, จอเล็กทั้งหน้าสกรอลไปด้วยกัน
 * pageScroll: สกรอลทั้งหน้าทุกขนาดจอ — สำหรับรายงานที่ตารางสั้นแต่มีการ์ดเยอะ (payment-methods)
 * ถ้าล็อกความสูงไว้ การ์ดจะกินพื้นที่จนตารางเหลือไม่กี่พิกเซล
 */
export function ReportPage({
  children,
  pageScroll = false,
  scrollRef,
  title,
}: {
  children: ReactNode;
  pageScroll?: boolean;
  /** element ที่สกรอล — ใช้เป็น root ของ IntersectionObserver (เช่นปุ่มพิมพ์ลอยของ daily-closing) */
  scrollRef?: Ref<HTMLDivElement>;
  title: string;
}) {
  return (
    <div
      ref={scrollRef}
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-col gap-4 overflow-y-auto p-4",
        !pageScroll && "lg:overflow-hidden",
      )}
    >
      <h1 className="sr-only">{title}</h1>
      {children}
    </div>
  );
}

export function ReportRefreshButton({
  disabled,
  loading,
  onRefresh,
}: {
  disabled: boolean;
  loading: boolean;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={t("actions.refresh")}
      title={t("actions.refresh")}
      disabled={disabled}
      onClick={onRefresh}
    >
      <RefreshCcw className={loading ? "animate-spin" : undefined} />
    </Button>
  );
}

/** จอเล็ก: ปุ่มช่วงวันที่เปิด modal ตัวกรอง + ปุ่มตัวกรอง/รีเฟรช (จอ lg ใช้แถบตัวกรองบนหน้าแทน) */
export function ReportMobileFilterBar({
  dateFrom,
  dateTo,
  disabled,
  extraChips,
  refreshButton,
  onOpenFilters,
}: {
  dateFrom: string;
  dateTo: string;
  disabled: boolean;
  extraChips?: ReactNode;
  refreshButton: ReactNode;
  onOpenFilters: () => void;
}) {
  const { t } = useTranslation();
  const label = `${formatReportDateRange(dateFrom, dateTo)}`;

  return (
    <div className="lg:hidden">
      <FilterHeaderToolbar
        dateRange={{
          ariaLabel: `${t("report.filters.openFilters")}: ${label}`,
          disabled,
          label,
          onClick: onOpenFilters,
        }}
        extraChips={extraChips}
        filterControl={
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("report.filters.openFilters")}
            disabled={disabled}
            onClick={onOpenFilters}
          >
            <SlidersHorizontal />
          </Button>
        }
        refreshControl={refreshButton}
      />
    </div>
  );
}

export function ReportSummaryToggle({
  controlsId,
  visible,
  onToggle,
}: {
  controlsId: string;
  visible: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const label = visible ? t("report.hideSummary") : t("report.showSummary");

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      title={label}
      aria-controls={controlsId}
      aria-expanded={visible}
      aria-label={label}
      onClick={onToggle}
    >
      {visible ? <EyeOff /> : <Eye />}
    </Button>
  );
}

export function ReportExportMenu({
  disabled,
  exporting,
  onExportExcel,
  onExportPdf,
  onPrint,
}: {
  disabled: boolean;
  exporting: boolean;
  onExportExcel: () => void;
  onExportPdf: () => void;
  onPrint?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" aria-label={t("common.export")} disabled={disabled}>
          {exporting ? <Spinner data-icon="inline-start" /> : <Download data-icon="inline-start" />}
          <span className="hidden sm:inline">{t("common.export")}</span>
          <ChevronDown data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem disabled={disabled} onSelect={onExportExcel}>
            <FileSpreadsheet />
            {t("report.exportExcel")}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={disabled} onSelect={onExportPdf}>
            <FileText />
            {t("report.exportPdf")}
          </DropdownMenuItem>
          {onPrint ? (
            <DropdownMenuItem disabled={disabled} onSelect={onPrint}>
              <Printer />
              {t("report.print")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** แถบเครื่องมือเหนือตาราง: หัวข้อ + จำนวนที่เลือก (ซ้าย) / ปุ่มสั่งงาน (ขวา) */
export function ReportToolbar({
  actions,
  selectedLabel,
  title,
  onClearSelection,
}: {
  actions: ReactNode;
  /** มีค่าเฉพาะตอนมีรายการถูกเลือก — ผลของการเลือกคือ export/พิมพ์เฉพาะรายการนั้น */
  selectedLabel?: string | null;
  title: ReactNode;
  onClearSelection?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {typeof title === "string" ? <h2 className="font-medium">{title}</h2> : title}
      {selectedLabel ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{selectedLabel}</span>
          {onClearSelection ? (
            <Button type="button" variant="ghost" onClick={onClearSelection}>
              {t("report.clearSelection")}
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="ml-auto flex items-center gap-2">{actions}</div>
    </div>
  );
}

/**
 * พื้นที่ผลลัพธ์ที่กินความสูงที่เหลือ — ใช้ครอบทั้ง skeleton และกรอบตาราง
 * skeleton ของรายงานเป็น h-full: ถ้าไม่ครอบให้ได้แค่ความสูงที่เหลือ มันจะขอเต็มหน้าแล้วไปบีบ
 * การ์ดตัวกรองด้านบน (Card มี overflow-hidden → min-height ของ flex item เป็น 0 ถูกบีบได้)
 * จอเล็กทั้งหน้าสกรอล จึงต้องมีความสูงขั้นต่ำ ไม่งั้น flex-1 หดจนเหลือศูนย์
 */
export function ReportResultArea({
  busy,
  children,
  className,
  fill = true,
  framed = false,
}: {
  busy?: boolean;
  children: ReactNode;
  className?: string;
  /** false = สูงเท่าเนื้อหา (ใช้คู่กับ ReportPage pageScroll) แทนการกินความสูงที่เหลือ */
  fill?: boolean;
  /** กรอบแบบ shadcn Data Table (rounded-lg border) รอบตาราง */
  framed?: boolean;
}) {
  return (
    <div
      aria-busy={busy}
      className={cn(
        "flex flex-col overflow-hidden",
        fill ? "min-h-96 flex-1 lg:min-h-0" : "shrink-0",
        framed && "rounded-lg border",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** แถบแบ่งหน้าใต้ตาราง — เว้นที่ให้ bottom nav/แถบระบบของ Android ที่ fixed ทับอยู่ */
export function ReportPaginationBar({ children }: { children: ReactNode }) {
  return (
    <div className="shrink-0 pb-[max(var(--pos-system-bottom-safe-area,0px),var(--app-shell-bottom-nav-height,0px))]">
      {children}
    </div>
  );
}

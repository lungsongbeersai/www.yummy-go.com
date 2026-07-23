"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ChevronDown, Download, FileSpreadsheet, RefreshCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ReportTableCardProps {
  // Card/CardContent อยู่ต่างเลย์เอาต์กันจริงๆ ระหว่าง 3 รายงาน (บางหน้า sticky, บางหน้า flex เต็มจอ)
  // จึงรับ className ตรงจากแต่ละรายงานแทนที่จะเดางแบบเดียวให้ทุกหน้า
  cardClassName: string;
  children: ReactNode;
  contentClassName: string;
  contentWrapperClassName: string;
  emptyDescription: string;
  emptyTitle: string;
  exportDisabled: boolean;
  exporting: string | null;
  footer: ReactNode;
  // ปุ่ม/ตัวควบคุมเฉพาะรายงาน วางก่อนปุ่ม export เช่น dropdown เรียงลำดับของ best-selling
  headerExtras?: ReactNode;
  headerVariant: "compact" | "spacious";
  icon: LucideIcon;
  loading: boolean;
  renderLoading: () => ReactNode;
  rowsLength: number;
  selectedCount: number;
  // payment-methods เท่านั้นที่โชว์ badge "กำลังโหลด" เมื่อ refresh ทับแถวเดิม
  showLoadingBadge?: boolean;
  // category-sales รีเฟรชแล้วเปลี่ยนเป็น skeleton เต็มตารางทุกครั้ง ส่วนอีก 2 รายงานโชว์แถวเดิมค้างไว้จน
  // โหลดเสร็จ (skeleton เฉพาะตอนยังไม่มีแถวเลย)
  skeletonMode?: "always" | "whenEmpty";
  subtitle?: ReactNode;
  title: string;
  onClearSelection: () => void;
  onExportExcel: () => void;
  onExportPdf: () => void;
  onRefresh: () => void;
}

// การ์ดตารางมาตรฐานของหน้ารายงาน: header (ไอคอน+ชื่อ+badge เลือกแถว+dropdown export+ปุ่ม refresh)
// และสถานะ loading/ว่าง/มีข้อมูล ที่ทั้ง 3 รายงานเกือบเหมือนกันทุกเส้น (เดิมก๊อปวางไว้ทั้งไฟล์)
export function ReportTableCard({
  cardClassName,
  children,
  contentClassName,
  contentWrapperClassName,
  emptyDescription,
  emptyTitle,
  exportDisabled,
  exporting,
  footer,
  headerExtras,
  headerVariant,
  icon: Icon,
  loading,
  renderLoading,
  rowsLength,
  selectedCount,
  showLoadingBadge = false,
  skeletonMode = "whenEmpty",
  subtitle,
  title,
  onClearSelection,
  onExportExcel,
  onExportPdf,
  onRefresh,
}: ReportTableCardProps) {
  const { t } = useTranslation();
  const showSkeleton = skeletonMode === "always" ? loading : loading && !rowsLength;

  const exportMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {headerVariant === "compact" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={t("common.export")}
            className="h-9 min-w-9 rounded-md px-2.5"
            disabled={exportDisabled}
          >
            {exporting === "excel" || exporting === "pdf" ? (
              <RefreshCcw className="animate-spin" data-icon="inline-start" />
            ) : (
              <Download data-icon="inline-start" />
            )}
            <span className="hidden sm:inline">{t("common.export")}</span>
            <ChevronDown data-icon="inline-end" />
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" className="h-9" disabled={exportDisabled}>
            {exporting === "excel" || exporting === "pdf" ? (
              <RefreshCcw className="animate-spin" data-icon="inline-start" />
            ) : (
              <Download data-icon="inline-start" />
            )}
            {t("common.export")}
            <ChevronDown data-icon="inline-end" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuItem disabled={exportDisabled} onSelect={onExportExcel}>
            <FileSpreadsheet data-icon="inline-start" />
            {t("report.exportExcel")}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={exportDisabled} onSelect={onExportPdf}>
            <Download data-icon="inline-start" />
            {t("report.exportPdf")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const refreshButton =
    headerVariant === "compact" ? (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={t("actions.refresh")}
        className="h-9 min-w-9 rounded-md border border-border/60 px-2.5 text-muted-foreground hover:text-foreground"
        disabled={loading || Boolean(exporting)}
        onClick={onRefresh}
      >
        <RefreshCcw className={loading ? "animate-spin" : undefined} data-icon="inline-start" />
      </Button>
    ) : (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9"
        disabled={loading || Boolean(exporting)}
        onClick={onRefresh}
      >
        <RefreshCcw className={loading ? "animate-spin" : undefined} data-icon="inline-start" />
        {t("actions.refresh")}
      </Button>
    );

  const selectionBadge =
    selectedCount > 0 ? (
      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
        <Badge className="h-6 max-w-full truncate border-primary/20 bg-primary/10 px-2 text-xs text-primary">
          {t("report.selectedForExport", { count: selectedCount })}
        </Badge>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="h-6 px-2 text-xs text-muted-foreground"
          onClick={onClearSelection}
        >
          {t("report.clearSelection")}
        </Button>
      </div>
    ) : null;

  const body = showSkeleton ? (
    <div className="p-4 md:min-h-80">{renderLoading()}</div>
  ) : rowsLength ? (
    <>
      <div className={contentWrapperClassName}>{children}</div>
      <div className="shrink-0 bg-card">{footer}</div>
    </>
  ) : (
    <div className="p-4 md:min-h-80">
      <EmptyState title={emptyTitle} description={emptyDescription} />
    </div>
  );

  return (
    <Card className={cardClassName}>
      {headerVariant === "compact" ? (
        <CardHeader className="shrink-0 border-b border-border bg-card/95 px-2 py-2 sm:px-3">
          <div className="grid w-full min-w-0 grid-cols-1 items-center gap-2 2xl:grid-cols-[minmax(180px,16rem)_minmax(0,1fr)_auto]">
            <div className="flex min-w-0 items-center gap-2">
              <div className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                <Icon aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="truncate text-sm font-black">{title}</CardTitle>
                {subtitle}
                {selectionBadge}
              </div>
              {showLoadingBadge && loading && rowsLength ? (
                <Badge className="h-7 w-fit border-border bg-muted px-2 text-xs text-muted-foreground">
                  <RefreshCcw className="animate-spin" data-icon="inline-start" />
                  {t("common.loading")}
                </Badge>
              ) : null}
            </div>

            <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 2xl:col-start-3 2xl:flex-nowrap">
              {headerExtras}
              {exportMenu}
              {refreshButton}
            </div>
          </div>
        </CardHeader>
      ) : (
        <CardHeader className="flex shrink-0 flex-col gap-3 border-b border-border bg-card px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex min-w-0 items-center gap-2 text-base font-black">
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{title}</span>
            </CardTitle>
            {subtitle}
            {selectionBadge}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
            {headerExtras}
            {exportMenu}
            {refreshButton}
          </div>
        </CardHeader>
      )}

      <CardContent aria-busy={loading} className={contentClassName}>
        {body}
      </CardContent>
    </Card>
  );
}

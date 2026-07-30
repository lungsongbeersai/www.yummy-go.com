"use client";

import type { ReactNode } from "react";
import { BlockingLoadingDialog } from "@/components/common/blocking-loading-dialog";
import { ChevronDown, ChevronRight, Download, FileSpreadsheet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  ReportExportAction,
  ReportExportProgress,
  ReportTab,
  SummaryCardConfig,
  SummaryCards,
} from "./daily-sales-report-types";
import { firstNumber, summaryCardValue } from "./daily-sales-report-utils";

interface DailySalesSummaryCardsProps {
  cards: SummaryCardConfig[];
  reportTotal: Record<string, unknown>;
  summaryCards: SummaryCards;
}

interface ReportExportLoadingDialogProps {
  exporting: ReportExportAction | null;
  progress: ReportExportProgress | null;
}

interface DailySalesTableCardProps {
  actions: ReportTableActionsProps;
  children: ReactNode;
  footer: ReactNode;
  loading: boolean;
  rowsLength: number;
}

interface ReportTableActionsProps {
  allDetailGroupsExpanded: boolean;
  billGroupsLength: number;
  exportDisabled: boolean;
  exporting: ReportExportAction | null;
  loading: boolean;
  selectedBillCount: number;
  selectedCount: number;
  typePage: ReportTab;
  onClearSelection: () => void;
  onCollapseAllBills: () => void;
  onExpandAllBills: () => void;
  onExportExcel: () => void;
  onExportPdf: () => void;
  onTypePageChange: (typePage: ReportTab) => void;
}

interface ReportTypeSwitchProps {
  disabled: boolean;
  value: ReportTab;
  onChange: (typePage: ReportTab) => void;
}

export function DailySalesSummaryCards({
  cards,
  reportTotal,
  summaryCards,
}: DailySalesSummaryCardsProps) {
  return (
    <section className="grid shrink-0 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      {cards.map((card) => {
        const value = summaryCardValue(summaryCards, reportTotal, card.keys);
        const tone = summaryCardTone(card);

        return (
          // ป้ายกำกับเงียบเหมือนกันทุกใบ แล้วให้ "ตัวเลข" เป็นตัวบอกโทน — เดิมทั้ง 6 ใบ
          // มีทั้งแถบสีซ้าย ป้ายสี และตัวเลขหนา 900 พร้อมกัน จนไม่มีใบไหนเด่นกว่ากัน
          // (uppercase ไม่มีผลกับอักษรลาวอยู่แล้ว)
          <Card key={card.label} className="overflow-hidden border-border bg-card shadow-none">
            <CardContent className="p-3">
              <p className="truncate text-xs leading-5 text-muted-foreground">{card.label}</p>
              <p
                className={cn(
                  "mt-0.5 truncate text-lg leading-7 font-semibold tabular-nums",
                  tone === "danger" ? "text-destructive" : "text-foreground",
                )}
              >
                {card.kind === "money"
                  ? money(firstNumber(value))
                  : firstNumber(value).toLocaleString("en-US")}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}

function summaryCardTone(card: SummaryCardConfig) {
  if (
    card.keys.some((key) =>
      ["debt", "discount", "cancel"].some((token) => key.includes(token)),
    )
  ) {
    return "danger";
  }

  if (card.kind === "money") return "primary";
  return "neutral";
}

export function ReportExportLoadingDialog({
  exporting,
  progress,
}: ReportExportLoadingDialogProps) {
  const { t } = useTranslation();
  const actionLabel =
    exporting === "excel"
      ? t("report.exportingExcel")
      : exporting === "pdf"
      ? t("report.exportingPdf")
      : t("report.preparingPrint");
  const percent = progress?.percent ?? 0;
  const progressLabel = progress?.label ?? t("report.exportingDescription");

  return (
    <BlockingLoadingDialog
      open={Boolean(exporting)}
      title={actionLabel}
      description={t("report.exportingDescription")}
      progressLabel={progressLabel}
      progressValue={percent}
    />
  );
}

export function DailySalesTableCard({
  actions,
  children,
  footer,
  loading,
  rowsLength,
}: DailySalesTableCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-none border-x-0 border-b-0 border-border bg-card shadow-none">
      <ReportTableActions {...actions} />

      <CardContent
        aria-busy={loading}
        className="flex min-h-0 flex-1 flex-col p-0"
      >
        {loading && !rowsLength ? (
          <div className="min-h-80 p-4">
            <LoadingState label={t("report.loading")} variant="reportTable" />
          </div>
        ) : rowsLength ? (
          <>
            <div className="min-h-0 flex-1 scroll-pb-10 overflow-auto">{children}</div>
            {/* ระยะในและเส้นคั่นเดียวกับ footer ของหน้าอื่นที่ใช้ AppPagination — เดิมไม่มีทั้งคู่ */}
            <div className="shrink-0 border-t border-border bg-card px-4 py-3 text-sm text-muted-foreground">
              {footer}
            </div>
          </>
        ) : (
          <div className="min-h-80 p-4">
            <EmptyState
              title={t("report.noData")}
              description={t("report.adjustFilters")}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReportTableActions({
  allDetailGroupsExpanded,
  billGroupsLength,
  exportDisabled,
  exporting,
  loading,
  selectedBillCount,
  selectedCount,
  typePage,
  onClearSelection,
  onCollapseAllBills,
  onExpandAllBills,
  onExportExcel,
  onExportPdf,
  onTypePageChange,
}: ReportTableActionsProps) {
  const { t } = useTranslation();
  const isDetail = typePage === "detail";
  const selectedDisplayCount = isDetail ? selectedBillCount : selectedCount;
  const disabled = loading || Boolean(exporting);

  return (
    <CardHeader className="shrink-0 border-b border-border bg-card px-2 py-2 sm:px-3">
      <div className="flex w-full min-w-0 flex-col gap-2">
        {/* โครงคงที่ 2 แถบ: ซ้าย = สลับมุมมอง + ค้นหา / ขวา = ปุ่มสั่งงาน
            เดิม grid สลับโครง 3 แบบตาม breakpoint ทำให้ปุ่ม export กระโดดข้ามแถวไปมา */}
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <ReportTypeSwitch
              disabled={disabled}
              value={typePage}
              onChange={onTypePageChange}
            />
          </div>

          <div className="flex min-w-0 shrink-0 items-center gap-1.5">
            {isDetail && billGroupsLength ? (
              // เดิมเป็นไอคอนเปล่าไม่มีข้อความและไม่มี tooltip — เดาไม่ออกว่าปุ่มทำอะไร
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 min-w-9 rounded-md px-2.5"
                disabled={disabled}
                title={allDetailGroupsExpanded ? t("actions.collapseAll") : t("actions.expandAll")}
                onClick={
                  allDetailGroupsExpanded
                    ? onCollapseAllBills
                    : onExpandAllBills
                }
              >
                {allDetailGroupsExpanded ? (
                  <ChevronDown data-icon="inline-start" />
                ) : (
                  <ChevronRight data-icon="inline-start" />
                )}
                <span className="hidden sm:inline">
                  {allDetailGroupsExpanded ? t("actions.collapseAll") : t("actions.expandAll")}
                </span>
                <span className="sr-only sm:hidden">
                  {allDetailGroupsExpanded ? t("actions.collapseAll") : t("actions.expandAll")}
                </span>
              </Button>
            ) : null}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={t("common.export")}
                  className="h-9 min-w-9 rounded-md px-2.5"
                  disabled={exportDisabled}
                >
                  {exporting === "excel" || exporting === "pdf" ? (
                    <Spinner aria-hidden="true" data-icon="inline-start" />
                  ) : (
                    <Download data-icon="inline-start" />
                  )}
                  <span className="hidden sm:inline">{t("common.export")}</span>
                  <ChevronDown data-icon="inline-end" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    disabled={exportDisabled}
                    onSelect={onExportExcel}
                  >
                    <FileSpreadsheet data-icon="inline-start" />
                    {t("report.exportExcel")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={exportDisabled}
                    onSelect={onExportPdf}
                  >
                    <Download data-icon="inline-start" />
                    {t("report.exportPdf")}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {selectedDisplayCount > 0 ? (
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <Badge className="h-6 max-w-full truncate border-primary/20 bg-primary/10 px-2 text-xs text-primary">
              {isDetail
                ? t("report.selectedBillsForPrint", {
                    count: selectedDisplayCount,
                  })
                : t("report.selectedForExport", {
                    count: selectedDisplayCount,
                  })}
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
        ) : null}
      </div>
    </CardHeader>
  );
}

function ReportTypeSwitch({
  disabled,
  value,
  onChange,
}: ReportTypeSwitchProps) {
  const { t } = useTranslation();

  return (
    <ToggleGroup
      type="single"
      value={value}
      disabled={disabled}
      className="grid h-9 w-full grid-cols-2 rounded-md border border-border bg-muted/70 p-1"
      onValueChange={(nextValue) => {
        if (nextValue === "bill" || nextValue === "detail")
          onChange(nextValue);
      }}
    >
      {(["bill", "detail"] as const).map((nextTypePage) => (
        <ToggleGroupItem
          key={nextTypePage}
          value={nextTypePage}
          aria-label={
            nextTypePage === "bill"
              ? t("report.salesReportByBill")
              : t("report.detailedSalesReport")
          }
          className={cn(
            "h-7 min-w-0 rounded-sm px-2 text-xs font-medium data-[state=on]:font-semibold",
            "data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm",
            "text-muted-foreground hover:text-foreground",
          )}
        >
          <span className="block truncate">
            {nextTypePage === "bill"
              ? t("report.salesReportByBill")
              : t("report.detailedSalesReport")}
          </span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

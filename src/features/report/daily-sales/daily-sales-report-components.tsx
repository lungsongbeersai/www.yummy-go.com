"use client";

import type { ReactNode } from "react";
import { BlockingLoadingDialog } from "@/components/common/blocking-loading-dialog";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  Printer,
  ReceiptText,
  RefreshCcw,
  Search,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
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
import { Input } from "@/components/ui/input";
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

interface ReportSummaryCardsProps {
  cards: SummaryCardConfig[];
  reportTotal: Record<string, unknown>;
  summaryCards: SummaryCards;
}

interface ReportSummaryToggleProps {
  controlsId: string;
  expanded: boolean;
  onToggle: () => void;
}

interface ReportExportLoadingDialogProps {
  exporting: ReportExportAction | null;
  progress: ReportExportProgress | null;
}

interface ReportTableCardProps {
  actions: ReportTableActionsProps;
  children: ReactNode;
  footer: ReactNode;
  loading: boolean;
  rowsLength: number;
}

interface ReportTableActionsProps {
  allDetailGroupsExpanded: boolean;
  billGroupsLength: number;
  branchUuid: string | null;
  exportDisabled: boolean;
  exporting: ReportExportAction | null;
  loading: boolean;
  printDisabled: boolean;
  search: string;
  selectedBillCount: number;
  selectedCount: number;
  typePage: ReportTab;
  onClearSelection: () => void;
  onCollapseAllBills: () => void;
  onExpandAllBills: () => void;
  onExportExcel: () => void;
  onExportPdf: () => void;
  onPrintReport: () => void;
  onRefresh: () => void;
  onSearchChange: (search: string) => void;
  onTypePageChange: (typePage: ReportTab) => void;
}

interface ReportTypeSwitchProps {
  disabled: boolean;
  value: ReportTab;
  onChange: (typePage: ReportTab) => void;
}

interface ReportErrorProps {
  message: string;
}

interface ReportPaginationProps {
  canGoBack: boolean;
  canGoNext: boolean;
  onBack: () => void;
  onNext: () => void;
  onPageChange: (page: number) => void;
  page: number;
  rangeLabel: string;
  totalPages: number;
}

export function ReportSummaryCards({
  cards,
  reportTotal,
  summaryCards,
}: ReportSummaryCardsProps) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      {cards.map((card) => {
        const value = summaryCardValue(summaryCards, reportTotal, card.keys);
        const tone = summaryCardTone(card);

        return (
          <Card
            key={card.label}
            className={cn(
              "overflow-hidden border shadow-sm",
              tone === "primary" &&
                "border-primary/20 bg-primary/5 shadow-primary/5",
              tone === "danger" &&
                "border-destructive/20 bg-destructive/5 shadow-destructive/5",
              tone === "neutral" && "border-border bg-muted/20",
            )}
          >
            <CardContent className="p-4">
              <p
                className={cn(
                  "truncate text-xs font-black uppercase",
                  tone === "primary" && "text-primary",
                  tone === "danger" && "text-destructive",
                  tone === "neutral" && "text-muted-foreground",
                )}
              >
                {card.label}
              </p>
              <p className="mt-2 truncate text-xl font-black tabular-nums text-foreground">
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

export function ReportSummaryToggle({
  controlsId,
  expanded,
  onToggle,
}: ReportSummaryToggleProps) {
  const { t } = useTranslation();
  const label = expanded ? t("report.hideSummary") : t("report.showSummary");

  return (
    <div className="flex">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 whitespace-nowrap"
        aria-controls={controlsId}
        aria-expanded={expanded}
        onClick={onToggle}
      >
        {expanded ? (
          <EyeOff data-icon="inline-start" aria-hidden="true" />
        ) : (
          <Eye data-icon="inline-start" aria-hidden="true" />
        )}
        {label}
      </Button>
    </div>
  );
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

export function ReportTableCard({
  actions,
  children,
  footer,
  loading,
  rowsLength,
}: ReportTableCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-border bg-card shadow-sm">
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
            <div className="min-h-0 flex-1 overflow-auto">{children}</div>
            <div className="shrink-0 bg-card">{footer}</div>
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
  branchUuid,
  exportDisabled,
  exporting,
  loading,
  printDisabled,
  search,
  selectedBillCount,
  selectedCount,
  typePage,
  onClearSelection,
  onCollapseAllBills,
  onExpandAllBills,
  onExportExcel,
  onExportPdf,
  onPrintReport,
  onRefresh,
  onSearchChange,
  onTypePageChange,
}: ReportTableActionsProps) {
  const { t } = useTranslation();
  const isDetail = typePage === "detail";
  const selectedDisplayCount = isDetail ? selectedBillCount : selectedCount;
  const disabled = loading || Boolean(exporting);

  return (
    <CardHeader className="shrink-0 border-b border-border bg-card/95 px-2 py-2 sm:px-3">
      <div className="grid w-full min-w-0 grid-cols-1 items-center gap-2 2xl:grid-cols-[minmax(180px,16rem)_minmax(18rem,20rem)_minmax(16rem,1fr)_auto]">
        <div className="flex min-w-0 items-center gap-2">
          <div className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            {isDetail ? (
              <FileText aria-hidden="true" />
            ) : (
              <ReceiptText aria-hidden="true" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-sm font-black">
              {isDetail
                ? t("report.detailedSalesReport")
                : t("report.salesReportByBill")}
            </CardTitle>

            {selectedDisplayCount > 0 ? (
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
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
        </div>

        <div className="min-w-0">
          <ReportTypeSwitch
            disabled={disabled}
            value={typePage}
            onChange={onTypePageChange}
          />
        </div>

        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            autoComplete="off"
            aria-label={t("actions.search")}
            placeholder={t("actions.search")}
            className="h-9 w-full rounded-md bg-background pl-9 text-sm"
            disabled={!branchUuid || Boolean(exporting)}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 2xl:flex-nowrap">
          {isDetail && billGroupsLength ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 min-w-9 rounded-md px-2.5"
              disabled={disabled}
              onClick={
                allDetailGroupsExpanded ? onCollapseAllBills : onExpandAllBills
              }
            >
              {allDetailGroupsExpanded ? (
                <ChevronDown data-icon="inline-start" />
              ) : (
                <ChevronRight data-icon="inline-start" />
              )}
              {/* <span className="hidden sm:inline">
                {allDetailGroupsExpanded
                  ? t("actions.collapseAll")
                  : t("actions.expandAll")}
              </span> */}
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
                  <RefreshCcw
                    className="animate-spin"
                    data-icon="inline-start"
                  />
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

          {/* <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={t("report.print")}
            className="h-9 min-w-9 rounded-md px-2.5"
            disabled={printDisabled}
            onClick={onPrintReport}
          >
            {exporting === "print" ? (
              <RefreshCcw className="animate-spin" data-icon="inline-start" />
            ) : (
              <Printer data-icon="inline-start" />
            )}
            <span className="hidden sm:inline">{t("report.print")}</span>
          </Button> */}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={t("actions.refresh")}
            className="h-9 min-w-9 rounded-md border border-border/60 px-2.5 text-muted-foreground hover:text-foreground"
            disabled={loading || !branchUuid || Boolean(exporting)}
            onClick={onRefresh}
          >
            <RefreshCcw
              className={loading ? "animate-spin" : undefined}
              data-icon="inline-start"
            />
            {/* <span className="hidden sm:inline">{t("actions.refresh")}</span> */}
          </Button>
        </div>
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
            "h-7 min-w-0 rounded-sm px-2 text-xs font-black",
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

export { ReportError } from "../shared/report-error";
export { ReportPagination } from "../shared/report-pagination";


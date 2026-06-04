"use client";

import type { ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  Printer,
  ReceiptText,
  RefreshCcw,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  ReportExportAction,
  SummaryCardConfig,
  SummaryCards,
} from "./daily-sales-report-types";
import { firstNumber, summaryCardValue } from "./daily-sales-report-utils";

export function ReportSummaryCards({
  cards,
  reportTotal,
  summaryCards,
}: {
  cards: SummaryCardConfig[];
  reportTotal: Record<string, unknown>;
  summaryCards: SummaryCards;
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      {cards.map((card) => {
        const value = summaryCardValue(summaryCards, reportTotal, card.keys);
        return (
          <Card
            key={card.label}
            className="overflow-hidden border-border bg-card shadow-sm"
          >
            <CardContent className="p-4">
              <p className="truncate text-xs font-black uppercase text-muted-foreground">
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

export function ReportSummaryToggle({
  controlsId,
  expanded,
  onToggle,
}: {
  controlsId: string;
  expanded: boolean;
  onToggle: () => void;
}) {
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

export function ReportTableCard({
  actions,
  children,
  footer,
  loading,
  rowsLength,
}: {
  actions: ReportTableActionsProps;
  children: ReactNode;
  footer: ReactNode;
  loading: boolean;
  rowsLength: number;
}) {
  const { t } = useTranslation();

  return (
    <Card className="min-h-0 overflow-hidden border-border bg-card shadow-sm md:sticky md:top-[calc(var(--daily-sales-filter-height)_+_0.75rem)] md:flex md:max-h-[calc(100dvh_-_var(--app-shell-header-height)_-_var(--daily-sales-filter-height)_-_1.5rem)] md:flex-col">
      <ReportTableActions {...actions} />
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        {loading ? (
          <div className="p-4 md:min-h-[320px]">
            <LoadingState label={t("report.loading")} variant="table" />
          </div>
        ) : rowsLength ? (
          <>
            <div className="min-h-0 md:flex-1 md:overflow-auto md:overscroll-x-contain md:overscroll-y-auto">
              {children}
            </div>
            <div className="shrink-0 bg-card">{footer}</div>
          </>
        ) : (
          <div className="p-4 md:min-h-[320px]">
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

type ReportTableActionsProps = {
  allDetailGroupsExpanded: boolean;
  billGroupsLength: number;
  branchUuid: string;
  contextRangeLabel: string;
  detailLinesCount: number;
  exportDisabled: boolean;
  exporting: ReportExportAction | null;
  loading: boolean;
  selectedCount: number;
  typePage: "summary" | "detail";
  onClearSelection: () => void;
  onCollapseAllBills: () => void;
  onExpandAllBills: () => void;
  onExportExcel: () => void;
  onExportPdf: () => void;
  onPrintReport: () => void;
  onRefresh: () => void;
};

function ReportTableActions({
  allDetailGroupsExpanded,
  billGroupsLength,
  branchUuid,
  contextRangeLabel,
  detailLinesCount,
  exportDisabled,
  exporting,
  loading,
  selectedCount,
  typePage,
  onClearSelection,
  onCollapseAllBills,
  onExpandAllBills,
  onExportExcel,
  onExportPdf,
  onPrintReport,
  onRefresh,
}: ReportTableActionsProps) {
  const { t } = useTranslation();
  const isDetail = typePage === "detail";

  return (
    <CardHeader className="flex shrink-0 flex-col gap-2 border-b border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <CardTitle className="flex min-w-0 items-center gap-2 text-base font-black">
          {typePage === "summary" ? <ReceiptText /> : <FileText />}
          <span className="truncate">
            {typePage === "summary"
              ? t("report.summaryTable")
              : t("report.detailTable")}
          </span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">{contextRangeLabel}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {isDetail ? (
            <Badge className="h-7 border-border bg-muted px-2 text-xs text-muted-foreground">
              {t("report.detailGroupedCount", {
                bills: billGroupsLength,
                lines: detailLinesCount,
              })}
            </Badge>
          ) : null}
          <Badge
            className={cn(
              "h-7 px-2 text-xs",
              selectedCount
                ? "border-primary/20 bg-primary/10 text-primary"
                : "border-border bg-muted text-muted-foreground",
            )}
          >
            {selectedCount
              ? t("report.selectedForExport", { count: selectedCount })
              : t("report.allFilteredForExport")}
          </Badge>
          {selectedCount ? (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={onClearSelection}
            >
              {t("report.clearSelection")}
            </Button>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {isDetail && billGroupsLength ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            onClick={
              allDetailGroupsExpanded ? onCollapseAllBills : onExpandAllBills
            }
          >
            {allDetailGroupsExpanded ? (
              <ChevronDown data-icon="inline-start" />
            ) : (
              <ChevronRight data-icon="inline-start" />
            )}
            {allDetailGroupsExpanded
              ? t("actions.collapseAll")
              : t("actions.expandAll")}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          disabled={exportDisabled}
          onClick={onExportExcel}
        >
          {exporting === "excel" ? (
            <RefreshCcw className="animate-spin" data-icon="inline-start" />
          ) : (
            <FileSpreadsheet data-icon="inline-start" />
          )}
          {t("report.exportExcel")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          disabled={exportDisabled}
          onClick={onExportPdf}
        >
          {exporting === "pdf" ? (
            <RefreshCcw className="animate-spin" data-icon="inline-start" />
          ) : (
            <Download data-icon="inline-start" />
          )}
          {t("report.exportPdf")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          disabled={exportDisabled}
          onClick={onPrintReport}
        >
          {exporting === "print" ? (
            <RefreshCcw className="animate-spin" data-icon="inline-start" />
          ) : (
            <Printer data-icon="inline-start" />
          )}
          {t("report.print")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          disabled={loading || !branchUuid || Boolean(exporting)}
          onClick={onRefresh}
        >
          <RefreshCcw
            className={loading ? "animate-spin" : undefined}
            data-icon="inline-start"
          />
          {t("actions.refresh")}
        </Button>
      </div>
    </CardHeader>
  );
}

export function ReportError({ message }: { message: string }) {
  return (
    <Card className="border-destructive/25 bg-destructive/5">
      <CardContent className="p-3 text-sm font-medium text-destructive">
        {message}
      </CardContent>
    </Card>
  );
}

export function ReportPagination({
  canGoBack,
  canGoNext,
  onBack,
  onNext,
  page,
  rangeLabel,
  totalPages,
}: {
  canGoBack: boolean;
  canGoNext: boolean;
  onBack: () => void;
  onNext: () => void;
  page: number;
  rangeLabel: string;
  totalPages: number;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2 border-t border-border px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>{rangeLabel}</span>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex">
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={!canGoBack}
          onClick={onBack}
        >
          {t("actions.back")}
        </Button>
        <Badge className="h-7 px-2 text-xs">
          {t("common.page", { current: page, total: totalPages })}
        </Badge>
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={!canGoNext}
          onClick={onNext}
        >
          {t("common.nextPage")}
        </Button>
      </div>
    </div>
  );
}

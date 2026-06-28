"use client";

import type { ReactNode } from "react";
import { AppPagination } from "@/components/common/app-pagination";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  Filter,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  ReportExportAction,
  ReportExportProgress,
  ReportPaymentMethodFilter,
  SummaryCardConfig,
  SummaryCards,
} from "./daily-sales-report-types";
import {
  firstNumber,
  paymentMethodOptions,
  summaryCardValue,
} from "./daily-sales-report-utils";

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

export function ReportExportLoadingDialog({
  exporting,
  progress,
}: {
  exporting: ReportExportAction | null;
  progress: ReportExportProgress | null;
}) {
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
    <Dialog open={Boolean(exporting)}>
      <DialogContent
        className="max-w-md gap-0 overflow-hidden p-0"
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="gap-0 border-b bg-muted/30 p-0 text-left">
          <div className="flex items-center gap-4 px-6 py-5">
            <div className="grid size-12 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <Spinner className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-base font-black">
                {actionLabel}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {t("report.exportingDescription")}
              </DialogDescription>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-3xl font-black tabular-nums text-foreground">
                {percent}%
              </p>
              <p className="text-xs font-semibold text-muted-foreground">
                {t("report.exportProgress.progress")}
              </p>
            </div>
          </div>
        </DialogHeader>
        <div className="flex flex-col gap-3 px-6 py-5">
          <Progress
            value={percent}
            aria-label={t("report.exportProgress.progress")}
            className="h-2.5"
          />
          <div
            className="flex items-center justify-between gap-3 text-sm"
            aria-live="polite"
          >
            <span className="min-w-0 truncate font-semibold text-foreground">
              {progressLabel}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {t("report.exportProgress.keepOpen")}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
    <Card className="min-h-0 min-w-0 overflow-hidden border-border bg-card shadow-sm md:sticky md:top-3 md:flex md:max-h-[calc(100dvh-var(--app-shell-header-height)-1.5rem)] md:flex-col">
      <ReportTableActions {...actions} />
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        {loading ? (
          <div className="p-4 md:min-h-80">
            <LoadingState label={t("report.loading")} variant="table" />
          </div>
        ) : rowsLength ? (
          <>
            <div className="min-h-0 flex-1 overflow-auto">{children}</div>
            <div className="shrink-0 bg-card">{footer}</div>
          </>
        ) : (
          <div className="p-4 md:min-h-80">
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
  exportDisabled: boolean;
  exporting: ReportExportAction | null;
  loading: boolean;
  paymentMethod: ReportPaymentMethodFilter;
  printDisabled: boolean;
  selectedBillCount: number;
  selectedCount: number;
  typePage: "summary" | "detail";
  onClearSelection: () => void;
  onCollapseAllBills: () => void;
  onExpandAllBills: () => void;
  onExportExcel: () => void;
  onExportPdf: () => void;
  onOpenFilters: () => void;
  onPaymentMethodChange: (paymentMethod: ReportPaymentMethodFilter) => void;
  onPrintReport: () => void;
  onRefresh: () => void;
  onTypePageChange: (typePage: "summary" | "detail") => void;
};

function ReportTableActions({
  allDetailGroupsExpanded,
  billGroupsLength,
  branchUuid,
  exportDisabled,
  exporting,
  loading,
  paymentMethod,
  printDisabled,
  selectedBillCount,
  selectedCount,
  typePage,
  onClearSelection,
  onCollapseAllBills,
  onExpandAllBills,
  onExportExcel,
  onExportPdf,
  onOpenFilters,
  onPaymentMethodChange,
  onPrintReport,
  onRefresh,
  onTypePageChange,
}: ReportTableActionsProps) {
  const { t } = useTranslation();
  const isDetail = typePage === "detail";

  return (
    <CardHeader className="flex min-w-0 shrink-0 flex-col gap-2 border-b border-border bg-card px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
      <div className="min-w-0 flex-1">
        <CardTitle className="flex min-w-0 flex-wrap items-center gap-2 text-base font-black">
          {typePage === "summary" ? <ReceiptText /> : <FileText />}
          <span className="truncate">
            {typePage === "summary"
              ? t("report.summaryTable")
              : t("report.detailTable")}
          </span>
          <div className="grid h-8 w-full grid-cols-2 gap-1 rounded-md border border-border bg-background/70 p-1 sm:w-52">
            {(["summary", "detail"] as const).map((nextTypePage) => (
              <Button
                key={nextTypePage}
                type="button"
                size="xs"
                variant={typePage === nextTypePage ? "default" : "ghost"}
                className="h-6 min-w-0 px-2 text-xs shadow-none"
                disabled={loading || Boolean(exporting)}
                onClick={() => onTypePageChange(nextTypePage)}
              >
                <span className="truncate">
                  {nextTypePage === "summary"
                    ? t("report.summary")
                    : t("report.detail")}
                </span>
              </Button>
            ))}
          </div>
        </CardTitle>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {selectedCount ? (
            <Badge className="h-7 border-primary/20 bg-primary/10 px-2 text-xs text-primary">
              {t("report.selectedBillsForPrint", {
                count: selectedBillCount,
              })}
            </Badge>
          ) : null}
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
      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
        <Select
          value={paymentMethod}
          disabled={loading || Boolean(exporting)}
          onValueChange={(value) =>
            onPaymentMethodChange(value as ReportPaymentMethodFilter)
          }
        >
          <SelectTrigger
            aria-label={t("report.filters.paymentMethod")}
            className="h-9 w-full min-w-36 sm:w-44"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start" className="z-[100]" position="popper">
            <SelectGroup>
              {paymentMethodOptions.map((method) => (
                <SelectItem key={method} value={method}>
                  {method === "all"
                    ? t("common.all")
                    : t(`report.paymentMethods.${method}`)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
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
          onClick={onOpenFilters}
        >
          <Filter data-icon="inline-start" />
          {t("report.filters.openFilters")}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              disabled={exportDisabled}
            >
              {exporting === "excel" || exporting === "pdf" ? (
                <RefreshCcw className="animate-spin" data-icon="inline-start" />
              ) : (
                <Download data-icon="inline-start" />
              )}
              {t("common.export")}
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          disabled={printDisabled}
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
  onPageChange,
  page,
  totalPages,
}: {
  canGoBack: boolean;
  canGoNext: boolean;
  onBack: () => void;
  onNext: () => void;
  onPageChange: (page: number) => void;
  page: number;
  rangeLabel: string;
  totalPages: number;
}) {
  return (
    <div className="border-t border-border px-4 py-3">
      <AppPagination
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </div>
  );
}

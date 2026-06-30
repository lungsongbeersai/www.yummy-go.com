"use client";

import type { ReactNode } from "react";
import { AppPagination } from "@/components/common/app-pagination";
import { BlockingLoadingDialog } from "@/components/common/blocking-loading-dialog";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type ReportTypePage = "summary" | "detail";

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
  paymentMethod: ReportPaymentMethodFilter;
  printDisabled: boolean;
  selectedBillCount: number;
  selectedCount: number;
  typePage: ReportTypePage;
  onClearSelection: () => void;
  onCollapseAllBills: () => void;
  onExpandAllBills: () => void;
  onExportExcel: () => void;
  onExportPdf: () => void;
  onOpenFilters: () => void;
  onPaymentMethodChange: (paymentMethod: ReportPaymentMethodFilter) => void;
  onPrintReport: () => void;
  onRefresh: () => void;
  onTypePageChange: (typePage: ReportTypePage) => void;
}

interface ReportTypeSwitchProps {
  disabled: boolean;
  value: ReportTypePage;
  onChange: (typePage: ReportTypePage) => void;
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
    <Card className="min-h-0 min-w-0 overflow-hidden border-border bg-card shadow-sm md:sticky md:top-3 md:flex md:max-h-[calc(100dvh-var(--app-shell-header-height)-1.5rem)] md:flex-col">
      <ReportTableActions {...actions} />

      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        {loading ? (
          <div className="p-4 md:min-h-80">
            <LoadingState label={t("report.loading")} variant="reportTable" />
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
  const selectedDisplayCount = isDetail ? selectedBillCount : selectedCount;
  const disabled = loading || Boolean(exporting);

  return (
    <CardHeader className="shrink-0 border-b border-border bg-card px-3 py-3 sm:px-4">
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            {isDetail ? (
              <FileText className="size-4" />
            ) : (
              <ReceiptText className="size-4" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base font-black">
              {isDetail ? t("report.detailTable") : t("report.summaryTable")}
            </CardTitle>

            {selectedDisplayCount > 0 ? (
              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
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

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <div className="min-w-0 w-full sm:w-auto">
            <ReportTypeSwitch
              disabled={disabled}
              value={typePage}
              onChange={onTypePageChange}
            />
          </div>

          <Select
            value={paymentMethod}
            disabled={disabled}
            onValueChange={(value) =>
              onPaymentMethodChange(value as ReportPaymentMethodFilter)
            }
          >
            <SelectTrigger
              aria-label={t("report.filters.paymentMethod")}
              className="h-10 w-full min-w-40 sm:w-auto"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start" className="z-100" position="popper">
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
              disabled={disabled}
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
                {allDetailGroupsExpanded
                  ? t("actions.collapseAll")
                  : t("actions.expandAll")}
              </span>
            </Button>
          ) : null}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            disabled={disabled}
            onClick={onOpenFilters}
          >
            <Filter data-icon="inline-start" />
            <span className="hidden sm:inline">
              {t("report.filters.openFilters")}
            </span>
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
            <span className="hidden sm:inline">{t("report.print")}</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9"
            disabled={loading || !branchUuid || Boolean(exporting)}
            onClick={onRefresh}
          >
            <RefreshCcw
              className={loading ? "animate-spin" : undefined}
              data-icon="inline-start"
            />
            <span className="hidden sm:inline">{t("actions.refresh")}</span>
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
    <div className="grid h-10 w-full grid-cols-2 rounded-md border border-border bg-muted p-1 xl:w-80">
      {(["summary", "detail"] as const).map((nextTypePage) => (
        <button
          key={nextTypePage}
          type="button"
          disabled={disabled}
          aria-pressed={value === nextTypePage}
          className={cn(
            "min-w-0 rounded-sm px-3 text-sm font-black transition-colors",
            "disabled:pointer-events-none disabled:opacity-50",
            value === nextTypePage
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onChange(nextTypePage)}
        >
          <span className="block truncate">
            {nextTypePage === "summary"
              ? t("report.summary")
              : t("report.detail")}
          </span>
        </button>
      ))}
    </div>
  );
}

export function ReportError({ message }: ReportErrorProps) {
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
}: ReportPaginationProps) {
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

"use client";

import { type ReactNode, type RefObject, useCallback, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Download,
  FileSpreadsheet,
  Filter,
  Printer,
  RefreshCcw,
  SlidersHorizontal,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { PAGE_LIMIT_OPTIONS, isAllPageLimit } from "@/lib/pagination";
import type { PaymentMethodReportFilter } from "@/services/report";
import type {
  PaymentMethodOption,
  PaymentMethodReportRow,
  PaymentMethodSummaryCard,
} from "@/stores/report-store";
import { SortableReportTableHead } from "../report-sort-table-head";
import { useLocalTableSort } from "../report-sort-utils";
import type {
  PaymentMethodsExportAction,
  PaymentMethodsReportFilters,
} from "./payment-methods-report-types";
import {
  displayMetric,
  paymentMethodRowMetricConfigs,
  paymentMethodTotalMetricConfigs,
} from "./payment-methods-report-utils";

type FilterProps = {
  branchLoading: boolean;
  branchLocked: boolean;
  branchOptions: Array<{ label: string; value: string }>;
  canApply: boolean;
  draftFilters: PaymentMethodsReportFilters;
  loading: boolean;
  methodOptions: PaymentMethodOption[];
  onApply: () => void;
  onDraftChange: (filters: PaymentMethodsReportFilters) => void;
};

export function PaymentMethodsSummaryCards({
  cards,
  reportTotal,
}: {
  cards: PaymentMethodSummaryCard[];
  reportTotal: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const visibleCards = cards.length
    ? cards
    : paymentMethodTotalMetricConfigs(t)
        .filter((metric) => isPresent(reportTotal[metric.key]))
        .map((metric, index) => ({
          key: metric.key,
          label: metric.label,
          sortOrder: index + 1,
          value: Number(reportTotal[metric.key] ?? 0),
          valueType: metric.kind,
        }));

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      {visibleCards.map((card) => (
        <Card
          key={card.key}
          className={cn(
            "overflow-hidden border-border bg-card shadow-sm",
            (card.key === "grand_total" || card.key === "payment_total") &&
              "border-primary/30 bg-primary/5",
            card.key.includes("discount") && card.value > 0 && "border-destructive/25 bg-destructive/5"
          )}
        >
          <CardContent className="p-4">
            <p className="truncate text-xs font-black uppercase text-muted-foreground">
              {card.label}
            </p>
            <p className={cn("mt-2 truncate text-xl tabular-nums", financialTextClass(card.key, card.value, true))}>
              {displayMetric(card.value, card.valueType)}
            </p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

export function PaymentMethodsFilterBar({
  branchLoading,
  branchLocked,
  branchOptions,
  canApply,
  draftFilters,
  loading,
  methodOptions,
  onApply,
  onDraftChange,
}: FilterProps) {
  const { t } = useTranslation();

  return (
    <Card className="min-w-0 border-border bg-card shadow-sm">
      <CardContent className="p-3 sm:p-4">
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
          <PaymentMethodsFilterFields
            branchLoading={branchLoading}
            branchLocked={branchLocked}
            branchOptions={branchOptions}
            draftFilters={draftFilters}
            idPrefix="payment-methods"
            methodOptions={methodOptions}
            onDraftChange={onDraftChange}
          />
          <div className="flex items-end sm:col-span-2 lg:col-span-12 xl:col-span-2">
            <Button
              type="button"
              className="h-9 w-full min-w-28"
              disabled={loading || !canApply}
              onClick={onApply}
            >
              {loading ? (
                <RefreshCcw className="animate-spin" data-icon="inline-start" />
              ) : null}
              {t("report.apply")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PaymentMethodsFilterSheet({
  branchLoading,
  branchLocked,
  branchOptions,
  canApply,
  draftFilters,
  loading,
  methodOptions,
  open,
  onApply,
  onDraftChange,
  onOpenChange,
}: FilterProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b border-border bg-muted/20 px-4 py-3 pr-12 text-left sm:px-5">
          <DialogTitle className="text-base font-black text-foreground">
            {t("report.filters.currentFilters")}
          </DialogTitle>
          <DialogDescription>
            {t("report.paymentMethodsReport.title")}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[calc(100dvh-12rem)] overflow-y-auto overscroll-contain p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
            <PaymentMethodsFilterFields
              branchLoading={branchLoading}
              branchLocked={branchLocked}
              branchOptions={branchOptions}
              draftFilters={draftFilters}
              idPrefix="payment-methods-mobile"
              methodOptions={methodOptions}
              onDraftChange={onDraftChange}
            />
          </div>
        </div>
        <DialogFooter className="grid shrink-0 grid-cols-2 gap-2 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:flex sm:px-5">
          <DialogClose asChild>
            <Button type="button" variant="outline" className="h-10 sm:min-w-24">
              {t("actions.close")}
            </Button>
          </DialogClose>
          <Button
            type="button"
            className="h-10 sm:min-w-24"
            disabled={loading || !canApply}
            onClick={onApply}
          >
            {loading ? (
              <RefreshCcw className="animate-spin" data-icon="inline-start" />
            ) : null}
            {t("report.apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MobilePaymentMethodsFilterSummary({
  branchLabel,
  filters,
  methodLabel,
  onOpen,
}: {
  branchLabel: string;
  filters: PaymentMethodsReportFilters;
  methodLabel: string;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const limitLabel = isAllPageLimit(filters.limit)
    ? t("common.all")
    : filters.limit;

  return (
    <div className="rounded-md border border-border bg-card p-2 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1 text-xs font-bold text-muted-foreground">
            <CalendarDays className="size-3.5 shrink-0" />
            <span className="truncate">
              {filters.dateFrom} - {filters.dateTo}
            </span>
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap gap-1">
            <Badge className="h-6 max-w-44 truncate border-border bg-muted px-2 text-[11px] text-muted-foreground">
              {branchLabel}
            </Badge>
            <Badge className="h-6 max-w-36 truncate px-2 text-[11px]">
              {methodLabel}
            </Badge>
            <Badge className="h-6 border-border bg-muted px-2 text-[11px] text-muted-foreground">
              {limitLabel}
            </Badge>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-9 shrink-0 px-3"
          onClick={onOpen}
        >
          <SlidersHorizontal data-icon="inline-start" />
          {t("report.filters.openFilters")}
        </Button>
      </div>
    </div>
  );
}

function PaymentMethodsFilterFields({
  branchLoading,
  branchLocked,
  branchOptions,
  draftFilters,
  idPrefix,
  methodOptions,
  onDraftChange,
}: {
  branchLoading: boolean;
  branchLocked: boolean;
  branchOptions: Array<{ label: string; value: string }>;
  draftFilters: PaymentMethodsReportFilters;
  idPrefix: string;
  methodOptions: PaymentMethodOption[];
  onDraftChange: (filters: PaymentMethodsReportFilters) => void;
}) {
  const { t } = useTranslation();

  function patch(patch: Partial<PaymentMethodsReportFilters>) {
    onDraftChange({ ...draftFilters, ...patch });
  }

  return (
    <>
      <Field className="min-w-0 gap-1.5 sm:col-span-2 lg:col-span-4">
        <FieldLabel
          htmlFor={`${idPrefix}-branch`}
          className="text-xs font-bold text-muted-foreground"
        >
          {t("nav.branch")}
        </FieldLabel>
        <Select
          value={draftFilters.branchUuid}
          disabled={branchLoading || branchLocked || branchOptions.length <= 1}
          onValueChange={(value) => patch({ branchUuid: value })}
        >
          <SelectTrigger id={`${idPrefix}-branch`} className="h-10 w-full rounded-md">
            <SelectValue placeholder={t("nav.branch")} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {branchOptions.map((branch) => (
                <SelectItem key={branch.value} value={branch.value}>
                  {branch.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field className="min-w-0 gap-1.5 lg:col-span-4">
        <FieldLabel
          htmlFor={`${idPrefix}-date-from`}
          className="text-xs font-bold text-muted-foreground"
        >
          {t("report.filters.dateFrom")}
        </FieldLabel>
        <Input
          id={`${idPrefix}-date-from`}
          name={`${idPrefix}-date-from`}
          type="date"
          value={draftFilters.dateFrom}
          autoComplete="off"
          className="h-10 rounded-md text-sm"
          onChange={(event) => patch({ dateFrom: event.target.value })}
        />
      </Field>
      <Field className="min-w-0 gap-1.5 lg:col-span-4">
        <FieldLabel
          htmlFor={`${idPrefix}-date-to`}
          className="text-xs font-bold text-muted-foreground"
        >
          {t("report.filters.dateTo")}
        </FieldLabel>
        <Input
          id={`${idPrefix}-date-to`}
          name={`${idPrefix}-date-to`}
          type="date"
          value={draftFilters.dateTo}
          autoComplete="off"
          className="h-10 rounded-md text-sm"
          onChange={(event) => patch({ dateTo: event.target.value })}
        />
      </Field>
      <Field className="min-w-0 gap-1.5 lg:col-span-4">
        <FieldLabel
          htmlFor={`${idPrefix}-payment-method`}
          className="text-xs font-bold text-muted-foreground"
        >
          {t("report.filters.paymentMethod")}
        </FieldLabel>
        <Select
          value={draftFilters.paymentMethod}
          onValueChange={(value) =>
            patch({ paymentMethod: value as PaymentMethodReportFilter })
          }
        >
          <SelectTrigger id={`${idPrefix}-payment-method`} className="h-10 w-full rounded-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {methodOptions.map((method) => (
                <SelectItem key={method.value} value={method.value}>
                  {method.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field className="min-w-0 gap-1.5 lg:col-span-6">
        <FieldLabel
          htmlFor={`${idPrefix}-limit`}
          className="text-xs font-bold text-muted-foreground"
        >
          {t("common.rowsPerPage")}
        </FieldLabel>
        <Select
          value={String(draftFilters.limit)}
          onValueChange={(value) =>
            patch({ limit: value === "All" ? "All" : Number(value) })
          }
        >
          <SelectTrigger id={`${idPrefix}-limit`} className="h-10 w-full rounded-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {PAGE_LIMIT_OPTIONS.map((limit) => (
                <SelectItem key={String(limit)} value={String(limit)}>
                  {limit === "All" ? t("common.all") : limit}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
    </>
  );
}

type TableCardProps = {
  children: ReactNode;
  exportDisabled: boolean;
  exporting: PaymentMethodsExportAction | null;
  footer: ReactNode;
  loading: boolean;
  rowsLength: number;
  title: string;
  onExportExcel: () => void;
  onExportPdf: () => void;
  onOpenFilters: () => void;
  onPrintReport: () => void;
  onRefresh: () => void;
};

export function PaymentMethodsTableCard({
  children,
  exportDisabled,
  exporting,
  footer,
  loading,
  rowsLength,
  title,
  onExportExcel,
  onExportPdf,
  onOpenFilters,
  onPrintReport,
  onRefresh,
}: TableCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-border bg-card shadow-sm">
      <CardHeader className="shrink-0 border-b border-border bg-card/95 px-2 py-2 sm:px-3">
        <div className="grid w-full min-w-0 grid-cols-1 items-center gap-2 2xl:grid-cols-[minmax(180px,16rem)_minmax(0,1fr)_auto]">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <CreditCard aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate text-sm font-black">
                {title}
              </CardTitle>
            </div>
            {loading && rowsLength ? (
              <Badge className="h-7 w-fit border-border bg-muted px-2 text-xs text-muted-foreground">
                <RefreshCcw className="animate-spin" data-icon="inline-start" />
                {t("common.loading")}
              </Badge>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 2xl:col-start-3 2xl:flex-nowrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={t("report.filters.openFilters")}
              className="h-9 min-w-9 rounded-md px-2.5"
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={t("report.print")}
              className="h-9 min-w-9 rounded-md px-2.5"
              disabled={exportDisabled}
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
              aria-label={t("actions.refresh")}
              className="h-9 min-w-9 rounded-md border border-border/60 px-2.5 text-muted-foreground hover:text-foreground"
              disabled={loading || Boolean(exporting)}
              onClick={onRefresh}
            >
              <RefreshCcw
                className={loading ? "animate-spin" : undefined}
                data-icon="inline-start"
              />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        {loading && !rowsLength ? (
          <div className="p-4 md:min-h-80">
            <PaymentMethodsLoadingSkeleton />
          </div>
        ) : rowsLength ? (
          <>
            <div className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-x-contain overscroll-y-auto">
              {children}
            </div>
            <div className="shrink-0 bg-card">{footer}</div>
          </>
        ) : (
          <div className="p-4 md:min-h-80">
            <EmptyState
              title={t("report.paymentMethodsReport.noData")}
              description={t("report.paymentMethodsReport.adjustFilters")}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Column group definitions for the desktop table
type ColumnGroup = {
  key: string;
  labelKey: string;
  fields: Array<keyof PaymentMethodReportRow>;
};

const COLUMN_GROUPS: ColumnGroup[] = [
  {
    key: "bills",
    labelKey: "report.paymentMethodsReport.groups.bills",
    fields: ["billCount"],
  },
  {
    key: "amount",
    labelKey: "report.paymentMethodsReport.groups.amount",
    fields: ["productPriceTotal", "toppingTotal", "total"],
  },
  {
    key: "discount",
    labelKey: "report.paymentMethodsReport.groups.discount",
    fields: [
      "discountItemAmount",
      "afterDiscountItem",
      "billTotal",
      "discountBill",
      "afterDiscountBill",
    ],
  },
  {
    key: "tax",
    labelKey: "report.paymentMethodsReport.groups.tax",
    fields: ["serviceCharge", "vat", "grandTotal"],
  },
  {
    key: "payment",
    labelKey: "report.paymentMethodsReport.groups.payment",
    fields: ["paymentAmount"],
  },
];

export function PaymentMethodsTable({
  rows,
}: {
  rows: PaymentMethodReportRow[];
}) {
  const { t } = useTranslation();
  const allMetrics = paymentMethodRowMetricConfigs(t);
  // Map field -> metric config for quick lookup
  const metricByField = Object.fromEntries(allMetrics.map((m) => [m.field, m]));
  const getSortValue = useCallback(
    (row: PaymentMethodReportRow, key: keyof PaymentMethodReportRow) =>
      row[key],
    [],
  );
  const { sort, sortedRows, toggleSort } = useLocalTableSort(
    rows,
    getSortValue,
  );

  return (
    <div className="hidden min-w-0 md:block">
      <Table className="w-max min-w-full table-auto text-[13px]">
        <TableHeader className="sticky top-0 z-20 bg-background/95 shadow-sm backdrop-blur">
          <TableRow className="border-b-0">
            <TableHead className="min-w-48 border-b border-border bg-background/95" />
            {COLUMN_GROUPS.map((group) => (
              <TableHead
                key={group.key}
                colSpan={group.fields.length}
                className="border-b border-border bg-muted/30 text-center text-[11px] font-black uppercase text-muted-foreground"
              >
                {t(group.labelKey, { defaultValue: group.key })}
              </TableHead>
            ))}
          </TableRow>
          <TableRow>
            <SortableReportTableHead
              sort={sort}
              sortKey="paymentMethodName"
              className="min-w-48 whitespace-nowrap bg-background/95"
              onSort={toggleSort}
            >
              {t("report.paymentMethodsReport.columns.paymentMethod")}
            </SortableReportTableHead>
            {COLUMN_GROUPS.flatMap((group) =>
              group.fields.map((field) => {
                const metric = metricByField[field];
                return (
                  <SortableReportTableHead
                    key={field}
                    align="right"
                    sort={sort}
                    sortKey={field}
                    className="min-w-28 whitespace-nowrap bg-background/95 text-right text-[12px]"
                    onSort={toggleSort}
                  >
                    {metric?.label ?? field}
                  </SortableReportTableHead>
                );
              }),
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((row, index) => (
            <TableRow
              key={`${row.paymentMethodCode}-${row.sortOrder}`}
              className={index % 2 === 1 ? "bg-muted/15" : undefined}
            >
              <TableCell className="whitespace-nowrap">
                <div>
                  <p className="font-black">{row.paymentMethodName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {row.paymentMethodCode}
                  </p>
                </div>
              </TableCell>
              {COLUMN_GROUPS.flatMap((group) =>
                group.fields.map((field) => {
                  const metric = metricByField[field];
                  return (
                    <TableCell
                      key={field}
                      className={cn("whitespace-nowrap text-right tabular-nums", metricValueClass(field, row[field]))}
                    >
                      {metric
                        ? displayMetric(row[field], metric.kind)
                        : String(row[field] ?? "-")}
                    </TableCell>
                  );
                }),
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// Mobile section group definitions
type MobileSectionGroup = {
  key: string;
  labelKey: string;
  fields: Array<keyof PaymentMethodReportRow>;
};

const MOBILE_GROUPS: MobileSectionGroup[] = [
  {
    key: "bills",
    labelKey: "report.paymentMethodsReport.groups.bills",
    fields: ["billCount"],
  },
  {
    key: "amount",
    labelKey: "report.paymentMethodsReport.groups.amount",
    fields: ["productPriceTotal", "toppingTotal", "total"],
  },
  {
    key: "discount",
    labelKey: "report.paymentMethodsReport.groups.discount",
    fields: [
      "discountItemAmount",
      "afterDiscountItem",
      "billTotal",
      "discountBill",
      "afterDiscountBill",
    ],
  },
  {
    key: "tax",
    labelKey: "report.paymentMethodsReport.groups.tax",
    fields: ["serviceCharge", "vat", "grandTotal"],
  },
  {
    key: "payment",
    labelKey: "report.paymentMethodsReport.groups.payment",
    fields: ["paymentAmount"],
  },
];

export function PaymentMethodsMobileList({
  rows,
}: {
  rows: PaymentMethodReportRow[];
}) {
  const { t } = useTranslation();
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const allMetrics = paymentMethodRowMetricConfigs(t);
  const metricByField = Object.fromEntries(allMetrics.map((m) => [m.field, m]));

  function toggleExpand(key: string) {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3 p-3 md:hidden">
      {rows.map((row) => {
        const key = `${row.paymentMethodCode}-${row.sortOrder}`;
        const expanded = expandedKeys.has(key);
        return (
          <section
            key={key}
            className="overflow-hidden rounded-md border border-border bg-card shadow-sm"
          >
            <div className="flex items-center justify-between gap-3 bg-muted/30 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-black">
                    {row.paymentMethodName}
                  </h3>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {row.paymentMethodCode}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[11px] font-bold text-muted-foreground">
                  {t("report.paymentMethodsReport.columns.paymentAmount")}
                </p>
                <p className={cn("text-base tabular-nums", metricValueClass("paymentAmount", row.paymentAmount))}>
                  {displayMetric(row.paymentAmount, "money")}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
              <div className="px-3 py-2 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {t("report.paymentMethodsReport.columns.billsCount")}
                </p>
                <p className="text-sm font-black tabular-nums">
                  {row.billCount}
                </p>
              </div>
              <div className="px-3 py-2 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {t("report.categorySales.columns.productPriceTotal")}
                </p>
                <p className={cn("text-sm tabular-nums", metricValueClass("productPriceTotal", row.productPriceTotal))}>
                  {displayMetric(row.productPriceTotal, "money")}
                </p>
              </div>
              <div className="px-3 py-2 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {t("report.categorySales.columns.grandTotal")}
                </p>
                <p className={cn("text-sm tabular-nums", metricValueClass("grandTotal", row.grandTotal))}>
                  {displayMetric(row.grandTotal, "money")}
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              className="h-11 w-full rounded-none border-b border-border text-[11px] font-bold text-muted-foreground hover:bg-muted/20"
              onClick={() => toggleExpand(key)}
            >
              {expanded ? (
                <>
                  <ChevronUp />
                  {t("actions.showLess", { defaultValue: "ຫຍໍ້ລາຍລະອຽດ" })}
                </>
              ) : (
                <>
                  <ChevronDown />
                  {t("actions.showMore", { defaultValue: "ລາຍລະອຽດທັງໝົດ" })}
                </>
              )}
            </Button>

            {expanded && (
              <div className="divide-y divide-border">
                {MOBILE_GROUPS.map((group) => (
                  <div key={group.key} className="bg-muted/10 p-3">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {t(group.labelKey, { defaultValue: group.key })}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {group.fields.map((field) => {
                        const metric = metricByField[field];
                        return (
                          <div
                            key={field}
                            className="min-w-0 rounded-md border border-border bg-background/70 px-2.5 py-1.5"
                          >
                            <p className="truncate text-[10px] font-bold text-muted-foreground">
                              {metric?.label ?? field}
                            </p>
                            <p className={cn("truncate text-xs tabular-nums", metricValueClass(field, row[field]))}>
                              {metric
                                ? displayMetric(row[field], metric.kind)
                                : String(row[field] ?? "-")}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function PaymentMethodsLoadingSkeleton() {
  return (
    <section aria-busy="true" className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="rounded-md border border-border bg-card p-4 shadow-sm">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-32" />
          </div>
        ))}
      </div>
      <div className="hidden overflow-hidden rounded-md border border-border md:block">
        <div className="grid min-w-[1180px] grid-cols-[12rem_repeat(13,minmax(7rem,1fr))] gap-3 border-b border-border bg-muted/30 px-3 py-3">
          {Array.from({ length: 14 }).map((_, index) => (
            <Skeleton key={index} className="h-4" />
          ))}
        </div>
        {Array.from({ length: 7 }).map((_, rowIndex) => (
          <div key={rowIndex} className="grid min-w-[1180px] grid-cols-[12rem_repeat(13,minmax(7rem,1fr))] gap-3 border-b border-border/70 px-3 py-3 last:border-b-0">
            {Array.from({ length: 14 }).map((__, cellIndex) => (
              <Skeleton key={cellIndex} className="h-5" />
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 md:hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-md border border-border bg-card p-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="grid flex-1 gap-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-7 w-24" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function isPresent(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

function metricNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function financialTextClass(key: string, value: unknown, strong = false) {
  const number = metricNumber(value);
  const isDiscount = key.includes("discount");
  const isTotal = key === "total" || key.includes("total") || key.includes("amount");

  return cn(
    (strong || isTotal || (isDiscount && number > 0)) && "font-black",
    number === 0 && "text-muted-foreground",
    isDiscount && number > 0 && "text-destructive",
    !isDiscount && number > 0 && "text-foreground"
  );
}

function metricValueClass(field: keyof PaymentMethodReportRow, value: unknown) {
  return financialTextClass(
    String(field),
    value,
    field === "grandTotal" || field === "paymentAmount",
  );
}

export function PaymentMethodsExportSurface({
  cards,
  containerRef,
  dateRange,
  methodLabel,
  reportTotal,
  rows,
  rowsLabel,
  title,
}: {
  cards: PaymentMethodSummaryCard[];
  containerRef: RefObject<HTMLDivElement | null>;
  dateRange: string;
  methodLabel: string;
  reportTotal: Record<string, unknown>;
  rows: PaymentMethodReportRow[];
  rowsLabel: string;
  title: string;
}) {
  const { t } = useTranslation();
  const rowMetrics = paymentMethodRowMetricConfigs(t);
  const totalMetrics = paymentMethodTotalMetricConfigs(t);

  return (
    <div ref={containerRef} className="report-print-surface">
      <div className="report-print-header">
        <div>
          <p className="report-print-kicker">{methodLabel}</p>
          <h1>{title}</h1>
        </div>
        <div className="report-print-meta">
          <span>{dateRange}</span>
          <span>{rowsLabel}</span>
        </div>
      </div>
      <div className="report-print-cards">
        {cards.map((card) => (
          <div key={card.key} className="report-print-card">
            <p>{card.label}</p>
            <strong>{displayMetric(card.value, card.valueType)}</strong>
          </div>
        ))}
      </div>
      <div className="report-print-section">
        <h2>{t("report.paymentMethodsReport.totalSummary")}</h2>
        <table className="report-print-table">
          <tbody>
            {totalMetrics.map((metric) => (
              <tr key={metric.key}>
                <td>{metric.label}</td>
                <td className="is-right">
                  {displayMetric(reportTotal[metric.key], metric.kind)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <table className="report-print-table">
        <thead>
          <tr>
            <th>{t("report.paymentMethodsReport.columns.paymentMethod")}</th>
            <th>
              {t("report.paymentMethodsReport.columns.paymentMethodCode")}
            </th>
            {rowMetrics.map((metric) => (
              <th key={metric.key} className="is-right">
                {metric.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.paymentMethodCode}-${row.sortOrder}`}>
              <td>{row.paymentMethodName}</td>
              <td>{row.paymentMethodCode}</td>
              {rowMetrics.map((metric) => (
                <td key={metric.key} className="is-right">
                  {displayMetric(row[metric.field], metric.kind)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

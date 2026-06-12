"use client";

import { type ReactNode, type RefObject, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Download,
  FileSpreadsheet,
  Printer,
  RefreshCcw,
  SlidersHorizontal
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAGE_LIMIT_OPTIONS, isAllPageLimit } from "@/lib/pagination";
import type { PaymentMethodReportFilter, PaymentMethodReportOrder } from "@/services/report";
import type { PaymentMethodOption, PaymentMethodReportRow, PaymentMethodSummaryCard } from "@/stores/report-store";
import type { PaymentMethodsExportAction, PaymentMethodsReportFilters } from "./payment-methods-report-types";
import {
  displayMetric,
  paymentMethodRowMetricConfigs,
  paymentMethodRowMetrics,
  paymentMethodTotalMetricConfigs
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
  reportTotal
}: {
  cards: PaymentMethodSummaryCard[];
  reportTotal: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const visibleCards = cards.length
    ? cards
    : paymentMethodTotalMetricConfigs(t)
        .slice(0, 4)
        .map((metric, index) => ({
          key: metric.key,
          label: metric.label,
          sortOrder: index + 1,
          value: Number(reportTotal[metric.key] ?? 0),
          valueType: metric.kind
        }));

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
      {visibleCards.map((card) => (
        <Card key={card.key} className="overflow-hidden border-border bg-card shadow-sm">
          <CardContent className="p-4">
            <p className="truncate text-xs font-black uppercase text-muted-foreground">{card.label}</p>
            <p className="mt-2 truncate text-xl font-black tabular-nums text-foreground">
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
  onDraftChange
}: FilterProps) {
  const { t } = useTranslation();

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardContent className="grid gap-3 p-4 lg:grid-cols-4 lg:items-end 2xl:grid-cols-[repeat(6,minmax(0,1fr))_auto]">
        <PaymentMethodsFilterFields
          branchLoading={branchLoading}
          branchLocked={branchLocked}
          branchOptions={branchOptions}
          draftFilters={draftFilters}
          idPrefix="payment-methods"
          methodOptions={methodOptions}
          onDraftChange={onDraftChange}
        />
        <Button type="button" className="h-9 min-w-28" disabled={loading || !canApply} onClick={onApply}>
          {loading ? <RefreshCcw className="animate-spin" data-icon="inline-start" /> : null}
          {t("report.apply")}
        </Button>
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
  onOpenChange
}: FilterProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88dvh] gap-0 overflow-hidden rounded-t-xl p-0 sm:hidden">
        <SheetHeader className="shrink-0 border-b border-border px-4 py-3 pr-12 text-left">
          <SheetTitle className="text-base font-black">{t("report.filters.currentFilters")}</SheetTitle>
          <SheetDescription>{t("report.paymentMethodsReport.title")}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 overflow-y-auto p-4">
          <div className="grid gap-3">
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
        <SheetFooter className="grid-cols-2 gap-2 border-t border-border bg-card/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur [display:grid]">
          <SheetClose asChild>
            <Button type="button" variant="outline">
              {t("actions.close")}
            </Button>
          </SheetClose>
          <Button type="button" disabled={loading || !canApply} onClick={onApply}>
            {loading ? <RefreshCcw className="animate-spin" data-icon="inline-start" /> : null}
            {t("report.apply")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function MobilePaymentMethodsFilterSummary({
  branchLabel,
  filters,
  methodLabel,
  onOpen
}: {
  branchLabel: string;
  filters: PaymentMethodsReportFilters;
  methodLabel: string;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const limitLabel = isAllPageLimit(filters.limit) ? t("common.all") : filters.limit;

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
            <Badge className="h-6 max-w-[11rem] truncate border-border bg-muted px-2 text-[11px] text-muted-foreground">
              {branchLabel}
            </Badge>
            <Badge className="h-6 max-w-[9rem] truncate px-2 text-[11px]">{methodLabel}</Badge>
            <Badge className="h-6 border-border bg-muted px-2 text-[11px] text-muted-foreground">
              {limitLabel}
            </Badge>
            <Badge className="h-6 border-border bg-muted px-2 text-[11px] text-muted-foreground">
              {filters.orderBy}
            </Badge>
          </div>
        </div>
        <Button type="button" size="sm" className="h-9 shrink-0 px-3" onClick={onOpen}>
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
  onDraftChange
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
      <Field className="gap-1.5">
        <FieldLabel htmlFor={`${idPrefix}-branch`} className="text-xs font-bold text-muted-foreground">
          {t("nav.branch")}
        </FieldLabel>
        <Select
          value={draftFilters.branchUuid}
          disabled={branchLoading || branchLocked || branchOptions.length <= 1}
          onValueChange={(value) => patch({ branchUuid: value })}
        >
          <SelectTrigger id={`${idPrefix}-branch`} className="w-full">
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
      <Field className="gap-1.5">
        <FieldLabel htmlFor={`${idPrefix}-date-from`} className="text-xs font-bold text-muted-foreground">
          {t("report.filters.dateFrom")}
        </FieldLabel>
        <Input
          id={`${idPrefix}-date-from`}
          type="date"
          value={draftFilters.dateFrom}
          onChange={(event) => patch({ dateFrom: event.target.value })}
        />
      </Field>
      <Field className="gap-1.5">
        <FieldLabel htmlFor={`${idPrefix}-date-to`} className="text-xs font-bold text-muted-foreground">
          {t("report.filters.dateTo")}
        </FieldLabel>
        <Input
          id={`${idPrefix}-date-to`}
          type="date"
          value={draftFilters.dateTo}
          onChange={(event) => patch({ dateTo: event.target.value })}
        />
      </Field>
      <Field className="gap-1.5">
        <FieldLabel htmlFor={`${idPrefix}-payment-method`} className="text-xs font-bold text-muted-foreground">
          {t("report.filters.paymentMethod")}
        </FieldLabel>
        <Select
          value={draftFilters.paymentMethod}
          onValueChange={(value) => patch({ paymentMethod: value as PaymentMethodReportFilter })}
        >
          <SelectTrigger id={`${idPrefix}-payment-method`} className="w-full">
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
      <Field className="gap-1.5">
        <FieldLabel htmlFor={`${idPrefix}-limit`} className="text-xs font-bold text-muted-foreground">
          {t("common.rowsPerPage")}
        </FieldLabel>
        <Select
          value={String(draftFilters.limit)}
          onValueChange={(value) => patch({ limit: value === "All" ? "All" : Number(value) })}
        >
          <SelectTrigger id={`${idPrefix}-limit`} className="w-full">
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
      <Field className="gap-1.5">
        <FieldLabel htmlFor={`${idPrefix}-order`} className="text-xs font-bold text-muted-foreground">
          {t("report.filters.orderBy")}
        </FieldLabel>
        <Select value={draftFilters.orderBy} onValueChange={(value) => patch({ orderBy: value as PaymentMethodReportOrder })}>
          <SelectTrigger id={`${idPrefix}-order`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="DESC">DESC</SelectItem>
              <SelectItem value="ASC">ASC</SelectItem>
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
  methodLabel: string;
  rangeLabel: string;
  rowsLength: number;
  title: string;
  onExportExcel: () => void;
  onExportPdf: () => void;
  onPrintReport: () => void;
  onRefresh: () => void;
};

export function PaymentMethodsTableCard({
  children,
  exportDisabled,
  exporting,
  footer,
  loading,
  methodLabel,
  rangeLabel,
  rowsLength,
  title,
  onExportExcel,
  onExportPdf,
  onPrintReport,
  onRefresh
}: TableCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="min-h-0 overflow-hidden border-border bg-card shadow-sm md:sticky md:top-[calc(var(--payment-method-filter-height)_+_0.75rem)] md:flex md:max-h-[calc(100dvh_-_var(--app-shell-header-height)_-_var(--payment-method-filter-height)_-_1.5rem)] md:flex-col">
      <CardHeader className="flex shrink-0 flex-col gap-2 border-b border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="flex min-w-0 items-center gap-2 text-base font-black">
            <CreditCard />
            <span className="truncate">{title}</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">{rangeLabel}</p>
          <Badge className="mt-2 h-7 w-fit px-2 text-xs">{methodLabel}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="h-9" disabled={exportDisabled} onClick={onExportExcel}>
            {exporting === "excel" ? (
              <RefreshCcw className="animate-spin" data-icon="inline-start" />
            ) : (
              <FileSpreadsheet data-icon="inline-start" />
            )}
            {t("report.exportExcel")}
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-9" disabled={exportDisabled} onClick={onExportPdf}>
            {exporting === "pdf" ? (
              <RefreshCcw className="animate-spin" data-icon="inline-start" />
            ) : (
              <Download data-icon="inline-start" />
            )}
            {t("report.exportPdf")}
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-9" disabled={exportDisabled} onClick={onPrintReport}>
            {exporting === "print" ? (
              <RefreshCcw className="animate-spin" data-icon="inline-start" />
            ) : (
              <Printer data-icon="inline-start" />
            )}
            {t("report.print")}
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-9" disabled={loading || Boolean(exporting)} onClick={onRefresh}>
            <RefreshCcw className={loading ? "animate-spin" : undefined} data-icon="inline-start" />
            {t("actions.refresh")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        {loading ? (
          <div className="p-4 md:min-h-[320px]">
            <LoadingState label={t("report.paymentMethodsReport.loading")} variant="table" />
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
            <EmptyState title={t("report.paymentMethodsReport.noData")} description={t("report.paymentMethodsReport.adjustFilters")} />
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
  colorClass: string;
  fields: Array<keyof PaymentMethodReportRow>;
};

const COLUMN_GROUPS: ColumnGroup[] = [
  {
    key: "bills",
    labelKey: "report.paymentMethodsReport.groups.bills",
    colorClass: "text-blue-500",
    fields: ["billsCount", "activeCount", "cancelledCount", "itemsCount", "qtyTotal"]
  },
  {
    key: "amount",
    labelKey: "report.paymentMethodsReport.groups.amount",
    colorClass: "text-emerald-500",
    fields: ["amount", "toppingTotal"]
  },
  {
    key: "discount",
    labelKey: "report.paymentMethodsReport.groups.discount",
    colorClass: "text-amber-500",
    fields: ["itemDiscount", "discountBill", "discountTotal"]
  },
  {
    key: "tax",
    labelKey: "report.paymentMethodsReport.groups.tax",
    colorClass: "text-purple-500",
    fields: ["serviceCharge", "vat", "total"]
  },
  {
    key: "payment",
    labelKey: "report.paymentMethodsReport.groups.payment",
    colorClass: "text-rose-500",
    fields: ["receiveCash", "receiveTransfer", "debtAmount", "changeAmount", "cancelledTotal"]
  }
];

export function PaymentMethodsTable({ rows }: { rows: PaymentMethodReportRow[] }) {
  const { t } = useTranslation();
  const allMetrics = paymentMethodRowMetricConfigs(t);
  // Map field -> metric config for quick lookup
  const metricByField = Object.fromEntries(allMetrics.map((m) => [m.field, m]));

  return (
    <div className="hidden min-w-0 md:block">
      <Table className="min-w-[1800px] text-[13px]">
        <TableHeader className="sticky top-0 z-20 bg-background/95 shadow-sm backdrop-blur">
          {/* Group header row */}
          <TableRow className="border-b-0">
            <TableHead className="w-[60px] border-b border-border bg-background/95" />
            <TableHead className="min-w-[200px] border-b border-border bg-background/95" />
            {COLUMN_GROUPS.map((group) => (
              <TableHead
                key={group.key}
                colSpan={group.fields.length}
                className={`border-b border-border bg-background/95 text-center text-[11px] font-black uppercase tracking-widest ${group.colorClass}`}
              >
                {t(group.labelKey, { defaultValue: group.key })}
              </TableHead>
            ))}
          </TableRow>
          {/* Column header row */}
          <TableRow>
            <TableHead className="w-[60px] whitespace-nowrap bg-background/95 text-center">
              {t("report.paymentMethodsReport.columns.rank")}
            </TableHead>
            <TableHead className="min-w-[200px] whitespace-nowrap bg-background/95">
              {t("report.paymentMethodsReport.columns.paymentMethod")}
            </TableHead>
            {COLUMN_GROUPS.flatMap((group) =>
              group.fields.map((field) => {
                const metric = metricByField[field];
                return (
                  <TableHead
                    key={field}
                    className="min-w-[110px] whitespace-nowrap bg-background/95 text-right text-[12px]"
                  >
                    {metric?.label ?? field}
                  </TableHead>
                );
              })
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow
              key={`${row.paymentMethodCode}-${row.rank}`}
              className={index % 2 === 1 ? "bg-muted/15" : undefined}
            >
              <TableCell className="whitespace-nowrap text-center">
                <Badge className="h-6 min-w-9 justify-center px-1.5 text-xs tabular-nums">#{row.rank}</Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <div>
                  <p className="font-black">{row.paymentMethodName}</p>
                  <p className="text-[11px] text-muted-foreground">{row.paymentMethodCode}</p>
                </div>
              </TableCell>
              {COLUMN_GROUPS.flatMap((group) =>
                group.fields.map((field) => {
                  const metric = metricByField[field];
                  return (
                    <TableCell key={field} className="whitespace-nowrap text-right tabular-nums">
                      {metric ? displayMetric(row[field], metric.kind) : String(row[field] ?? "-")}
                    </TableCell>
                  );
                })
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
  bgClass: string;
  borderClass: string;
  textClass: string;
  fields: Array<keyof PaymentMethodReportRow>;
};

const MOBILE_GROUPS: MobileSectionGroup[] = [
  {
    key: "bills",
    labelKey: "report.paymentMethodsReport.groups.bills",
    bgClass: "bg-blue-500/8",
    borderClass: "border-blue-500/20",
    textClass: "text-blue-600 dark:text-blue-400",
    fields: ["billsCount", "activeCount", "cancelledCount", "itemsCount", "qtyTotal"]
  },
  {
    key: "amount",
    labelKey: "report.paymentMethodsReport.groups.amount",
    bgClass: "bg-emerald-500/8",
    borderClass: "border-emerald-500/20",
    textClass: "text-emerald-600 dark:text-emerald-400",
    fields: ["amount", "toppingTotal"]
  },
  {
    key: "discount",
    labelKey: "report.paymentMethodsReport.groups.discount",
    bgClass: "bg-amber-500/8",
    borderClass: "border-amber-500/20",
    textClass: "text-amber-600 dark:text-amber-400",
    fields: ["itemDiscount", "discountBill", "discountTotal"]
  },
  {
    key: "tax",
    labelKey: "report.paymentMethodsReport.groups.tax",
    bgClass: "bg-purple-500/8",
    borderClass: "border-purple-500/20",
    textClass: "text-purple-600 dark:text-purple-400",
    fields: ["serviceCharge", "vat", "total"]
  },
  {
    key: "payment",
    labelKey: "report.paymentMethodsReport.groups.payment",
    bgClass: "bg-rose-500/8",
    borderClass: "border-rose-500/20",
    textClass: "text-rose-600 dark:text-rose-400",
    fields: ["receiveCash", "receiveTransfer", "debtAmount", "changeAmount", "cancelledTotal"]
  }
];

export function PaymentMethodsMobileList({ rows }: { rows: PaymentMethodReportRow[] }) {
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
        const key = `${row.paymentMethodCode}-${row.rank}`;
        const expanded = expandedKeys.has(key);
        return (
          <section key={key} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {/* Card header */}
            <div className="flex items-center justify-between gap-3 bg-muted/30 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge className="h-6 min-w-9 shrink-0 justify-center px-1.5 text-xs tabular-nums">#{row.rank}</Badge>
                  <h3 className="truncate text-sm font-black">{row.paymentMethodName}</h3>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{row.paymentMethodCode}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[11px] font-bold text-muted-foreground">{t("report.paymentMethodsReport.columns.total")}</p>
                <p className="text-base font-black tabular-nums text-foreground">{displayMetric(row.total, "money")}</p>
              </div>
            </div>

            {/* Quick stats always visible */}
            <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
              <div className="px-3 py-2 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {t("report.paymentMethodsReport.columns.billsCount")}
                </p>
                <p className="text-sm font-black tabular-nums">{row.billsCount}</p>
              </div>
              <div className="px-3 py-2 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {t("report.paymentMethodsReport.columns.amount")}
                </p>
                <p className="text-sm font-black tabular-nums">{displayMetric(row.amount, "money")}</p>
              </div>
              <div className="px-3 py-2 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {t("report.paymentMethodsReport.columns.receiveCash")}
                </p>
                <p className="text-sm font-black tabular-nums">{displayMetric(row.receiveCash, "money")}</p>
              </div>
            </div>

            {/* Expand toggle */}
            <button
              type="button"
              className="flex w-full items-center justify-center gap-1.5 border-b border-border py-2 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-muted/20"
              onClick={() => toggleExpand(key)}
            >
              {expanded ? (
                <>
                  <ChevronUp className="size-3.5" />
                  {t("actions.showLess", { defaultValue: "ຫຍໍ້ລາຍລະອຽດ" })}
                </>
              ) : (
                <>
                  <ChevronDown className="size-3.5" />
                  {t("actions.showMore", { defaultValue: "ລາຍລະອຽດທັງໝົດ" })}
                </>
              )}
            </button>

            {/* Expanded detail grouped by category */}
            {expanded && (
              <div className="divide-y divide-border">
                {MOBILE_GROUPS.map((group) => (
                  <div key={group.key} className={`p-3 ${group.bgClass}`}>
                    <p className={`mb-2 text-[10px] font-black uppercase tracking-widest ${group.textClass}`}>
                      {t(group.labelKey, { defaultValue: group.key })}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {group.fields.map((field) => {
                        const metric = metricByField[field];
                        return (
                          <div
                            key={field}
                            className={`min-w-0 rounded-lg border px-2.5 py-1.5 ${group.borderClass} bg-background/60`}
                          >
                            <p className="truncate text-[10px] font-bold text-muted-foreground">
                              {metric?.label ?? field}
                            </p>
                            <p className="truncate text-xs font-black tabular-nums text-foreground">
                              {metric ? displayMetric(row[field], metric.kind) : String(row[field] ?? "-")}
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

function MetricPill({
  kind,
  label,
  value
}: {
  kind: "money" | "number";
  label: string;
  value: unknown;
}) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-muted/20 px-2 py-1.5">
      <p className="truncate text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-xs font-black tabular-nums text-foreground">{displayMetric(value, kind)}</p>
    </div>
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
  title
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
                <td className="is-right">{displayMetric(reportTotal[metric.key], metric.kind)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <table className="report-print-table">
        <thead>
          <tr>
            <th>{t("report.paymentMethodsReport.columns.rank")}</th>
            <th>{t("report.paymentMethodsReport.columns.paymentMethod")}</th>
            <th>{t("report.paymentMethodsReport.columns.paymentMethodCode")}</th>
            {rowMetrics.map((metric) => (
              <th key={metric.key} className="is-right">
                {metric.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.paymentMethodCode}-${row.rank}`}>
              <td className="is-center">{row.rank}</td>
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

"use client";

import { Fragment, type ReactNode, type RefObject } from "react";
import {
  CalendarArrowDown,
  CalendarArrowUp,
  CalendarDays,
  CircleDollarSign,
  Download,
  FileSpreadsheet,
  ListOrdered,
  Printer,
  RefreshCcw,
  SlidersHorizontal,
  Trophy,
  type LucideIcon
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import { isBestSellingProductsSortBy, type BestSellingProductsSortBy } from "@/services/report";
import type { BestSellingProductGroup, BestSellingProductItem } from "@/stores/report-store";
import type {
  BestSellingExportAction,
  BestSellingOption,
  BestSellingProductsFilters,
  BestSellingSummaryCardConfig
} from "./best-selling-products-report-types";
import {
  bestSellingGroupMetricConfigs,
  bestSellingGroupMetrics,
  bestSellingProductMetricConfigs,
  bestSellingProductMetrics,
  bestSellingSortOptions,
  displayMetric,
  formatNumber,
  summaryValue
} from "./best-selling-products-report-utils";

const bestSellingSortIcons: Record<BestSellingProductsSortBy, LucideIcon> = {
  date_asc: CalendarArrowUp,
  date_desc: CalendarArrowDown,
  qty: ListOrdered,
  total: CircleDollarSign
};

type FilterProps = {
  branchLoading: boolean;
  branchLocked: boolean;
  branchOptions: BestSellingOption[];
  canApply: boolean;
  draftFilters: BestSellingProductsFilters;
  groupLoading: boolean;
  groupOptions: BestSellingOption[];
  loading: boolean;
  onApply: () => void;
  onDraftChange: (filters: BestSellingProductsFilters) => void;
};

export function BestSellingSummaryCards({
  cards,
  summary
}: {
  cards: BestSellingSummaryCardConfig[];
  summary: Record<string, unknown>;
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
      {cards.map((card) => {
        const value = summaryValue(summary, card.keys);
        return (
          <Card key={card.label} className="overflow-hidden border-border bg-card shadow-sm">
            <CardContent className="p-4">
              <p className="truncate text-xs font-black uppercase text-muted-foreground">{card.label}</p>
              <p className="mt-2 truncate text-xl font-black tabular-nums text-foreground">
                {displayMetric(value, card.kind)}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}

export function BestSellingFilterBar({
  branchLoading,
  branchLocked,
  branchOptions,
  canApply,
  draftFilters,
  groupLoading,
  groupOptions,
  loading,
  onApply,
  onDraftChange
}: FilterProps) {
  const { t } = useTranslation();

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardContent className="grid gap-3 p-4 lg:grid-cols-4 lg:items-end 2xl:grid-cols-[repeat(6,minmax(0,1fr))_auto]">
        <BestSellingFilterFields
          branchLoading={branchLoading}
          branchLocked={branchLocked}
          branchOptions={branchOptions}
          draftFilters={draftFilters}
          groupLoading={groupLoading}
          groupOptions={groupOptions}
          idPrefix="best-selling"
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

export function BestSellingFilterSheet({
  branchLoading,
  branchLocked,
  branchOptions,
  canApply,
  draftFilters,
  groupLoading,
  groupOptions,
  loading,
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
          <SheetDescription>{t("report.bestSelling.title")}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 overflow-y-auto p-4">
          <div className="grid gap-3">
            <BestSellingFilterFields
              branchLoading={branchLoading}
              branchLocked={branchLocked}
              branchOptions={branchOptions}
              draftFilters={draftFilters}
              groupLoading={groupLoading}
              groupOptions={groupOptions}
              idPrefix="best-selling-mobile"
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

export function MobileBestSellingFilterSummary({
  branchLabel,
  filters,
  groupLabel,
  onOpen,
  sortByLabel
}: {
  branchLabel: string;
  filters: BestSellingProductsFilters;
  groupLabel: string;
  onOpen: () => void;
  sortByLabel: string;
}) {
  const { t } = useTranslation();

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
            <Badge className="h-6 max-w-[10rem] truncate border-border bg-muted px-2 text-[11px] text-muted-foreground">
              {groupLabel}
            </Badge>
            <Badge className="h-6 px-2 text-[11px]">{sortByLabel}</Badge>
            <Badge className="h-6 border-border bg-muted px-2 text-[11px] text-muted-foreground">
              {filters.limit === "All" ? t("common.all") : filters.limit}
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

function BestSellingFilterFields({
  branchLoading,
  branchLocked,
  branchOptions,
  draftFilters,
  groupLoading,
  groupOptions,
  idPrefix,
  onDraftChange
}: {
  branchLoading: boolean;
  branchLocked: boolean;
  branchOptions: BestSellingOption[];
  draftFilters: BestSellingProductsFilters;
  groupLoading: boolean;
  groupOptions: BestSellingOption[];
  idPrefix: string;
  onDraftChange: (filters: BestSellingProductsFilters) => void;
}) {
  const { t } = useTranslation();
  const sortOptions = bestSellingSortOptions(t);

  function patch(patch: Partial<BestSellingProductsFilters>) {
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
        <FieldLabel htmlFor={`${idPrefix}-group`} className="text-xs font-bold text-muted-foreground">
          {t("report.bestSelling.filters.group")}
        </FieldLabel>
        <Select
          value={draftFilters.groupUuid}
          disabled={groupLoading || !groupOptions.length}
          onValueChange={(value) => patch({ groupUuid: value })}
        >
          <SelectTrigger id={`${idPrefix}-group`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {groupOptions.map((group) => (
                <SelectItem key={group.value} value={group.value}>
                  {group.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field className="gap-1.5">
        <FieldLabel className="text-xs font-bold text-muted-foreground">
          {t("report.bestSelling.filters.sortBy")}
        </FieldLabel>
        <ToggleGroup
          type="single"
          value={draftFilters.sortBy}
          variant="outline"
          size="sm"
          spacing={1}
          className="grid w-full grid-cols-2 gap-1 2xl:grid-cols-4"
          onValueChange={(value) => {
            if (isBestSellingProductsSortBy(value)) patch({ sortBy: value });
          }}
        >
          {sortOptions.map((option) => {
            const Icon = bestSellingSortIcons[option.value];
            return (
              <ToggleGroupItem key={option.value} value={option.value} className="min-w-0 justify-center px-2">
                <Icon />
                <span className="truncate">{option.label}</span>
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
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
    </>
  );
}

type TableCardProps = {
  children: ReactNode;
  exportDisabled: boolean;
  exporting: BestSellingExportAction | null;
  footer: ReactNode;
  loading: boolean;
  rangeLabel: string;
  rowsLength: number;
  sortByLabel: string;
  onExportExcel: () => void;
  onExportPdf: () => void;
  onPrintReport: () => void;
  onRefresh: () => void;
};

export function BestSellingTableCard({
  children,
  exportDisabled,
  exporting,
  footer,
  loading,
  rangeLabel,
  rowsLength,
  sortByLabel,
  onExportExcel,
  onExportPdf,
  onPrintReport,
  onRefresh
}: TableCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="min-h-0 overflow-hidden border-border bg-card shadow-sm md:sticky md:top-[calc(var(--best-selling-filter-height)_+_0.75rem)] md:flex md:max-h-[calc(100dvh_-_var(--app-shell-header-height)_-_var(--best-selling-filter-height)_-_1.5rem)] md:flex-col">
      <CardHeader className="shrink-0 flex flex-col gap-2 border-b border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="flex min-w-0 items-center gap-2 text-base font-black">
            <Trophy />
            <span className="truncate">{t("report.bestSelling.tableTitle")}</span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">{rangeLabel}</p>
          <Badge className="mt-2 h-7 w-fit px-2 text-xs">{sortByLabel}</Badge>
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
            <LoadingState label={t("report.bestSelling.loading")} variant="table" />
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
            <EmptyState title={t("report.bestSelling.noData")} description={t("report.bestSelling.adjustFilters")} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function BestSellingProductsTable({ groups }: { groups: BestSellingProductGroup[] }) {
  const { t } = useTranslation();
  const productMetrics = bestSellingProductMetricConfigs(t);
  const groupMetrics = bestSellingGroupMetricConfigs(t);

  return (
    <div className="hidden min-w-0 md:block">
      <Table className="min-w-[1880px] text-[13px]">
        <TableHeader className="sticky top-0 z-20 bg-background/95 shadow-sm backdrop-blur">
          <TableRow>
            <TableHead className="w-[90px] whitespace-nowrap bg-background/95 text-center">
              {t("report.bestSelling.columns.rank")}
            </TableHead>
            <TableHead className="min-w-[260px] whitespace-nowrap bg-background/95">
              {t("report.bestSelling.columns.product")}
            </TableHead>
            <TableHead className="min-w-[140px] whitespace-nowrap bg-background/95">
              {t("report.bestSelling.columns.productCode")}
            </TableHead>
            <TableHead className="min-w-[140px] whitespace-nowrap bg-background/95">
              {t("report.bestSelling.columns.category")}
            </TableHead>
            <TableHead className="min-w-[160px] whitespace-nowrap bg-background/95">
              {t("report.bestSelling.columns.group")}
            </TableHead>
            {productMetrics.map((metric) => (
              <TableHead key={metric.key} className="min-w-[130px] whitespace-nowrap bg-background/95 text-right">
                {metric.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => (
            <Fragment key={group.id}>
              <TableRow className="border-b border-border/80 bg-muted/25 hover:bg-muted/25">
                <TableCell colSpan={5} className="py-3">
                  <div className="min-w-0">
                    <p className="truncate font-black text-foreground">{group.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("report.bestSelling.groupSummary", {
                        products: group.productCount,
                        qty: formatNumber(group.qtyTotal)
                      })}
                    </p>
                  </div>
                </TableCell>
                {productMetrics.map((metric) => {
                  const groupMetric = groupMetrics.find((item) => item.key === metric.key);
                  return (
                    <TableCell key={metric.key} className="whitespace-nowrap text-right font-black tabular-nums">
                      {groupMetric ? displayMetric(group[groupMetric.field], groupMetric.kind) : "-"}
                    </TableCell>
                  );
                })}
              </TableRow>
              {group.items.map((item, index) => (
                <BestSellingProductRow key={item.id} item={item} index={index} />
              ))}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function BestSellingProductRow({ item, index }: { item: BestSellingProductItem; index: number }) {
  const { t } = useTranslation();
  const metrics = bestSellingProductMetrics(item, t);

  return (
    <TableRow className={cn("border-b border-border/80", index % 2 === 1 && "bg-muted/15")}>
      <TableCell className="whitespace-nowrap text-center">
        <Badge className="h-7 min-w-10 justify-center px-2 text-xs tabular-nums">#{item.rank}</Badge>
      </TableCell>
      <TableCell className="max-w-[360px] whitespace-normal py-3">
        <p className="font-semibold leading-snug text-foreground">{item.productName}</p>
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">{item.productCode}</TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">{item.categoryName}</TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">{item.groupName}</TableCell>
      {metrics.map((metric) => (
        <TableCell key={metric.key} className="whitespace-nowrap text-right font-black tabular-nums">
          {displayMetric(metric.value, metric.kind)}
        </TableCell>
      ))}
    </TableRow>
  );
}

export function BestSellingProductsMobileList({ groups }: { groups: BestSellingProductGroup[] }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3 p-3 md:hidden">
      {groups.map((group) => (
        <section key={group.id} className="rounded-md border border-border bg-background">
          <div className="border-b border-border bg-muted/25 p-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-black">{group.name}</h3>
              <p className="text-xs text-muted-foreground">
                {t("report.bestSelling.groupSummary", {
                  products: group.productCount,
                  qty: formatNumber(group.qtyTotal)
                })}
              </p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {bestSellingGroupMetrics(group, t).map((metric) => (
                <MetricPill key={metric.key} label={metric.label} value={metric.value} kind={metric.kind} />
              ))}
            </div>
          </div>
          <div className="flex flex-col">
            {group.items.map((item) => (
              <div key={item.id} className="flex items-start gap-3 border-b border-border/70 p-3 last:border-b-0">
                <Badge className="h-7 min-w-10 justify-center px-2 text-xs tabular-nums">#{item.rank}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug text-foreground">{item.productName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.productCode} / {item.categoryName} / {item.groupName}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    {bestSellingProductMetrics(item, t).map((metric) => (
                      <MetricPill key={metric.key} label={metric.label} value={metric.value} kind={metric.kind} />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
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
    <div className="min-w-0 rounded-md border border-border bg-muted/20 px-2 py-1">
      <p className="truncate text-[11px] font-bold text-muted-foreground">{label}</p>
      <p className="truncate font-black tabular-nums text-foreground">{displayMetric(value, kind)}</p>
    </div>
  );
}

export function BestSellingExportSurface({
  cards,
  containerRef,
  dateRange,
  groups,
  rows,
  rowsLabel,
  sortByLabel,
  summary,
  title
}: {
  cards: BestSellingSummaryCardConfig[];
  containerRef: RefObject<HTMLDivElement | null>;
  dateRange: string;
  groups: BestSellingProductGroup[];
  rows: BestSellingProductItem[];
  rowsLabel: string;
  sortByLabel: string;
  summary: Record<string, unknown>;
  title: string;
}) {
  const { t } = useTranslation();
  const groupMetrics = bestSellingGroupMetricConfigs(t);
  const productMetrics = bestSellingProductMetricConfigs(t);

  return (
    <div ref={containerRef} className="report-print-surface">
      <div className="report-print-header">
        <div>
          <p className="report-print-kicker">{sortByLabel}</p>
          <h1>{title}</h1>
        </div>
        <div className="report-print-meta">
          <span>{dateRange}</span>
          <span>{rowsLabel}</span>
        </div>
      </div>
      <div className="report-print-cards">
        {cards.map((card) => (
          <div key={card.label} className="report-print-card">
            <p>{card.label}</p>
            <strong>{displayMetric(summaryValue(summary, card.keys), card.kind)}</strong>
          </div>
        ))}
      </div>
      <div className="report-print-section">
        <h2>{t("report.bestSelling.groupsTitle")}</h2>
        <table className="report-print-table">
          <thead>
            <tr>
              <th>{t("fields.no")}</th>
              <th>{t("report.bestSelling.columns.group")}</th>
              <th className="is-right">{t("report.bestSelling.cards.productCount")}</th>
              {groupMetrics.map((metric) => (
                <th key={metric.key} className="is-right">
                  {metric.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group, index) => (
              <tr key={group.id}>
                <td className="is-center">{index + 1}</td>
                <td>{group.name}</td>
                <td className="is-right">{formatNumber(group.productCount)}</td>
                {groupMetrics.map((metric) => (
                  <td key={metric.key} className="is-right">
                    {displayMetric(group[metric.field], metric.kind)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <table className="report-print-table">
        <thead>
          <tr>
            <th>{t("report.bestSelling.columns.rank")}</th>
            <th>{t("report.bestSelling.columns.product")}</th>
            <th>{t("report.bestSelling.columns.productCode")}</th>
            <th>{t("report.bestSelling.columns.category")}</th>
            <th>{t("report.bestSelling.columns.group")}</th>
            {productMetrics.map((metric) => (
              <th key={metric.key} className="is-right">
                {metric.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="is-center">{row.rank}</td>
              <td>{row.productName}</td>
              <td>{row.productCode}</td>
              <td>{row.categoryName}</td>
              <td>{row.groupName}</td>
              {productMetrics.map((metric) => (
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

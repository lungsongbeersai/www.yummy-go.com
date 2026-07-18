"use client";

import {
  Fragment,
  memo,
  useCallback,
  useMemo,
  type ReactNode,
  type RefObject,
} from "react";
import {
  CalendarArrowDown,
  CalendarArrowUp,
  ChevronDown,
  CircleDollarSign,
  Download,
  FileSpreadsheet,
  ListOrdered,
  RefreshCcw,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ReportOfficialHeader,
  ReportSignatures,
} from "../report-official-layout";
import {
  ReportApplyButton,
  ReportFilterSheet,
  ReportMobileFilterSummary,
} from "../shared/report-filter-shell";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import {
  isBestSellingProductsSortBy,
  type BestSellingProductsSortBy,
} from "@/config/report-filters";
import type {
  BestSellingProductGroup,
  BestSellingProductItem,
} from "@/stores/report-store";
import { SortableReportTableHead } from "../report-sort-table-head";
import {
  ReportIndeterminateCheckbox,
  selectionStateForVisibleIds,
} from "../report-row-selection";
import {
  sortRowsLocally,
  useLocalTableSort
} from "../report-sort-utils";
import type {
  BestSellingExportAction,
  BestSellingOption,
  BestSellingProductsFilters,
  BestSellingSummaryCardConfig,
} from "./best-selling-products-report-types";
import {
  bestSellingGroupMetricConfigs,
  bestSellingGroupMetrics,
  bestSellingProductRowId,
  bestSellingProductMetricConfigs,
  bestSellingProductMetrics,
  bestSellingSummaryConfigs,
  bestSellingSortOptions,
  displayMetric,
  formatNumber,
  firstNumber,
  summaryValue,
} from "./best-selling-products-report-utils";

const bestSellingSortIcons: Record<BestSellingProductsSortBy, LucideIcon> = {
  date_asc: CalendarArrowUp,
  date_desc: CalendarArrowDown,
  qty: ListOrdered,
  total: CircleDollarSign,
};

type BestSellingSortKey = keyof BestSellingProductItem;

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
  summary,
}: {
  cards: BestSellingSummaryCardConfig[];
  summary: Record<string, unknown>;
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
      {cards.map((card) => {
        const value = summaryValue(summary, card.keys);
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
                {displayMetric(value, card.kind)}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}

function summaryCardTone(card: BestSellingSummaryCardConfig) {
  if (card.keys.some((key) => key.includes("discount"))) return "danger";
  if (card.kind === "money") return "primary";
  return "neutral";
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
  onDraftChange,
}: FilterProps) {
  return (
    <Card className="min-w-0 border-border bg-card shadow-sm">
      <CardContent className="p-3 sm:p-4">
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
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
          <div className="flex items-end sm:col-span-2 lg:col-span-12 xl:col-span-2">
            <ReportApplyButton
              canApply={canApply}
              className="h-9 w-full min-w-28"
              loading={loading}
              onApply={onApply}
            />
          </div>
        </div>
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
  onOpenChange,
}: FilterProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <ReportFilterSheet
      canApply={canApply}
      description={t("report.bestSelling.title")}
      gridClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-12"
      loading={loading}
      open={open}
      onApply={onApply}
      onOpenChange={onOpenChange}
    >
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
    </ReportFilterSheet>
  );
}

export function MobileBestSellingFilterSummary({
  branchLabel,
  filters,
  groupLabel,
  onOpen,
  sortByLabel,
}: {
  branchLabel: string;
  filters: BestSellingProductsFilters;
  groupLabel: string;
  onOpen: () => void;
  sortByLabel: string;
}) {
  const { t } = useTranslation();
  const dateRangeLabel = `${filters.dateFrom} - ${filters.dateTo}`;

  return (
    <ReportMobileFilterSummary dateRangeLabel={dateRangeLabel} onOpen={onOpen}
      badges={
        <>
          <Badge className="h-6 max-w-44 truncate border-border bg-muted px-2 text-[11px] text-muted-foreground">
            {branchLabel}
          </Badge>
          <Badge className="h-6 max-w-40 truncate border-border bg-muted px-2 text-[11px] text-muted-foreground">
            {groupLabel}
          </Badge>
          <Badge className="h-6 px-2 text-[11px]">{sortByLabel}</Badge>
          <Badge className="h-6 border-border bg-muted px-2 text-[11px] text-muted-foreground">
            {filters.limit === "All" ? t("common.all") : filters.limit}
          </Badge>
        </>
      }
    />
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
  onDraftChange,
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

  function patch(patch: Partial<BestSellingProductsFilters>) {
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
          htmlFor={`${idPrefix}-group`}
          className="text-xs font-bold text-muted-foreground"
        >
          {t("report.bestSelling.filters.group")}
        </FieldLabel>
        <Select
          value={draftFilters.groupUuid}
          disabled={groupLoading || !groupOptions.length}
          onValueChange={(value) => patch({ groupUuid: value })}
        >
          <SelectTrigger id={`${idPrefix}-group`} className="h-10 w-full rounded-md">
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
  exporting: BestSellingExportAction | null;
  footer: ReactNode;
  loading: boolean;
  rowsLength: number;
  selectedCount: number;
  sortBy: BestSellingProductsSortBy;
  sortByLabel: string;
  onClearSelection: () => void;
  onExportExcel: () => void;
  onExportPdf: () => void;
  onRefresh: () => void;
  onSortByChange: (sortBy: BestSellingProductsSortBy) => void;
};

export function BestSellingTableCard({
  children,
  exportDisabled,
  exporting,
  footer,
  loading,
  rowsLength,
  selectedCount,
  sortBy,
  sortByLabel,
  onClearSelection,
  onExportExcel,
  onExportPdf,
  onRefresh,
  onSortByChange,
}: TableCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-border bg-card shadow-sm">
      <CardHeader className="shrink-0 border-b border-border bg-card/95 px-2 py-2 sm:px-3">
        <div className="grid w-full min-w-0 grid-cols-1 items-center gap-2 2xl:grid-cols-[minmax(180px,16rem)_minmax(0,1fr)_auto]">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <Trophy aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate text-sm font-black">
                {t("report.bestSelling.tableTitle")}
              </CardTitle>
              {selectedCount > 0 ? (
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
              ) : null}
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 2xl:col-start-3 2xl:flex-nowrap">
            <BestSellingSortDropdown
              disabled={loading || Boolean(exporting)}
              sortBy={sortBy}
              sortByLabel={sortByLabel}
              onSortByChange={onSortByChange}
            />
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
      <CardContent
        aria-busy={loading}
        className="flex min-h-0 flex-1 flex-col p-0"
      >
        {loading && !rowsLength ? (
          <div className="min-h-80 p-4">
            <LoadingState
              label={t("report.bestSelling.loading")}
              variant="reportTable"
            />
          </div>
        ) : rowsLength ? (
          <>
            <div className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-x-contain overscroll-y-auto">
              {children}
            </div>
            <div className="shrink-0 bg-card">{footer}</div>
          </>
        ) : (
          <div className="min-h-80 p-4">
            <EmptyState
              title={t("report.bestSelling.noData")}
              description={t("report.bestSelling.adjustFilters")}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BestSellingSortDropdown({
  disabled,
  sortBy,
  sortByLabel,
  onSortByChange,
}: {
  disabled: boolean;
  sortBy: BestSellingProductsSortBy;
  sortByLabel: string;
  onSortByChange: (sortBy: BestSellingProductsSortBy) => void;
}) {
  const { t } = useTranslation();
  const sortOptions = bestSellingSortOptions(t);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={t("report.bestSelling.filters.sortBy")}
          className="h-9 min-w-0 max-w-full rounded-md px-2.5"
          disabled={disabled}
        >
          <ListOrdered data-icon="inline-start" />
          <span className="min-w-0 max-w-32 truncate sm:max-w-40">
            {sortByLabel}
          </span>
          <ChevronDown data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="px-2 py-1.5 text-xs font-black uppercase text-muted-foreground">
          {t("report.bestSelling.filters.sortBy")}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={sortBy}
          onValueChange={(value) => {
            if (isBestSellingProductsSortBy(value)) onSortByChange(value);
          }}
        >
          {sortOptions.map((option) => {
            const Icon = bestSellingSortIcons[option.value];
            return (
              <DropdownMenuRadioItem
                key={option.value}
                value={option.value}
                className="min-w-0"
              >
                <Icon aria-hidden="true" />
                <span className="min-w-0 truncate">{option.label}</span>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function BestSellingProductsTable({
  groups,
  selectedRowIds,
  summary,
  onToggleRow,
  onToggleRows,
}: {
  groups: BestSellingProductGroup[];
  selectedRowIds: Set<string>;
  summary: Record<string, unknown>;
  onToggleRow: (row: BestSellingProductItem, selected: boolean) => void;
  onToggleRows: (rows: BestSellingProductItem[], selected: boolean) => void;
}) {
  const { t } = useTranslation();
  const productMetrics = useMemo(
    () => bestSellingProductMetricConfigs(t),
    [t],
  );
  const groupMetrics = useMemo(
    () => bestSellingGroupMetricConfigs(t),
    [t],
  );
  const summaryCards = useMemo(() => bestSellingSummaryConfigs(t), [t]);
  const groupMetricByKey = useMemo(
    () => new Map(groupMetrics.map((metric) => [metric.key, metric])),
    [groupMetrics],
  );
  const getGroupSortValue = useCallback(
    (group: BestSellingProductGroup, key: BestSellingSortKey) => {
      if (key === "groupName") return group.name;
      const groupMetric = groupMetrics.find((metric) => metric.field === key);
      if (groupMetric) return group[groupMetric.field];
      return group.items[0]?.[key];
    },
    [groupMetrics],
  );
  const { sort, sortedRows: sortedGroups, toggleSort } = useLocalTableSort(
    groups,
    getGroupSortValue,
  );
  const sortedGroupRows = useMemo(
    () =>
      sortedGroups.map((group) => ({
        group,
        rows: sortRowsLocally(group.items, sort, (item, key) => item[key]),
      })),
    [sort, sortedGroups],
  );
  const visibleRows = useMemo(
    () => sortedGroupRows.flatMap(({ rows }) => rows),
    [sortedGroupRows],
  );
  const visibleIds = useMemo(
    () => visibleRows.map(bestSellingProductRowId),
    [visibleRows],
  );
  const { allVisibleSelected, someVisibleSelected } =
    selectionStateForVisibleIds(visibleIds, selectedRowIds);

  return (
    <div className="hidden w-full min-w-0 md:block">
      <Table className="w-max min-w-full table-auto text-xs">
        <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-30 [&_th]:h-9 [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-border [&_th]:bg-muted/80 [&_th]:px-2 [&_th]:shadow-sm [&_th]:backdrop-blur">
          <TableRow>
            <TableHead className="w-10 text-center">
              <ReportIndeterminateCheckbox
                aria-label={t("common.selectAll")}
                checked={allVisibleSelected}
                indeterminate={!allVisibleSelected && someVisibleSelected}
                onChange={(event) =>
                  onToggleRows(visibleRows, event.target.checked)
                }
              />
            </TableHead>
            <SortableReportTableHead
              align="right"
              sort={sort}
              sortKey="rank"
              className="w-16 text-center"
              onSort={toggleSort}
            >
              {t("report.bestSelling.columns.rank")}
            </SortableReportTableHead>
            <SortableReportTableHead
              sort={sort}
              sortKey="productName"
              className="min-w-60"
              onSort={toggleSort}
            >
              {t("report.bestSelling.columns.product")}
            </SortableReportTableHead>
            <SortableReportTableHead
              sort={sort}
              sortKey="productCode"
              className="min-w-32"
              onSort={toggleSort}
            >
              {t("report.bestSelling.columns.productCode")}
            </SortableReportTableHead>
            <SortableReportTableHead
              sort={sort}
              sortKey="categoryName"
              className="min-w-32"
              onSort={toggleSort}
            >
              {t("report.bestSelling.columns.category")}
            </SortableReportTableHead>
            {/* <SortableReportTableHead
              sort={sort}
              sortKey="groupName"
              className="min-w-36"
              onSort={toggleSort}
            >
              {t("report.bestSelling.columns.group")}
            </SortableReportTableHead> */}
            {productMetrics.map((metric) => (
              <SortableReportTableHead
                key={metric.key}
                align="right"
                sort={sort}
                sortKey={metric.field}
                className="min-w-30 text-right"
                onSort={toggleSort}
              >
                {metric.label}
              </SortableReportTableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedGroupRows.map(({ group, rows: groupRows }) => {
            const groupIds = groupRows.map(bestSellingProductRowId);
            const groupSelection = selectionStateForVisibleIds(
              groupIds,
              selectedRowIds,
            );

            return (
              <Fragment key={group.id}>
              <TableRow className="border-b border-border/80 bg-muted/25 hover:bg-muted/25">
                <TableCell className="w-10 text-center">
                  <ReportIndeterminateCheckbox
                    aria-label={t("common.selectRow", { name: group.name })}
                    checked={groupSelection.allVisibleSelected}
                    indeterminate={
                      !groupSelection.allVisibleSelected &&
                      groupSelection.someVisibleSelected
                    }
                    onChange={(event) =>
                      onToggleRows(groupRows, event.target.checked)
                    }
                  />
                </TableCell>
                <TableCell colSpan={4} className="px-2 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-black text-foreground">
                      {group.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("report.bestSelling.groupSummary", {
                        products: group.productCount,
                        qty: formatNumber(group.qtyTotal),
                      })}
                    </p>
                  </div>
                </TableCell>
                {productMetrics.map((metric) => {
                  const groupMetric = groupMetricByKey.get(metric.key);
                  return (
                    <TableCell
                      key={metric.key}
                      className={metricValueClass(
                        groupMetric ? Number(group[groupMetric.field] ?? 0) : null,
                        metric.key,
                        true,
                      )}
                    >
                      {groupMetric
                        ? displayMetric(
                            group[groupMetric.field],
                            groupMetric.kind,
                          )
                        : "-"}
                    </TableCell>
                  );
                })}
              </TableRow>
              {groupRows.map((item, index) => (
                <BestSellingProductRow
                  key={item.id}
                  item={item}
                  index={index}
                  metrics={productMetrics}
                  rank={index + 1}
                  selectLabel={t("common.selectRow", {
                    name: item.productName,
                  })}
                  selected={selectedRowIds.has(bestSellingProductRowId(item))}
                  onToggleRow={onToggleRow}
                />
              ))}
              </Fragment>
            );
          })}
        </TableBody>
        <tfoot className="sticky bottom-0 z-20">
          <BestSellingSummaryFooterRow
            productMetrics={productMetrics}
            summary={summary}
            summaryCards={summaryCards}
            summaryLabel={t("report.summary")}
          />
        </tfoot>
      </Table>
    </div>
  );
}

const BestSellingProductRow = memo(function BestSellingProductRow({
  item,
  index,
  metrics,
  rank,
  selectLabel,
  selected,
  onToggleRow,
}: {
  item: BestSellingProductItem;
  index: number;
  metrics: ReturnType<typeof bestSellingProductMetricConfigs>;
  rank: number;
  selectLabel: string;
  selected: boolean;
  onToggleRow: (row: BestSellingProductItem, selected: boolean) => void;
}) {
  return (
    <TableRow
      className={cn(
        "h-9 border-b border-border/80",
        index % 2 === 1 && "bg-muted/15",
        selected && "bg-primary/5 hover:bg-primary/10",
      )}
    >
      <TableCell className="w-10 text-center">
        <Checkbox
          aria-label={selectLabel}
          checked={selected}
          onChange={(event) => onToggleRow(item, event.target.checked)}
        />
      </TableCell>
      <TableCell className="whitespace-nowrap px-2 py-2 text-center">
        <Badge className="h-6 min-w-9 justify-center px-2 text-xs tabular-nums">
          #{rank}
        </Badge>
      </TableCell>
      <TableCell className="max-w-80 whitespace-normal px-2 py-2">
        <p className="font-semibold leading-snug text-foreground">
          {item.productName}
        </p>
      </TableCell>
      <TableCell className="whitespace-nowrap px-2 py-2 text-muted-foreground">
        {item.productCode}
      </TableCell>
      <TableCell className="whitespace-nowrap px-2 py-2 text-muted-foreground">
        {item.categoryName}
      </TableCell>
      {/* <TableCell className="whitespace-nowrap px-2 py-2 text-muted-foreground">
        {item.groupName}
      </TableCell> */}
      {metrics.map((metric) => (
        <TableCell
          key={metric.key}
          className={metricValueClass(item[metric.field], metric.key)}
        >
          {displayMetric(item[metric.field], metric.kind)}
        </TableCell>
      ))}
    </TableRow>
  );
});

function BestSellingSummaryFooterRow({
  productMetrics,
  summary,
  summaryCards,
  summaryLabel,
}: {
  productMetrics: ReturnType<typeof bestSellingProductMetricConfigs>;
  summary: Record<string, unknown>;
  summaryCards: BestSellingSummaryCardConfig[];
  summaryLabel: string;
}) {
  const { t } = useTranslation();
  const productCount = firstNumber(
    summaryValue(summary, ["product_count", "products_count"]),
  );

  return (
    <TableRow className="border-t border-primary/25 bg-primary/5 hover:bg-primary/10">
      <TableCell className={summaryFooterCellClass("left")} colSpan={5}>
        <div className="flex min-w-64 items-center gap-2">
          <span className="inline-flex h-6 items-center rounded-full bg-background/80 px-2 text-xs font-black uppercase text-primary ring-1 ring-primary/20">
            {summaryLabel}
          </span>
          {productCount > 0 ? (
            <span className="truncate text-xs font-semibold text-muted-foreground">
              {t("report.bestSelling.rowsLabel", { count: productCount })}
            </span>
          ) : null}
        </div>
      </TableCell>
      {productMetrics.map((metric) => (
        <BestSellingSummaryMetricCell
          key={metric.key}
          metricKey={metric.key}
          kind={metric.kind}
          summary={summary}
          summaryCards={summaryCards}
        />
      ))}
    </TableRow>
  );
}

function BestSellingSummaryMetricCell({
  kind,
  metricKey,
  summary,
  summaryCards,
}: {
  kind: "money" | "number";
  metricKey: string;
  summary: Record<string, unknown>;
  summaryCards: BestSellingSummaryCardConfig[];
}) {
  const card = summaryCards.find((summaryCard) =>
    summaryCard.keys.includes(metricKey),
  );

  if (!card) return <TableCell className={summaryFooterCellClass()} />;

  const value = summaryValue(summary, card.keys);
  return (
    <TableCell className={summaryMetricCellClass(value, metricKey)}>
      {displayMetric(value, kind)}
    </TableCell>
  );
}

function metricValueClass(value: unknown, key: string, strong = false) {
  const numericValue = value === null ? null : firstNumber(value);

  return cn(
    "whitespace-nowrap px-2 py-2 text-right font-semibold tabular-nums",
    strong && "font-black",
    numericValue === 0 && "text-muted-foreground",
    key.includes("discount") &&
      numericValue !== null &&
      numericValue > 0 &&
      "font-black text-destructive",
    key === "final_total" && "font-black text-foreground",
  );
}

function summaryMetricCellClass(value: unknown, key: string) {
  return cn(
    summaryFooterCellClass("right"),
    "font-semibold",
    firstNumber(value) === 0 && "text-muted-foreground",
    key.includes("discount") && firstNumber(value) > 0 && "font-black text-destructive",
    key === "final_total" && "font-black text-foreground",
  );
}

function summaryFooterCellClass(align: "left" | "right" = "left") {
  return cn(
    "sticky bottom-0 z-20 h-10 whitespace-nowrap border-t border-primary/25 bg-primary/10 px-2 py-2 backdrop-blur supports-[backdrop-filter]:bg-primary/10",
    align === "right" ? "text-right tabular-nums" : "text-left",
  );
}

export function BestSellingProductsMobileList({
  groups,
  selectedRowIds,
  onToggleRow,
  onToggleRows,
}: {
  groups: BestSellingProductGroup[];
  selectedRowIds: Set<string>;
  onToggleRow: (row: BestSellingProductItem, selected: boolean) => void;
  onToggleRows: (rows: BestSellingProductItem[], selected: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3 p-3 md:hidden">
      {groups.map((group) => (
        <section
          key={group.id}
          className="rounded-md border border-border bg-background"
        >
          <div className="border-b border-border bg-muted/25 p-3">
            <div className="flex items-start gap-3">
              <ReportIndeterminateCheckbox
                aria-label={t("common.selectRow", { name: group.name })}
                className="mt-0.5"
                checked={
                  selectionStateForVisibleIds(
                    group.items.map(bestSellingProductRowId),
                    selectedRowIds,
                  ).allVisibleSelected
                }
                indeterminate={
                  !selectionStateForVisibleIds(
                    group.items.map(bestSellingProductRowId),
                    selectedRowIds,
                  ).allVisibleSelected &&
                  selectionStateForVisibleIds(
                    group.items.map(bestSellingProductRowId),
                    selectedRowIds,
                  ).someVisibleSelected
                }
                onChange={(event) =>
                  onToggleRows(group.items, event.target.checked)
                }
              />
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-black">{group.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {t("report.bestSelling.groupSummary", {
                    products: group.productCount,
                    qty: formatNumber(group.qtyTotal),
                  })}
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {bestSellingGroupMetrics(group, t).map((metric) => (
                <MetricPill
                  key={metric.key}
                  label={metric.label}
                  value={metric.value}
                  kind={metric.kind}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-col">
            {group.items.map((item, index) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-start gap-3 border-b border-border/70 p-3 last:border-b-0",
                  selectedRowIds.has(bestSellingProductRowId(item)) &&
                    "bg-primary/5",
                )}
              >
                <Checkbox
                  aria-label={t("common.selectRow", { name: item.productName })}
                  checked={selectedRowIds.has(bestSellingProductRowId(item))}
                  onChange={(event) => onToggleRow(item, event.target.checked)}
                />
                <Badge className="h-7 min-w-10 justify-center px-2 text-xs tabular-nums">
                  #{index + 1}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug text-foreground">
                    {item.productName}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.productCode} / {item.categoryName} / {item.groupName}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    {bestSellingProductMetrics(item, t).map((metric) => (
                      <MetricPill
                        key={metric.key}
                        label={metric.label}
                        value={metric.value}
                        kind={metric.kind}
                      />
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
  value,
}: {
  kind: "money" | "number";
  label: string;
  value: unknown;
}) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-muted/20 px-2 py-1">
      <p className="truncate text-[11px] font-bold text-muted-foreground">
        {label}
      </p>
      <p className="truncate font-black tabular-nums text-foreground">
        {displayMetric(value, kind)}
      </p>
    </div>
  );
}

export function BestSellingExportSurface({
  cards,
  containerRef,
  dateRange,
  groups,
  showSummary,
  sortByLabel,
  summary,
  title,
}: {
  cards: BestSellingSummaryCardConfig[];
  containerRef: RefObject<HTMLDivElement | null>;
  dateRange: string;
  groups: BestSellingProductGroup[];
  showSummary: boolean;
  sortByLabel: string;
  summary: Record<string, unknown>;
  title: string;
}) {
  const { t } = useTranslation();
  const groupMetrics = bestSellingGroupMetricConfigs(t);
  const productMetrics = bestSellingProductMetricConfigs(t);

  return (
    <div ref={containerRef} className="report-print-surface">
      <ReportOfficialHeader />
      <div className="report-print-header">
        <div>
          <p className="report-print-kicker">{sortByLabel}</p>
          <h1>{title}</h1>
        </div>
        <div className="report-print-meta">
          <span>{dateRange}</span>
        </div>
      </div>
      {showSummary ? (
        <div className="report-print-cards">
          {cards.map((card) => (
            <div key={card.label} className="report-print-card">
              <p>{card.label}</p>
              <strong>
                {displayMetric(summaryValue(summary, card.keys), card.kind)}
              </strong>
            </div>
          ))}
        </div>
      ) : null}
      <table className="report-print-table">
        <thead>
          <tr>
            <th>{t("report.bestSelling.columns.rank")}</th>
            <th>{t("report.bestSelling.columns.product")}</th>
            <th>{t("report.bestSelling.columns.productCode")}</th>
            <th>{t("report.bestSelling.columns.category")}</th>
            {productMetrics.map((metric) => (
              <th key={metric.key} className="is-right">
                {metric.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.id}>
              {/* แถวกลุ่มถือยอดรวมของกลุ่ม — คอลัมน์ราคาขายเว้นว่างให้ metric อื่นตรงแนว */}
              <tr className="is-bill">
                <td colSpan={4}>
                  {group.name} —{" "}
                  {t("report.bestSelling.groupSummary", {
                    products: group.productCount,
                    qty: formatNumber(group.qtyTotal),
                  })}
                </td>
                <td className="is-right" />
                {groupMetrics.map((metric) => (
                  <td key={metric.key} className="is-right">
                    {displayMetric(group[metric.field], metric.kind)}
                  </td>
                ))}
              </tr>
              {group.items.map((row, index) => (
                <tr key={row.id}>
                  <td className="is-center">{index + 1}</td>
                  <td>{row.productName}</td>
                  <td>{row.productCode}</td>
                  <td>{row.categoryName}</td>
                  {productMetrics.map((metric) => (
                    <td key={metric.key} className="is-right">
                      {displayMetric(row[metric.field], metric.kind)}
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
          <tr className="is-bill">
            <td colSpan={4}>{t("report.summary")}</td>
            <td className="is-right" />
            {cards.map((card) => (
              <td key={card.label} className="is-right">
                {displayMetric(summaryValue(summary, card.keys), card.kind)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <ReportSignatures />
    </div>
  );
}

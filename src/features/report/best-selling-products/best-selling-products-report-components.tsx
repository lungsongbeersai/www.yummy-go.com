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
  ListOrdered,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ReportOfficialHeader,
  ReportSignatures,
} from "@/lib/export/official-layout";
import { ReportFilterCard, ReportFilterSheet } from "../shared/report-filter-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  ReportBranchField,
  ReportDateRangeFields,
  ReportPageLimitField,
  ReportSelectField,
} from "../shared/report-filter-fields";
import { ReportSummaryCardsGrid, type ReportSummaryCard } from "../shared/report-metric-display";
import {
  ReportIndeterminateCheckbox,
  selectionStateForVisibleIds,
} from "../shared/report-row-selection";
import {
  sortRowsLocally,
  useLocalTableSort
} from "../shared/report-sort-utils";
import type {
  BestSellingOption,
  BestSellingProductsFilters,
  BestSellingSummaryCardConfig,
} from "./best-selling-products-report-types";
import {
  bestSellingGroupMetricConfigs,
  bestSellingProductRowId,
  bestSellingProductMetricConfigs,
  bestSellingProductMetrics,
  bestSellingSortOptions,
  bestSellingSummaryConfigs,
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
  const summaryCards: ReportSummaryCard[] = cards.map((card) => ({
    key: card.label,
    kind: card.kind,
    label: card.label,
    value: summaryValue(summary, card.keys),
  }));
  const cardByLabel = useMemo(() => new Map(cards.map((card) => [card.label, card])), [cards]);

  return (
    <ReportSummaryCardsGrid
      cards={summaryCards}
      gridClassName="sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7"
      cardClassName={(card) => {
        const tone = summaryCardTone(cardByLabel.get(card.key));
        return cn(
          "border bg-card",
          tone === "primary" && "border-primary/40 border-l-4 border-l-primary",
          tone === "danger" && "border-destructive/40 border-l-4 border-l-destructive",
          tone === "neutral" && "border-border",
        );
      }}
      labelClassName={(card) => {
        const tone = summaryCardTone(cardByLabel.get(card.key));
        return cn(
          tone === "primary" && "text-primary",
          tone === "danger" && "text-destructive",
          tone === "neutral" && "text-muted-foreground",
        );
      }}
      valueClassName={() => "font-black text-foreground"}
    />
  );
}

function summaryCardTone(card: BestSellingSummaryCardConfig | undefined) {
  if (!card) return "neutral";
  if (card.keys.some((key) => key.includes("discount"))) return "danger";
  if (card.kind === "money") return "primary";
  return "neutral";
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

// จอ lg ขึ้นไปกรองได้จากหน้าเลย โครงเดียวกับ /settings/store และหน้ารายงานขายประจำวัน
export function BestSellingFilterBar({
  actions,
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
}: FilterProps & { actions?: ReactNode }) {
  return (
    <ReportFilterCard
      actions={actions}
      canApply={canApply}
      actionsClassName="lg:col-span-4 xl:col-span-1"
      className="hidden shrink-0 rounded-none border-x-0 border-t-0 shadow-none lg:block"
      contentClassName="grid min-w-0 items-end gap-3 px-3 py-3 sm:grid-cols-2 lg:grid-cols-12 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]"
      loading={loading}
      onApply={onApply}
    >
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
    </ReportFilterCard>
  );
}

export function BestSellingFilterFields({
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
      <ReportBranchField
        branchLoading={branchLoading}
        branchLocked={branchLocked}
        fieldClassName="min-w-0 gap-1.5 sm:col-span-2 lg:col-span-4 xl:col-span-1"
        id={`${idPrefix}-branch`}
        options={branchOptions}
        value={draftFilters.branchUuid}
        onValueChange={(value) => patch({ branchUuid: value })}
      />
      <ReportDateRangeFields
        dateFrom={draftFilters.dateFrom}
        dateTo={draftFilters.dateTo}
        fieldClassName="min-w-0 gap-1.5 lg:col-span-4 xl:col-span-1"
        idPrefix={idPrefix}
        withNativeName
        onDateFromChange={(value) => patch({ dateFrom: value })}
        onDateToChange={(value) => patch({ dateTo: value })}
      />
      <ReportSelectField
        disabled={groupLoading || !groupOptions.length}
        fieldClassName="min-w-0 gap-1.5 lg:col-span-4 xl:col-span-1"
        id={`${idPrefix}-group`}
        label={t("report.bestSelling.filters.group")}
        options={groupOptions}
        value={draftFilters.groupUuid}
        onValueChange={(value) => patch({ groupUuid: value })}
      />
      <ReportPageLimitField
        fieldClassName="min-w-0 gap-1.5 lg:col-span-4 xl:col-span-1"
        id={`${idPrefix}-limit`}
        value={draftFilters.limit}
        onValueChange={(value) => patch({ limit: value })}
      />
    </>
  );
}

export function BestSellingSortDropdown({
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
    <div className="hidden min-w-0 md:block">
      <Table className="w-max min-w-full table-auto text-[13px]">
        <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-30 [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-border [&_th]:bg-background [&_th]:px-3 [&_th]:shadow-sm">
          <TableRow>
            <TableHead className="w-10 text-center">
              <ReportIndeterminateCheckbox
                aria-label={t("common.selectAll")}
                checked={allVisibleSelected}
                indeterminate={!allVisibleSelected && someVisibleSelected}
                onCheckedChange={(checked) =>
                                  onToggleRows(visibleRows, checked as boolean)
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
        <TableBody className="[&_td]:px-3">
          {sortedGroupRows.map(({ group, rows: groupRows }) => {
            const groupIds = groupRows.map(bestSellingProductRowId);
            const groupSelection = selectionStateForVisibleIds(
              groupIds,
              selectedRowIds,
            );

            return (
              <Fragment key={group.id}>
                <TableRow className="border-t-2 border-border bg-muted/50 hover:bg-muted/50">
                  <TableCell className="w-10 text-center">
                    <ReportIndeterminateCheckbox
                      aria-label={t("common.selectRow", { name: group.name })}
                      checked={groupSelection.allVisibleSelected}
                      indeterminate={
                        !groupSelection.allVisibleSelected &&
                        groupSelection.someVisibleSelected
                      }
                      onCheckedChange={(checked) =>
                                              onToggleRows(groupRows, checked as boolean)
                      }
                    />
                  </TableCell>
                  <TableCell
                    colSpan={4 + productMetrics.length}
                    className="py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-foreground">
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
                </TableRow>
                {groupRows.map((item, index) => (
                  <BestSellingProductRow
                    key={item.id}
                    item={item}
                    metrics={productMetrics}
                    rank={index + 1}
                    selectLabel={t("common.selectRow", {
                      name: item.productName,
                    })}
                    selected={selectedRowIds.has(bestSellingProductRowId(item))}
                    onToggleRow={onToggleRow}
                  />
                ))}
                <TableRow className="border-b-2 border-primary bg-muted font-bold text-foreground hover:bg-muted">
                  <TableCell />
                  <TableCell
                    colSpan={4}
                    className="font-black text-primary"
                  >
                    {t("common.total")}
                  </TableCell>
                  {productMetrics.map((metric) => {
                    const groupMetric = groupMetricByKey.get(metric.key);
                    const value = groupMetric
                      ? group[groupMetric.field]
                      : null;

                    return (
                      <TableCell
                        key={metric.key}
                        className={cn(
                          metricValueClass(value, metric.key, true),
                          metric.key === "final_total" && "text-primary",
                        )}
                      >
                        {groupMetric
                          ? displayMetric(value, groupMetric.kind)
                          : "-"}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </Fragment>
            );
          })}
        </TableBody>
        <TableFooter className="sticky bottom-0 z-20 bg-transparent">
          <BestSellingSummaryFooterRow
            productMetrics={productMetrics}
            summary={summary}
            summaryCards={summaryCards}
            summaryLabel={t("report.summary")}
          />
        </TableFooter>
      </Table>
    </div>
  );
}

const BestSellingProductRow = memo(function BestSellingProductRow({
  item,
  metrics,
  rank,
  selectLabel,
  selected,
  onToggleRow,
}: {
  item: BestSellingProductItem;
  metrics: ReturnType<typeof bestSellingProductMetricConfigs>;
  rank: number;
  selectLabel: string;
  selected: boolean;
  onToggleRow: (row: BestSellingProductItem, selected: boolean) => void;
}) {
  return (
    <TableRow
      className={cn(
        "hover:bg-muted/20",
        selected && "bg-primary/5 hover:bg-primary/10",
      )}
    >
      <TableCell className="w-10 text-center">
        <Checkbox
          aria-label={selectLabel}
          checked={selected}
                  onCheckedChange={(checked) => onToggleRow(item, checked as boolean)}
        />
      </TableCell>
      <TableCell className="text-center">
        <Badge
          variant="outline"
          className="h-6 min-w-9 justify-center bg-muted px-2 text-xs tabular-nums"
        >
          #{rank}
        </Badge>
      </TableCell>
      <TableCell className="max-w-80 whitespace-normal">
        <div className="ml-6 min-w-40 border-l border-border/70 pl-3">
          <p className="font-bold leading-snug text-foreground">
            {item.productName}
          </p>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {item.productCode}
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
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
    <TableRow className="border-t-2 border-primary bg-muted font-bold text-foreground hover:bg-muted">
      <TableCell className={summaryFooterCellClass("left")} colSpan={5}>
        <div className="flex min-w-64 items-center gap-2">
          <Badge
            variant="outline"
            className="h-6 border-primary/30 bg-muted px-2 text-xs font-black uppercase text-primary"
          >
            {summaryLabel}
          </Badge>
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
    "whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums",
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
    "font-bold",
    firstNumber(value) === 0 && "text-muted-foreground",
    key.includes("discount") && firstNumber(value) > 0 && "font-black text-destructive",
    key === "final_total" && "font-black text-foreground",
  );
}

function summaryFooterCellClass(align: "left" | "right" = "left") {
  return cn(
    "sticky bottom-0 z-20 h-10 whitespace-nowrap border-t-2 border-primary bg-muted px-2 py-2 font-bold text-foreground",
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
          className="overflow-hidden rounded-md border border-border bg-card shadow-sm"
        >
          <div className="bg-muted/40 px-3 py-3">
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
                onCheckedChange={(checked) =>
                                  onToggleRows(group.items, checked as boolean)
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
          </div>
          <div className="divide-y divide-border">
            {group.items.map((item, index) => (
              <div
                key={item.id}
                className={cn(
                  "py-3 pr-3",
                  selectedRowIds.has(bestSellingProductRowId(item)) &&
                    "bg-primary/5",
                )}
              >
                <div className="ml-3 flex items-start gap-3 border-l border-border/70 pl-3">
                  <Checkbox
                    aria-label={t("common.selectRow", { name: item.productName })}
                    className="mt-0.5"
                    checked={selectedRowIds.has(bestSellingProductRowId(item))}
                    onCheckedChange={(checked) => onToggleRow(item, checked as boolean)}
                  />
                  <Badge
                    variant="outline"
                    className="h-7 min-w-10 justify-center bg-muted px-2 text-xs tabular-nums"
                  >
                    #{index + 1}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold leading-snug text-foreground">
                      {item.productName}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.productCode} / {item.categoryName}
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
              </div>
            ))}
          </div>
          <div className="border-t-2 border-primary bg-muted p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-primary">
                  {t("common.total")}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("report.bestSelling.columns.qty")}:{" "}
                  {displayMetric(group.qtyTotal, "number")}
                </p>
              </div>
              <p className="shrink-0 text-sm font-black tabular-nums text-primary">
                {displayMetric(group.finalTotal, "money")}
              </p>
            </div>
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
    <div className="min-w-0 rounded-md border border-border bg-muted px-2.5 py-2">
      <p className="truncate text-[10px] font-bold uppercase text-muted-foreground">
        {label}
      </p>
      <p className="truncate text-xs font-black tabular-nums text-foreground">
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

"use client";

import {
  Fragment,
  useCallback,
  useMemo,
  type ReactNode,
  type RefObject,
} from "react";
import {
  BadgePercent,
  CalendarArrowDown,
  CalendarArrowUp,
  ChevronDown,
  CircleDollarSign,
  HandPlatter,
  Landmark,
  ListOrdered,
  Medal,
  Package,
  Tag,
  TrendingUp,
  Trophy,
  Wallet,
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
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ReportColumnPinningProvider, ReportRowPinToggle, ReportRowPinningProvider } from "@/features/report/shared/report-column-head";
import { STICKY_TABLE_CLASS, useStickyTable, type ReportColumnPinning } from "@/features/report/shared/report-sticky-table";
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
  ReportSelectField,
} from "../shared/report-filter-fields";
import type { ReportColumnOption } from "../shared/report-column-visibility";
import { ReportStatCards, type ReportStat, type ReportStatTone } from "../shared/report-stat-cards";
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

const SUMMARY_PRESENTATION: Record<string, { icon: LucideIcon; tone: ReportStatTone }> = {
  qty: { icon: Package, tone: "info" },
  subtotal: { icon: Wallet, tone: "success" },
  item_discount: { icon: BadgePercent, tone: "danger" },
  bill_discount_share: { icon: Tag, tone: "danger" },
  charge: { icon: HandPlatter, tone: "primary" },
  vat: { icon: Landmark, tone: "warning" },
  final_total: { icon: TrendingUp, tone: "highlight" },
};

export function BestSellingSummaryCards({
  cards,
  id,
  summary,
}: {
  cards: BestSellingSummaryCardConfig[];
  id?: string;
  summary: Record<string, unknown>;
}) {
  const stats: ReportStat[] = cards.map((card) => {
    const value = summaryValue(summary, card.keys);
    const presentation = SUMMARY_PRESENTATION[card.keys[0] ?? ""] ?? { icon: Package, tone: "primary" };

    return {
      ...presentation,
      key: card.label,
      label: card.label,
      negative: presentation.tone === "danger" && firstNumber(value) > 0,
      span: presentation.tone === "highlight",
      value: displayMetric(value, card.kind),
    };
  });
  const highlight = stats.filter((stat) => stat.tone === "highlight");

  return <ReportStatCards id={id} stats={[...highlight, ...stats.filter((stat) => stat.tone !== "highlight")]} />;
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
      // shrink-0: Card มี overflow-hidden ซึ่งทำให้ min-height ของ flex item เป็น 0 — ไม่ใส่ไว้ พอตาราง/skeleton
      // กินความสูงเต็ม การ์ดตัวกรองจะถูกบีบจนช่องกรอกโดนตัดครึ่ง (เห็นตอนโหลด/รีเฟรช)
      className="hidden shrink-0 shadow-none lg:block"
      contentClassName="grid items-end gap-3 py-4 lg:grid-cols-12 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]"
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
        fieldClassName="lg:col-span-4 xl:col-span-1"
        id={`${idPrefix}-branch`}
        options={branchOptions}
        value={draftFilters.branchUuid}
        onValueChange={(value) => patch({ branchUuid: value })}
      />
      <ReportDateRangeFields
        dateFrom={draftFilters.dateFrom}
        dateTo={draftFilters.dateTo}
        fieldClassName="lg:col-span-4 xl:col-span-1"
        idPrefix={idPrefix}
        withNativeName
        onDateFromChange={(value) => patch({ dateFrom: value })}
        onDateToChange={(value) => patch({ dateTo: value })}
      />
      <ReportSelectField
        disabled={groupLoading || !groupOptions.length}
        fieldClassName="lg:col-span-4 xl:col-span-1"
        id={`${idPrefix}-group`}
        label={t("report.bestSelling.filters.group")}
        options={groupOptions}
        value={draftFilters.groupUuid}
        onValueChange={(value) => patch({ groupUuid: value })}
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
        <Button type="button" variant="outline" aria-label={t("report.bestSelling.filters.sortBy")} disabled={disabled}>
          <ListOrdered data-icon="inline-start" />
          <span className="hidden sm:inline">{sortByLabel}</span>
          <ChevronDown data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>{t("report.bestSelling.filters.sortBy")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={sortBy}
          onValueChange={(value) => {
            if (isBestSellingProductsSortBy(value)) onSortByChange(value);
          }}
        >
          {sortOptions.map((option) => {
            const Icon = bestSellingSortIcons[option.value];
            return (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                <Icon aria-hidden="true" />
                {option.label}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type ProductMetric = ReturnType<typeof bestSellingProductMetricConfigs>[number];

/** ตัวเลือกของเมนู "คอลัมน์" — อันดับและชื่อสินค้าเป็นแกนของรายงาน ซ่อนไม่ได้ */
export function bestSellingColumnOptions(t: (key: string) => string): ReportColumnOption[] {
  return [
    { hideable: false, id: "product", label: t("report.bestSelling.columns.product") },
    { id: "productCode", label: t("report.bestSelling.columns.productCode") },
    { id: "category", label: t("report.bestSelling.columns.category") },
    ...bestSellingProductMetricConfigs(t).map((metric) => ({ id: metric.key, label: metric.label })),
  ];
}

// แถบสัดส่วนใต้ชื่อสินค้า = เทียบกับตัวที่ขายดีสุดในกลุ่มเดียวกัน ตามเกณฑ์ที่เลือกเรียง (จำนวน/ยอดขาย)
// เรียงตามวันที่ไม่มี "ขายดีกว่า" ให้เทียบ จึงไม่แสดงแถบและไม่ไฮไลต์ 3 อันดับแรก
function rankingField(sortBy: BestSellingProductsSortBy) {
  if (sortBy === "qty") return "qty" as const;
  if (sortBy === "total") return "finalTotal" as const;
  return null;
}

function RankBadge({ highlight, rank }: { highlight: boolean; rank: number }) {
  if (highlight && rank <= 3) {
    return (
      <Badge className={RANK_BADGE_CLASS[rank - 1]}>
        {rank === 1 ? <Trophy data-icon="inline-start" /> : <Medal data-icon="inline-start" />}
        {rank}
      </Badge>
    );
  }
  return <span className="tabular-nums text-muted-foreground">{rank}</span>;
}

// 3 อันดับแรก: ทอง (warning) / ฟ้า (info) / สีธีม — token ของธีมทั้งหมด
const RANK_BADGE_CLASS = [
  "bg-warning/15 text-warning-text",
  "bg-info/10 text-info-text",
  "bg-primary/10 text-primary-text",
];

export function BestSellingProductsTable({
  groups,
  isColumnVisible,
  pinning,
  selectedRowIds,
  sortBy,
  summary,
  onToggleRow,
  onToggleRows,
}: {
  groups: BestSellingProductGroup[];
  isColumnVisible: (id: string) => boolean;
  pinning: ReportColumnPinning;
  selectedRowIds: Set<string>;
  sortBy: BestSellingProductsSortBy;
  summary: Record<string, unknown>;
  onToggleRow: (row: BestSellingProductItem, selected: boolean) => void;
  onToggleRows: (rows: BestSellingProductItem[], selected: boolean) => void;
}) {
  const { t } = useTranslation();
  const productMetrics = useMemo(
    () => bestSellingProductMetricConfigs(t).filter((metric) => isColumnVisible(metric.key)),
    [isColumnVisible, t],
  );
  const groupMetrics = useMemo(() => bestSellingGroupMetricConfigs(t), [t]);
  const summaryCards = useMemo(() => bestSellingSummaryConfigs(t), [t]);
  const groupMetricByKey = useMemo(
    () => new Map(groupMetrics.map((metric) => [metric.key, metric])),
    [groupMetrics],
  );
  const showCode = isColumnVisible("productCode");
  const showCategory = isColumnVisible("category");
  // ช่องข้อความด้านหน้าคอลัมน์ตัวเลข: อันดับ + สินค้า + (รหัส) + (หมวด)
  const leadingSpan = 2 + (showCode ? 1 : 0) + (showCategory ? 1 : 0);
  const shareField = rankingField(sortBy);

  const getGroupSortValue = useCallback(
    (group: BestSellingProductGroup, key: BestSellingSortKey) => {
      if (key === "groupName") return group.name;
      const groupMetric = groupMetrics.find((metric) => metric.field === key);
      if (groupMetric) return group[groupMetric.field];
      return group.items[0]?.[key];
    },
    [groupMetrics],
  );
  const { sort, sortedRows: sortedGroups, toggleSort } = useLocalTableSort(groups, getGroupSortValue);
  const sortedGroupRows = useMemo(
    () =>
      sortedGroups.map((group) => ({
        group,
        rows: sortRowsLocally(group.items, sort, (item, key) => item[key]),
      })),
    [sort, sortedGroups],
  );
  const visibleRows = useMemo(() => sortedGroupRows.flatMap(({ rows }) => rows), [sortedGroupRows]);
  const visibleIds = useMemo(() => visibleRows.map(bestSellingProductRowId), [visibleRows]);
  const { allVisibleSelected, someVisibleSelected } = selectionStateForVisibleIds(visibleIds, selectedRowIds);
  const productCount = firstNumber(summaryValue(summary, ["product_count", "products_count"]));
  const stickyRef = useStickyTable(pinning);

  return (
    // container ของ Table เป็นตัวสกรอลเอง — หัวตาราง sticky ด้านบน, แถวรวม sticky ด้านล่าง
    <Table containerClassName={cn("min-h-0 flex-1 overflow-auto", STICKY_TABLE_CLASS)} containerRef={stickyRef}>
      <ReportColumnPinningProvider pinning={pinning}>
      <TableHeader className="sticky top-0 z-30 bg-muted">
        <TableRow>
          <TableHead>
            <ReportIndeterminateCheckbox
              aria-label={t("common.selectAll")}
              checked={allVisibleSelected}
              indeterminate={!allVisibleSelected && someVisibleSelected}
              onCheckedChange={(checked) => onToggleRows(visibleRows, checked as boolean)}
            />
          </TableHead>
          <SortableReportTableHead sort={sort} sortKey="rank" onSort={toggleSort}>
            {t("report.bestSelling.columns.rank")}
          </SortableReportTableHead>
          <SortableReportTableHead sort={sort} sortKey="productName" className="min-w-60" columnId="product" onSort={toggleSort}>
            {t("report.bestSelling.columns.product")}
          </SortableReportTableHead>
          {showCode ? (
            <SortableReportTableHead sort={sort} sortKey="productCode" columnId="productCode" onSort={toggleSort}>
              {t("report.bestSelling.columns.productCode")}
            </SortableReportTableHead>
          ) : null}
          {showCategory ? (
            <SortableReportTableHead sort={sort} sortKey="categoryName" columnId="category" onSort={toggleSort}>
              {t("report.bestSelling.columns.category")}
            </SortableReportTableHead>
          ) : null}
          {productMetrics.map((metric) => (
            <SortableReportTableHead
              key={metric.key}
              align="right"
              sort={sort}
              sortKey={metric.field}
              className="text-right"
              columnId={metric.key}
              onSort={toggleSort}
            >
              {metric.label}
            </SortableReportTableHead>
          ))}
        </TableRow>
      </TableHeader>
      </ReportColumnPinningProvider>

      <ReportRowPinningProvider>
      <TableBody>
        {sortedGroupRows.map(({ group, rows: groupRows }) => {
          const groupIds = groupRows.map(bestSellingProductRowId);
          const groupSelection = selectionStateForVisibleIds(groupIds, selectedRowIds);
          const topValue = shareField
            ? Math.max(0, ...groupRows.map((item) => firstNumber(item[shareField])))
            : 0;

          return (
            <Fragment key={group.id}>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableCell>
                  <ReportIndeterminateCheckbox
                    aria-label={t("common.selectRow", { name: group.name })}
                    checked={groupSelection.allVisibleSelected}
                    indeterminate={!groupSelection.allVisibleSelected && groupSelection.someVisibleSelected}
                    onCheckedChange={(checked) => onToggleRows(groupRows, checked as boolean)}
                  />
                </TableCell>
                <TableCell colSpan={leadingSpan + productMetrics.length}>
                  <span className="font-medium">{group.name}</span>
                  <span className="ml-2 text-muted-foreground">
                    {t("report.bestSelling.groupSummary", {
                      products: group.productCount,
                      qty: formatNumber(group.qtyTotal),
                    })}
                  </span>
                </TableCell>
              </TableRow>

              {groupRows.map((item, index) => {
                const selected = selectedRowIds.has(bestSellingProductRowId(item));
                const share = shareField && topValue > 0 ? (firstNumber(item[shareField]) / topValue) * 100 : null;

                return (
                  <TableRow key={item.id} data-state={selected ? "selected" : undefined}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Checkbox
                          aria-label={t("common.selectRow", { name: item.productName })}
                          checked={selected}
                          onCheckedChange={(checked) => onToggleRow(item, checked as boolean)}
                        />
                        <ReportRowPinToggle isDefault={bestSellingProductRowId(item) === visibleIds[0]} label={item.productName} rowId={bestSellingProductRowId(item)} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <RankBadge highlight={Boolean(shareField)} rank={index + 1} />
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <div className="flex flex-col gap-1.5">
                        <span className="font-medium">{item.productName}</span>
                        {share !== null ? <Progress value={share} aria-hidden="true" className="max-w-48" /> : null}
                      </div>
                    </TableCell>
                    {showCode ? <TableCell className="text-muted-foreground">{item.productCode}</TableCell> : null}
                    {showCategory ? <TableCell className="text-muted-foreground">{item.categoryName}</TableCell> : null}
                    {productMetrics.map((metric) => (
                      <TableCell key={metric.key} className={metricValueClass(item[metric.field], metric.key)}>
                        {displayMetric(item[metric.field], metric.kind)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}

              <TableRow className="bg-primary/5 hover:bg-primary/5">
                <TableCell />
                <TableCell colSpan={leadingSpan} className="font-medium text-primary-text">
                  {t("common.total")}
                </TableCell>
                {productMetrics.map((metric) => {
                  const groupMetric = groupMetricByKey.get(metric.key);
                  const value = groupMetric ? group[groupMetric.field] : null;

                  return (
                    <TableCell key={metric.key} className={cn(metricValueClass(value, metric.key), "font-medium")}>
                      {groupMetric ? displayMetric(value, groupMetric.kind) : null}
                    </TableCell>
                  );
                })}
              </TableRow>
            </Fragment>
          );
        })}

        <TableRow className="hover:bg-transparent">
          <TableCell className={summaryFooterCellClass()} colSpan={1 + leadingSpan}>
            {t("report.summary")}
            {productCount > 0 ? (
              <span className="ml-2 font-normal text-muted-foreground">
                {t("report.bestSelling.rowsLabel", { count: productCount })}
              </span>
            ) : null}
          </TableCell>
          {productMetrics.map((metric) => (
            <BestSellingSummaryMetricCell key={metric.key} metric={metric} summary={summary} summaryCards={summaryCards} />
          ))}
        </TableRow>
      </TableBody>
      </ReportRowPinningProvider>
    </Table>
  );
}

function BestSellingSummaryMetricCell({
  metric,
  summary,
  summaryCards,
}: {
  metric: ProductMetric;
  summary: Record<string, unknown>;
  summaryCards: BestSellingSummaryCardConfig[];
}) {
  const card = summaryCards.find((summaryCard) => summaryCard.keys.includes(metric.key));
  if (!card) return <TableCell className={summaryFooterCellClass()} />;

  const value = summaryValue(summary, card.keys);
  return (
    <TableCell
      className={cn(
        summaryFooterCellClass("right"),
        metric.key !== "final_total" && "text-foreground",
        metric.key === "final_total" && "font-semibold",
        metric.key.includes("discount") && firstNumber(value) > 0 && "text-destructive",
      )}
    >
      {displayMetric(value, metric.kind)}
    </TableCell>
  );
}

// สีตัวเลข: ส่วนลดที่มากกว่า 0 = แดง, ยอดสุทธิ = สีธีม, ค่า 0 = จาง
function metricValueClass(value: unknown, key: string) {
  const numericValue = value === null ? null : firstNumber(value);

  return cn(
    "text-right tabular-nums",
    numericValue === 0 && "text-muted-foreground",
    key.includes("discount") && numericValue !== null && numericValue > 0 && "text-destructive",
    key === "final_total" && numericValue !== 0 && "font-medium text-primary-text",
  );
}

function summaryFooterCellClass(align: "left" | "right" = "left") {
  return cn(
    // แถวรวมค้างขอบล่าง — ทึบ (bg-background) แล้ววางสีธีมจางเป็นชั้น gradient ทับ
    "sticky bottom-0 z-20 border-t border-primary/30 bg-background bg-linear-to-r from-primary/10 to-primary/10 font-medium text-primary-text",
    align === "right" && "text-right tabular-nums",
  );
}

export function BestSellingProductsMobileList({
  groups,
  selectedRowIds,
  sortBy,
  onToggleRow,
  onToggleRows,
}: {
  groups: BestSellingProductGroup[];
  selectedRowIds: Set<string>;
  sortBy: BestSellingProductsSortBy;
  onToggleRow: (row: BestSellingProductItem, selected: boolean) => void;
  onToggleRows: (rows: BestSellingProductItem[], selected: boolean) => void;
}) {
  const { t } = useTranslation();
  const shareField = rankingField(sortBy);

  return (
    <ItemGroup>
      {groups.map((group) => {
        const selection = selectionStateForVisibleIds(group.items.map(bestSellingProductRowId), selectedRowIds);
        const topValue = shareField ? Math.max(0, ...group.items.map((item) => firstNumber(item[shareField]))) : 0;

        return (
          <Item key={group.id} variant="outline">
            <ReportIndeterminateCheckbox
              aria-label={t("common.selectRow", { name: group.name })}
              checked={selection.allVisibleSelected}
              indeterminate={!selection.allVisibleSelected && selection.someVisibleSelected}
              onCheckedChange={(checked) => onToggleRows(group.items, checked as boolean)}
            />
            <ItemContent>
              <ItemTitle>{group.name}</ItemTitle>
              <ItemDescription>
                {t("report.bestSelling.groupSummary", {
                  products: group.productCount,
                  qty: formatNumber(group.qtyTotal),
                })}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <span className="font-medium tabular-nums text-primary-text">
                {displayMetric(group.finalTotal, "money")}
              </span>
            </ItemActions>

            <ItemFooter>
              <ItemGroup>
                {group.items.map((item, index) => {
                  const selected = selectedRowIds.has(bestSellingProductRowId(item));
                  const share =
                    shareField && topValue > 0 ? (firstNumber(item[shareField]) / topValue) * 100 : null;

                  return (
                    <Item key={item.id} variant="muted" size="sm">
                      <Checkbox
                        aria-label={t("common.selectRow", { name: item.productName })}
                        checked={selected}
                        onCheckedChange={(checked) => onToggleRow(item, checked as boolean)}
                      />
                      <RankBadge highlight={Boolean(shareField)} rank={index + 1} />
                      <ItemContent>
                        <ItemTitle>{item.productName}</ItemTitle>
                        <ItemDescription>
                          {t("report.bestSelling.columns.qty")} {displayMetric(item.qty, "number")} ·{" "}
                          {item.categoryName}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <span className="tabular-nums">{displayMetric(item.finalTotal, "money")}</span>
                      </ItemActions>
                      {share !== null ? (
                        <ItemFooter>
                          <Progress value={share} aria-hidden="true" />
                        </ItemFooter>
                      ) : null}
                    </Item>
                  );
                })}
              </ItemGroup>
            </ItemFooter>
          </Item>
        );
      })}
    </ItemGroup>
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

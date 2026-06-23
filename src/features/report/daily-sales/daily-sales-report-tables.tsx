"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown, ChevronRight, Package } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, type CheckboxProps } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DailySalesReportType } from "@/services/report";
import type { ApiEntity } from "@/services/shared/types";
import type { DailySalesBillGroup } from "@/stores/report-store";
import { SortableReportTableHead } from "../report-sort-table-head";
import {
  nextLocalSortState,
  sortRowsLocally,
  useLocalTableSort,
  type LocalSortState,
} from "../report-sort-utils";
import type { ReportColumn } from "./daily-sales-report-types";
import {
  firstNumber,
  formatDate,
  billSummaryMetrics,
  hasDisplayValue,
  isCancelledRow,
  isPaymentAttentionRow,
  isZeroColumnValue,
  readValue,
  reportImageColor,
  reportImageSrc,
  reportRecordId,
  rowKey,
  statusClass,
  textValue,
  toppingLines,
} from "./daily-sales-report-utils";

type DailySalesBillSortKey =
  | "cashierName"
  | "invoiceNumber"
  | "itemCount"
  | "lineTotal"
  | "paymentType"
  | "saleDate"
  | "status"
  | "tableName";

export function SummaryReportTable({
  columns,
  pageStart,
  rows,
  selectedRecordIds,
  typePage,
  onToggleRow,
  onToggleRows,
}: {
  columns: ReportColumn[];
  pageStart: number;
  rows: ApiEntity[];
  selectedRecordIds: Set<string>;
  typePage: DailySalesReportType;
  onToggleRow: (row: ApiEntity, selected: boolean) => void;
  onToggleRows: (rows: ApiEntity[], selected: boolean) => void;
}) {
  const { t } = useTranslation();
  const getSortValue = useCallback(
    (row: ApiEntity, key: string) => {
      const column = columns.find((item) => item.header === key);
      return column ? readValue(row, column.keys) : undefined;
    },
    [columns],
  );
  const { sort, sortedRows, toggleSort } = useLocalTableSort(
    rows,
    getSortValue,
  );
  const visibleIds = sortedRows.map(reportRecordId);
  const allVisibleSelected =
    visibleIds.length > 0 &&
    visibleIds.every((id) => selectedRecordIds.has(id));
  const someVisibleSelected = visibleIds.some((id) =>
    selectedRecordIds.has(id),
  );

  return (
    <div className="w-full min-w-0 overflow-x-auto">
      <Table
        className={cn(
          "text-[13px]",
          typePage === "summary" ? "min-w-375" : "min-w-[1880px]",
        )}
      >
        <TableHeader className="sticky top-0 z-20 bg-background/95 shadow-sm backdrop-blur">
          <TableRow>
            <TableHead className="w-[52px] whitespace-nowrap bg-background/95 text-center">
              <IndeterminateCheckbox
                aria-label={t("common.selectAll")}
                checked={allVisibleSelected}
                indeterminate={!allVisibleSelected && someVisibleSelected}
                onChange={(event) =>
                  onToggleRows(sortedRows, event.target.checked)
                }
              />
            </TableHead>
            <TableHead className="w-px whitespace-nowrap text-center">
              {t("fields.no")}
            </TableHead>
            {columns.map((column) =>
              column.kind === "image" ? (
                <TableHead
                  key={column.header}
                  className={cn(
                    "h-11 whitespace-nowrap bg-background/95",
                    column.minWidth,
                  )}
                >
                  {column.header}
                </TableHead>
              ) : (
                <SortableReportTableHead
                  key={column.header}
                  align={column.align}
                  sort={sort}
                  sortKey={column.header}
                  className={cn(
                    "h-11 whitespace-nowrap bg-background/95",
                    column.align === "right" && "text-right",
                    column.minWidth,
                    column.wide && "min-w-[180px]",
                  )}
                  onSort={toggleSort}
                >
                  {column.header}
                </SortableReportTableHead>
              ),
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((row, index) => {
            const recordId = reportRecordId(row);
            const selected = selectedRecordIds.has(recordId);

            return (
              <TableRow
                key={`${rowKey(row, index)}-${index}`}
                className={cn(
                  tableRowClass(row, index),
                  selected &&
                    !isCancelledRow(row) &&
                    !isPaymentAttentionRow(row) &&
                    "bg-primary/5",
                )}
              >
                <TableCell className="w-[52px] whitespace-nowrap text-center">
                  <Checkbox
                    aria-label={t("common.selectRow", {
                      name: textValue(
                        readValue(row, [
                          "invoice_number",
                          "invoice_no",
                          "invoice",
                          "order_invoice",
                        ]),
                        String(pageStart + index),
                      ),
                    })}
                    checked={selected}
                    onChange={(event) => onToggleRow(row, event.target.checked)}
                  />
                </TableCell>
                <TableCell className="w-px whitespace-nowrap text-center text-sm font-black text-muted-foreground">
                  {pageStart + index}
                </TableCell>
                {columns.map((column) => (
                  <TableCell
                    key={column.header}
                    className={tableCellClass(row, column)}
                  >
                    {renderCell(row, column)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function DetailBillTable({
  collapsedGroups,
  groups,
  itemColumns,
  pageStart,
  selectedRecordIds,
  onToggleGroup,
  onToggleRow,
  onToggleRows,
}: {
  collapsedGroups: Set<string>;
  groups: DailySalesBillGroup[];
  itemColumns: ReportColumn[];
  pageStart: number;
  selectedRecordIds: Set<string>;
  onToggleGroup: (groupId: string) => void;
  onToggleRow: (row: ApiEntity, selected: boolean) => void;
  onToggleRows: (rows: ApiEntity[], selected: boolean) => void;
}) {
  const { t } = useTranslation();
  const getGroupSortValue = useCallback(
    (group: DailySalesBillGroup, key: DailySalesBillSortKey) =>
      dailySalesBillSortValue(group, key),
    [],
  );
  const {
    sort: groupSort,
    sortedRows: sortedGroups,
    toggleSort: toggleGroupSort,
  } = useLocalTableSort(groups, getGroupSortValue);
  const [itemSort, setItemSort] =
    useState<LocalSortState<string>>(null);
  const visibleItems = sortedGroups.flatMap((group) => group.items);
  const visibleItemIds = visibleItems.map(reportRecordId);
  const allVisibleSelected =
    visibleItemIds.length > 0 &&
    visibleItemIds.every((id) => selectedRecordIds.has(id));
  const someVisibleSelected = visibleItemIds.some((id) =>
    selectedRecordIds.has(id),
  );

  const allItems = sortedGroups.flatMap((group) => group.items);
  const hasStatusData = allItems.some((item) =>
    hasDisplayValue(
      readValue(item, [
        "status_name",
        "status_text",
        "status",
        "status_code",
        "order_status_text",
        "order_it_status_text",
      ]),
    ),
  );
  const parentColumnCount = hasStatusData ? 10 : 9;
  const getItemSortValue = useCallback(
    (row: ApiEntity, key: string) => {
      const column = itemColumns.find((item) => item.header === key);
      return column ? readValue(row, column.keys) : undefined;
    },
    [itemColumns],
  );

  useEffect(() => {
    setItemSort(null);
  }, [groups, itemColumns]);

  const toggleItemSort = useCallback((key: string) => {
    setItemSort((current) => nextLocalSortState(current, key));
  }, []);

  return (
    <div className="w-full min-w-0 overflow-x-auto">
      <Table className="min-w-[1100px] text-[13px]">
        <TableHeader className="sticky top-0 z-20 bg-background/95 shadow-sm backdrop-blur">
          <TableRow>
            <TableHead className="w-[52px] whitespace-nowrap bg-background/95 text-center">
              <IndeterminateCheckbox
                aria-label={t("common.selectAll")}
                checked={allVisibleSelected}
                indeterminate={!allVisibleSelected && someVisibleSelected}
                onChange={(event) =>
                  onToggleRows(visibleItems, event.target.checked)
                }
              />
            </TableHead>
            <TableHead className="w-[90px] whitespace-nowrap bg-background/95 text-center">
              {t("fields.no")}
            </TableHead>
            <SortableReportTableHead
              sort={groupSort}
              sortKey="invoiceNumber"
              className="min-w-[132px] whitespace-nowrap bg-background/95"
              onSort={toggleGroupSort}
            >
              {t("report.columns.invoiceNumber")}
            </SortableReportTableHead>
            <SortableReportTableHead
              sort={groupSort}
              sortKey="saleDate"
              className="min-w-[118px] whitespace-nowrap bg-background/95"
              onSort={toggleGroupSort}
            >
              {t("report.columns.saleDate")}
            </SortableReportTableHead>
            <SortableReportTableHead
              sort={groupSort}
              sortKey="tableName"
              className="min-w-[84px] whitespace-nowrap bg-background/95"
              onSort={toggleGroupSort}
            >
              {t("report.columns.tableName")}
            </SortableReportTableHead>
            <SortableReportTableHead
              sort={groupSort}
              sortKey="paymentType"
              className="min-w-[130px] whitespace-nowrap bg-background/95"
              onSort={toggleGroupSort}
            >
              {t("report.columns.paymentType")}
            </SortableReportTableHead>
            <SortableReportTableHead
              sort={groupSort}
              sortKey="cashierName"
              className="min-w-[160px] whitespace-nowrap bg-background/95"
              onSort={toggleGroupSort}
            >
              {t("report.columns.cashierName")}
            </SortableReportTableHead>
            <SortableReportTableHead
              align="right"
              sort={groupSort}
              sortKey="itemCount"
              className="min-w-[94px] whitespace-nowrap bg-background/95 text-right"
              onSort={toggleGroupSort}
            >
              {t("report.billItems")}
            </SortableReportTableHead>
            <SortableReportTableHead
              align="right"
              sort={groupSort}
              sortKey="lineTotal"
              className="min-w-[132px] whitespace-nowrap bg-background/95 text-right"
              onSort={toggleGroupSort}
            >
              {t("report.cards.netTotal")}
            </SortableReportTableHead>
            {hasStatusData ? (
              <SortableReportTableHead
                sort={groupSort}
                sortKey="status"
                className="min-w-[118px] whitespace-nowrap bg-background/95"
                onSort={toggleGroupSort}
              >
                {t("report.columns.status")}
              </SortableReportTableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedGroups.map((group, index) => {
            const expanded = !collapsedGroups.has(group.id);
            const statusRow = group.items[0] ?? {};
            const groupItemIds = group.items.map(reportRecordId);
            const selectedItemCount = groupItemIds.filter((id) =>
              selectedRecordIds.has(id),
            ).length;
            const groupSelected =
              groupItemIds.length > 0 &&
              selectedItemCount === groupItemIds.length;
            const groupPartiallySelected =
              selectedItemCount > 0 && !groupSelected;
            const groupNeedsAttention =
              !group.cancelled &&
              isPaymentAttentionRow({
                debt_amount: group.debtAmount,
                payment_method: group.paymentType,
                status: group.status,
              });

            return (
              <Fragment key={group.id}>
                <TableRow
                  className={cn(
                    "border-b border-border/80 bg-card hover:bg-muted/25 [&>td]:py-3",
                    expanded &&
                      !group.cancelled &&
                      !groupNeedsAttention &&
                      "border-l-4 border-l-primary/60 bg-primary/5 hover:bg-primary/10",
                    groupNeedsAttention &&
                      "bg-red-50 hover:bg-red-100/70 dark:bg-red-950/25 dark:hover:bg-red-950/35",
                    group.cancelled &&
                      "border-l-4 border-l-destructive/60 bg-destructive/5 hover:bg-destructive/10",
                  )}
                  data-state={expanded ? "selected" : undefined}
                >
                  <TableCell className="whitespace-nowrap text-center">
                    <IndeterminateCheckbox
                      aria-label={t("common.selectRow", {
                        name: group.invoiceNumber,
                      })}
                      checked={groupSelected}
                      indeterminate={groupPartiallySelected}
                      onChange={(event) =>
                        onToggleRows(group.items, event.target.checked)
                      }
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        type="button"
                        size="iconSm"
                        variant="ghost"
                        aria-expanded={expanded}
                        aria-label={
                          expanded
                            ? t("report.collapseBill")
                            : t("report.expandBill")
                        }
                        onClick={() => onToggleGroup(group.id)}
                      >
                        {expanded ? <ChevronDown /> : <ChevronRight />}
                      </Button>
                      <span className="text-sm font-black text-muted-foreground">
                        {pageStart + index}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-black">
                    {group.invoiceNumber}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(group.saleDate)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {group.tableName}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {group.paymentType}
                  </TableCell>
                  <TableCell className="max-w-[220px] whitespace-normal leading-snug">
                    {group.cashierName}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">
                    <Badge className="h-7 px-2 text-xs">
                      {group.itemCount.toLocaleString("en-US")}
                    </Badge>
                  </TableCell>
                  <MoneyCell value={group.lineTotal} strong />
                  {hasStatusData ? (
                    <TableCell className="whitespace-nowrap">
                      <Badge
                        className={statusClass(
                          group.cancelled
                            ? { ...statusRow, cancelled: true }
                            : statusRow,
                          group.status,
                        )}
                      >
                        {group.status}
                      </Badge>
                    </TableCell>
                  ) : null}
                </TableRow>
                {expanded ? (
                  <TableRow
                    className={cn(
                      "border-b border-border/80 bg-muted/20 hover:bg-muted/20",
                      groupNeedsAttention &&
                        "bg-red-50/70 hover:bg-red-50/70 dark:bg-red-950/20 dark:hover:bg-red-950/20",
                    )}
                  >
                    <TableCell colSpan={parentColumnCount} className="p-0">
                      <div className="px-4 py-3">
                        <div className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-primary/5 px-4 py-3">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <Badge className="h-7 border-primary/20 bg-primary/10 px-2 text-primary">
                                {t("fields.no")} {pageStart + index}
                              </Badge>
                              <span className="font-black text-foreground">
                                {group.invoiceNumber}
                              </span>
                              <span className="text-sm font-semibold text-muted-foreground">
                                {group.itemCount.toLocaleString("en-US")}{" "}
                                {t("report.billItems")}
                              </span>
                            </div>
                            <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs font-semibold text-muted-foreground">
                              <Badge className="h-7 border-border bg-background px-2 text-foreground">
                                {t("report.columns.tableName")}:{" "}
                                {group.tableName}
                              </Badge>
                              <Badge className="h-7 border-border bg-background px-2 text-foreground">
                                {t("report.columns.paymentType")}:{" "}
                                {group.paymentType}
                              </Badge>
                            </div>
                          </div>
                          <div className="overflow-x-auto p-3">
                            <Table className="min-w-[1160px] text-[13px]">
                              <TableHeader className="bg-muted/60">
                                <TableRow>
                                  <TableHead className="w-[52px] whitespace-nowrap bg-muted/60 text-center">
                                    <IndeterminateCheckbox
                                      aria-label={t("common.selectAll")}
                                      checked={groupSelected}
                                      indeterminate={groupPartiallySelected}
                                      onChange={(event) =>
                                        onToggleRows(
                                          group.items,
                                          event.target.checked,
                                        )
                                      }
                                    />
                                  </TableHead>
                                  {itemColumns.map((column) =>
                                    column.kind === "image" ? (
                                      <TableHead
                                        key={column.header}
                                        className={cn(
                                          "h-9 whitespace-nowrap bg-muted/60",
                                          column.minWidth,
                                        )}
                                      >
                                        {column.header}
                                      </TableHead>
                                    ) : (
                                      <SortableReportTableHead
                                        key={column.header}
                                        align={column.align}
                                        sort={itemSort}
                                        sortKey={column.header}
                                        className={cn(
                                          "h-9 whitespace-nowrap bg-muted/60",
                                          column.align === "right" &&
                                            "text-right",
                                          column.minWidth,
                                          column.wide && "min-w-[180px]",
                                        )}
                                        onSort={toggleItemSort}
                                      >
                                        {column.header}
                                      </SortableReportTableHead>
                                    ),
                                  )}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sortRowsLocally(
                                  group.items,
                                  itemSort,
                                  getItemSortValue,
                                ).map((item, itemIndex) => {
                                  const recordId = reportRecordId(item);
                                  const selected =
                                    selectedRecordIds.has(recordId);

                                  return (
                                    <TableRow
                                      key={`${rowKey(item, itemIndex)}-${itemIndex}`}
                                      className={cn(
                                        tableRowClass(item, itemIndex),
                                        selected &&
                                          !isCancelledRow(item) &&
                                          !isPaymentAttentionRow(item) &&
                                          "bg-primary/5",
                                      )}
                                    >
                                      <TableCell className="w-[52px] whitespace-nowrap text-center">
                                        <Checkbox
                                          aria-label={t("common.selectRow", {
                                            name: textValue(
                                              readValue(item, [
                                                "product_name",
                                                "prod_name",
                                                "prod_name_la",
                                                "prod_name_eng",
                                              ]),
                                              `${group.invoiceNumber}-${itemIndex + 1}`,
                                            ),
                                          })}
                                          checked={selected}
                                          onChange={(event) =>
                                            onToggleRow(
                                              item,
                                              event.target.checked,
                                            )
                                          }
                                        />
                                      </TableCell>
                                      {itemColumns.map((column) => (
                                        <TableCell
                                          key={column.header}
                                          className={cn(
                                            tableCellClass(item, column),
                                            column.kind === "image" && "pl-4",
                                          )}
                                        >
                                          {renderCell(item, column)}
                                        </TableCell>
                                      ))}
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                          <div className="grid gap-2 border-t border-border bg-muted/20 p-3 text-xs sm:grid-cols-2 xl:grid-cols-5">
                            {billSummaryMetrics(t, group).map((metric) => (
                              <BillMetric
                                key={metric.label}
                                label={metric.label}
                                strong={metric.strong}
                                value={metric.value}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function renderPrintCell(row: ApiEntity, column: ReportColumn) {
  const value = readValue(row, column.keys);

  if (column.kind === "image") {
    return <PrintProductImage row={row} />;
  }

  if (column.kind === "product") return <PrintProductNameCell row={row} />;
  if (column.kind === "money") return money(firstNumber(value));
  if (column.kind === "number")
    return firstNumber(value).toLocaleString("en-US");
  if (column.kind === "date") return formatDate(value);
  return textValue(value, "");
}

function renderCell(row: ApiEntity, column: ReportColumn) {
  const value = readValue(row, column.keys);

  if (column.kind === "image") return <ProductImage row={row} />;
  if (column.kind === "product") return <ProductNameCell row={row} />;
  if (column.kind === "money") return money(firstNumber(value));
  if (column.kind === "number")
    return firstNumber(value).toLocaleString("en-US");
  if (column.kind === "date") return formatDate(value);
  if (column.kind === "status") {
    const label = textValue(value);
    return <Badge className={statusClass(row, label)}>{label}</Badge>;
  }

  return textValue(value);
}

function dailySalesBillSortValue(
  group: DailySalesBillGroup,
  key: DailySalesBillSortKey,
) {
  switch (key) {
    case "cashierName":
      return group.cashierName;
    case "invoiceNumber":
      return group.invoiceNumber;
    case "itemCount":
      return group.itemCount;
    case "lineTotal":
      return group.lineTotal;
    case "paymentType":
      return group.paymentType;
    case "saleDate":
      return group.saleDate;
    case "status":
      return group.status;
    case "tableName":
      return group.tableName;
  }
}

function tableRowClass(row: ApiEntity, index: number) {
  return cn(
    "group border-b border-border/80",
    index % 2 === 1 && "bg-muted/15",
    isPaymentAttentionRow(row) &&
      "bg-red-50 hover:bg-red-100/70 dark:bg-red-950/25 dark:hover:bg-red-950/35",
    isCancelledRow(row) &&
      "border-l-4 border-l-destructive/60 bg-destructive/5 hover:bg-destructive/10",
  );
}

function tableCellClass(row: ApiEntity, column: ReportColumn) {
  return cn(
    "h-12 whitespace-nowrap text-[13px]",
    column.align === "right" && "text-right tabular-nums",
    column.wide && "max-w-[280px] whitespace-normal leading-snug",
    column.minWidth,
    isZeroColumnValue(row, column) && "text-muted-foreground",
  );
}

function ProductNameCell({ row }: { row: ApiEntity }) {
  const productName = textValue(
    readValue(row, [
      "product_name",
      "prod_name",
      "prod_name_la",
      "prod_name_eng",
    ]),
  );
  const toppings = toppingLines(row);

  return (
    <div className="min-w-0 whitespace-normal leading-snug">
      <p className="font-semibold text-foreground">{productName}</p>
      {toppings.length ? (
        <div className="mt-1 flex flex-col gap-0.5 text-xs font-medium text-muted-foreground">
          {toppings.map((topping, index) => (
            <span key={`${topping}-${index}`}>{topping}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PrintProductNameCell({ row }: { row: ApiEntity }) {
  const productName = textValue(
    readValue(row, [
      "product_name",
      "prod_name",
      "prod_name_la",
      "prod_name_eng",
    ]),
  );
  const toppings = toppingLines(row);

  return (
    <span>
      <strong>{productName}</strong>
      {toppings.length ? (
        <span className="report-print-toppings">
          {toppings.map((topping, index) => (
            <span key={`${topping}-${index}`}>{topping}</span>
          ))}
        </span>
      ) : null}
    </span>
  );
}

function PrintProductImage({ row }: { row: ApiEntity }) {
  const src = reportImageSrc(row);
  const color = reportImageColor(row) || "#10B981";
  const backgroundImage = src ? `url("${printImageUrl(src)}")` : undefined;

  return (
    <span
      aria-hidden="true"
      className="report-print-image"
      style={{
        backgroundColor: backgroundImage ? "#ffffff" : color,
        backgroundImage,
      }}
    />
  );
}

function printImageUrl(src: string) {
  if (/^https?:\/\//i.test(src)) {
    return `/_next/image?url=${encodeURIComponent(src)}&w=48&q=75`;
  }
  return src;
}

function ProductImage({ row }: { row: ApiEntity }) {
  const src = reportImageSrc(row);
  const color = reportImageColor(row);
  const name = textValue(
    readValue(row, [
      "product_name",
      "prod_name",
      "prod_name_la",
      "prod_name_eng",
    ]),
    "Product",
  );

  return (
    <span
      className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted"
      style={color ? { backgroundColor: color } : undefined}
    >
      {src ? (
        <Image
          src={src}
          alt={name}
          fill
          sizes="64px"
          className="object-cover"
        />
      ) : color ? null : (
        <Package className="text-muted-foreground" />
      )}
    </span>
  );
}

function MoneyCell({
  strong = false,
  value,
}: {
  strong?: boolean;
  value: number;
}) {
  return (
    <TableCell
      className={cn(
        "whitespace-nowrap text-right tabular-nums",
        strong && "font-black",
        value === 0 && "text-muted-foreground",
      )}
    >
      {money(value)}
    </TableCell>
  );
}

function BillMetric({
  label,
  strong = false,
  value,
}: {
  label: string;
  strong?: boolean;
  value: number;
}) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-card px-3 py-2">
      <p className="truncate font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 truncate tabular-nums text-foreground",
          strong ? "font-black" : "font-bold",
          value === 0 && "text-muted-foreground",
        )}
      >
        {money(value)}
      </p>
    </div>
  );
}

function IndeterminateCheckbox({
  indeterminate = false,
  ...props
}: CheckboxProps & { indeterminate?: boolean }) {
  const checkboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <Checkbox
      ref={checkboxRef}
      aria-checked={indeterminate ? "mixed" : props.checked ? "true" : "false"}
      {...props}
    />
  );
}

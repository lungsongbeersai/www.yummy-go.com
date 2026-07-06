"use client";

import { Fragment, useCallback } from "react";
import Image from "next/image";
import { ChevronDown, ChevronRight, Package } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import type { ApiEntity } from "@/services/shared/types";
import type { DailySalesBillGroup } from "@/stores/report-store";
import { SortableReportTableHead } from "../report-sort-table-head";
import { ReportIndeterminateCheckbox } from "../report-row-selection";
import { useLocalTableSort } from "../report-sort-utils";
import type { ReportColumn, ReportTab } from "./daily-sales-report-types";
import type { SummaryCards } from "./daily-sales-report-types";
import {
  firstOptionalNumber,
  firstNumber,
  formatDate,
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
  summaryCardValue,
  textValue,
  toppingLines,
} from "./daily-sales-report-utils";

type DailySalesBillSortKey =
  | "amount"
  | "discount"
  | "invoiceNumber"
  | "itemCount"
  | "lineTotal"
  | "paymentType"
  | "salePrice"
  | "saleDate"
  | "serviceCharge"
  | "status"
  | "tableName"
  | "toppingTotal"
  | "vat";

type SummaryColumnKey =
  | "invoice"
  | "date"
  | "tableName"
  | "paymentMethod"
  | "quantity"
  | "amount"
  | "discountBill"
  | "afterDiscount"
  | "serviceCharge"
  | "vat"
  | "total"
  | "paidCash"
  | "paidTransfer"
  | "changeAmount"
  | "lastPaidAt";

type SummaryColumn = {
  align?: "left" | "right";
  key: SummaryColumnKey;
  label: string;
  minWidth: string;
  sortableKey: string;
};

type MoneyCellTone = "default" | "discount" | "service" | "total" | "vat";

function summaryColumns(t: (key: string) => string): SummaryColumn[] {
  return [
    {
      key: "invoice",
      label: t("report.columns.invoiceNumber"),
      minWidth: "min-w-[132px]",
      sortableKey: "order_invoice",
    },
    {
      key: "date",
      label: t("report.columns.saleDate"),
      minWidth: "min-w-[118px]",
      sortableKey: "date",
    },
    {
      key: "tableName",
      label: t("report.columns.tableName"),
      minWidth: "min-w-[96px]",
      sortableKey: "table_name",
    },
    {
      key: "paymentMethod",
      label: t("report.columns.paymentType"),
      minWidth: "min-w-[138px]",
      sortableKey: "payment_method_name",
    },
    {
      key: "quantity",
      label: t("report.columns.quantity"),
      align: "right",
      minWidth: "min-w-[92px]",
      sortableKey: "total_qty",
    },
    {
      key: "amount",
      label: t("report.columns.totalAmount"),
      align: "right",
      minWidth: "min-w-[132px]",
      sortableKey: "amount",
    },
    {
      key: "discountBill",
      label: t("report.columns.billDiscount"),
      align: "right",
      minWidth: "min-w-[132px]",
      sortableKey: "discount_bill",
    },
    {
      key: "afterDiscount",
      label: t("report.columns.afterDiscount"),
      align: "right",
      minWidth: "min-w-[138px]",
      sortableKey: "after_discount",
    },
    {
      key: "serviceCharge",
      label: t("dashboard.serviceCharge"),
      align: "right",
      minWidth: "min-w-[138px]",
      sortableKey: "sum_servicecharge",
    },
    {
      key: "vat",
      label: t("dashboard.vat"),
      align: "right",
      minWidth: "min-w-[104px]",
      sortableKey: "sum_vate",
    },
    {
      key: "total",
      label: t("common.total"),
      align: "right",
      minWidth: "min-w-[132px]",
      sortableKey: "sum_total",
    },
    {
      key: "paidCash",
      label: t("report.columns.paidCash"),
      align: "right",
      minWidth: "min-w-[132px]",
      sortableKey: "paid_cash",
    },
    {
      key: "paidTransfer",
      label: t("report.columns.paidTransfer"),
      align: "right",
      minWidth: "min-w-[142px]",
      sortableKey: "paid_transfer",
    },
    {
      key: "changeAmount",
      label: t("report.columns.changeAmount"),
      align: "right",
      minWidth: "min-w-[124px]",
      sortableKey: "change_amount",
    },
    {
      key: "lastPaidAt",
      label: t("report.columns.lastPaidAt"),
      minWidth: "min-w-[148px]",
      sortableKey: "last_paid_at",
    },
  ];
}

export function SummaryReportTable({
  columns,
  pageStart,
  rows,
  selectedRecordIds,
  summaryCards,
  reportTotal,
  typePage,
  onToggleRow,
  onToggleRows,
}: {
  columns: ReportColumn[];
  pageStart: number;
  reportTotal: ApiEntity;
  rows: ApiEntity[];
  selectedRecordIds: Set<string>;
  summaryCards: SummaryCards;
  typePage: ReportTab;
  onToggleRow: (row: ApiEntity, selected: boolean) => void;
  onToggleRows: (rows: ApiEntity[], selected: boolean) => void;
}) {
  const { t } = useTranslation();
  const activeColumns = typePage === "bill" ? summaryColumns(t) : null;

  const getSortValue = useCallback(
    (row: ApiEntity, key: string) => {
      if (activeColumns) return summaryCellValue(row, key);
      const column = columns.find((item) => item.header === key);
      return column ? readValue(row, column.keys) : undefined;
    },
    [activeColumns, columns],
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
    <div className="w-full min-w-0">
      <Table className="w-max min-w-full table-auto text-xs">
        <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-30 [&_th]:h-9 [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-border [&_th]:bg-muted/80 [&_th]:px-2 [&_th]:shadow-sm [&_th]:backdrop-blur">
          <TableRow>
            <TableHead className="w-10 text-center">
              <ReportIndeterminateCheckbox
                aria-label={t("common.selectAll")}
                checked={allVisibleSelected}
                indeterminate={!allVisibleSelected && someVisibleSelected}
                onChange={(event) =>
                  onToggleRows(sortedRows, event.target.checked)
                }
              />
            </TableHead>

            <TableHead className="w-px text-center">{t("fields.no")}</TableHead>

            {activeColumns
              ? activeColumns.map((column) => (
                  <SortableReportTableHead
                    key={column.key}
                    align={column.align}
                    sort={sort}
                    sortKey={column.sortableKey}
                    className={cn(
                      "h-9",
                      column.minWidth,
                      column.align === "right" && "text-right",
                    )}
                    onSort={toggleSort}
                  >
                    {column.label}
                  </SortableReportTableHead>
                ))
              : columns.map((column) =>
                  column.kind === "image" ? (
                    <TableHead key={column.header} className="h-9">
                      {column.header}
                    </TableHead>
                  ) : (
                    <SortableReportTableHead
                      key={column.header}
                      align={column.align}
                      sort={sort}
                      sortKey={column.header}
                      className={cn(
                        "h-9",
                        column.align === "right" && "text-right",
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
                <TableCell className="w-10 text-center">
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

                <TableCell className="w-px text-center text-xs font-black text-muted-foreground">
                  {pageStart + index}
                </TableCell>

                {activeColumns
                  ? activeColumns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={summaryCellClass(row, column)}
                      >
                        {renderSummaryCell(row, column)}
                      </TableCell>
                    ))
                  : columns.map((column) => (
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
          {activeColumns ? (
            <SummaryReportFooterRow
              reportTotal={reportTotal}
              summaryCards={summaryCards}
              summaryLabel={t("report.summary")}
              billCountLabel={t("report.cards.billsCount")}
            />
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}

function summaryCellValue(row: ApiEntity, key: string) {
  return readValue(row, [key]);
}

function summaryCellClass(row: ApiEntity, column: SummaryColumn) {
  const value = summaryCellValue(row, column.sortableKey);

  return cn(
    "h-9 whitespace-nowrap px-2 text-xs",
    column.minWidth,
    column.align === "right" && "text-right tabular-nums",
    column.key === "invoice" && "font-black",
    column.key === "total" && "font-black",
    firstNumber(value) === 0 &&
      [
        "amount",
        "discountBill",
        "afterDiscount",
        "serviceCharge",
        "vat",
        "paidCash",
        "paidTransfer",
        "changeAmount",
      ].includes(column.key) &&
      "text-muted-foreground",
  );
}

function renderSummaryCell(row: ApiEntity, column: SummaryColumn) {
  switch (column.key) {
    case "date":
      return formatDate(readValue(row, ["order_date", "date", "sale_date"]));
    case "invoice":
      return textValue(
        readValue(row, [
          "order_invoice",
          "invoice",
          "invoice_number",
          "invoice_no",
        ]),
      );
    case "tableName":
      return textValue(readValue(row, ["table_name", "tableName"]), "-");
    case "paymentMethod":
      return textValue(
        readValue(row, [
          "payment_method_name",
          "payment_method",
          "payment_type",
        ]),
        "-",
      );
    case "quantity":
      return firstNumber(
        readValue(row, ["total_qty", "qty_total"]),
      ).toLocaleString("en-US");
    case "amount":
      return money(firstNumber(readValue(row, ["amount"])));
    case "discountBill":
      return money(firstNumber(readValue(row, ["discount_bill"])));
    case "afterDiscount":
      return money(firstNumber(readValue(row, ["after_discount"])));
    case "serviceCharge":
      return money(firstNumber(readValue(row, ["sum_servicecharge"])));
    case "vat":
      return money(firstNumber(readValue(row, ["sum_vate"])));
    case "total":
      return money(firstNumber(readValue(row, ["sum_total"])));
    case "paidCash":
      return money(firstNumber(readValue(row, ["paid_cash"])));
    case "paidTransfer":
      return money(firstNumber(readValue(row, ["paid_transfer"])));
    case "changeAmount":
      return money(firstNumber(readValue(row, ["change_amount"])));
    case "lastPaidAt":
      return formatDate(readValue(row, ["last_paid_at"]));
  }
}

function SummaryReportFooterRow({
  billCountLabel,
  reportTotal,
  summaryCards,
  summaryLabel,
}: {
  billCountLabel: string;
  reportTotal: ApiEntity;
  summaryCards: SummaryCards;
  summaryLabel: string;
}) {
  return (
    <TableRow className="border-t border-primary/25 bg-primary/5 hover:bg-primary/10">
      <SummaryFooterBlankCell />
      <SummaryFooterBlankCell />
      <SummaryFooterLabelCell
        billCount={summaryMetricNumber(summaryCards, reportTotal, [
          "bill_count",
          "bills_count",
          "total_bills",
        ])}
        billCountLabel={billCountLabel}
        colSpan={4}
        label={summaryLabel}
      />
      <SummaryFooterNumberCell
        value={summaryMetricNumber(summaryCards, reportTotal, ["total_qty"])}
      />
      <SummaryFooterMoneyCell
        value={summaryMetricNumber(summaryCards, reportTotal, ["amount"])}
      />
      <SummaryFooterMoneyCell
        tone="discount"
        value={summaryMetricNumber(summaryCards, reportTotal, [
          "discount_bill",
        ])}
      />
      <SummaryFooterMoneyCell
        value={summaryMetricNumber(summaryCards, reportTotal, [
          "after_discount",
        ])}
      />
      <SummaryFooterMoneyCell
        value={summaryMetricNumber(summaryCards, reportTotal, [
          "sum_servicecharge",
        ])}
      />
      <SummaryFooterMoneyCell
        value={summaryMetricNumber(summaryCards, reportTotal, ["sum_vate"])}
      />
      <SummaryFooterMoneyCell
        strong
        tone="total"
        value={summaryMetricNumber(summaryCards, reportTotal, ["sum_total"])}
      />
      <SummaryFooterMoneyCell
        value={summaryMetricNumber(summaryCards, reportTotal, [
          "paid_cash",
          "receive_cash",
        ])}
      />
      <SummaryFooterMoneyCell
        value={summaryMetricNumber(summaryCards, reportTotal, [
          "paid_transfer",
          "receive_transfer",
        ])}
      />
      <SummaryFooterMoneyCell
        value={summaryMetricNumber(summaryCards, reportTotal, [
          "change_amount",
        ])}
      />
      <SummaryFooterBlankCell />
    </TableRow>
  );
}

export function DetailBillTable({
  collapsedGroups,
  groups,
  pageStart,
  reportTotal,
  selectedRecordIds,
  summaryCards,
  onToggleGroup,
  onToggleRow,
  onToggleRows,
}: {
  collapsedGroups: Set<string>;
  groups: DailySalesBillGroup[];
  itemColumns: ReportColumn[];
  pageStart: number;
  reportTotal: ApiEntity;
  selectedRecordIds: Set<string>;
  summaryCards: SummaryCards;
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
  return (
    <div className="w-full min-w-0">
      <Table className="w-max min-w-full table-auto text-xs">
        <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-30 [&_th]:h-9 [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-border [&_th]:bg-muted/80 [&_th]:px-2 [&_th]:shadow-sm [&_th]:backdrop-blur">
          <TableRow>
            <TableHead className="w-10 text-center">
              <ReportIndeterminateCheckbox
                aria-label={t("common.selectAll")}
                checked={allVisibleSelected}
                indeterminate={!allVisibleSelected && someVisibleSelected}
                onChange={(event) =>
                  onToggleRows(visibleItems, event.target.checked)
                }
              />
            </TableHead>

            <TableHead className="w-16 text-center">{t("fields.no")}</TableHead>

            <SortableReportTableHead
              sort={groupSort}
              sortKey="invoiceNumber"
              className="min-w-[132px]"
              onSort={toggleGroupSort}
            >
              {t("report.columns.invoiceNumber")}
            </SortableReportTableHead>

            <SortableReportTableHead
              sort={groupSort}
              sortKey="saleDate"
              className="min-w-[118px]"
              onSort={toggleGroupSort}
            >
              {t("report.columns.saleDate")}
            </SortableReportTableHead>

            <SortableReportTableHead
              sort={groupSort}
              sortKey="tableName"
              className="min-w-[96px]"
              onSort={toggleGroupSort}
            >
              {t("report.columns.tableName")}
            </SortableReportTableHead>

            <SortableReportTableHead
              sort={groupSort}
              sortKey="paymentType"
              className="min-w-[138px]"
              onSort={toggleGroupSort}
            >
              {t("report.columns.paymentType")}
            </SortableReportTableHead>

            <SortableReportTableHead
              align="right"
              sort={groupSort}
              sortKey="salePrice"
              className="min-w-[132px] text-right"
              onSort={toggleGroupSort}
            >
              {t("report.columns.salePrice")}
            </SortableReportTableHead>

            <SortableReportTableHead
              align="right"
              sort={groupSort}
              sortKey="itemCount"
              className="min-w-[92px] text-right"
              onSort={toggleGroupSort}
            >
              {t("report.columns.quantity")}
            </SortableReportTableHead>

            <SortableReportTableHead
              align="right"
              sort={groupSort}
              sortKey="toppingTotal"
              className="min-w-[138px] text-right"
              onSort={toggleGroupSort}
            >
              {t("report.columns.toppingTotal")}
            </SortableReportTableHead>

            <SortableReportTableHead
              align="right"
              sort={groupSort}
              sortKey="amount"
              className="min-w-[132px] text-right"
              onSort={toggleGroupSort}
            >
              {t("report.columns.amount")}
            </SortableReportTableHead>

            <SortableReportTableHead
              align="right"
              sort={groupSort}
              sortKey="discount"
              className="min-w-[124px] text-right"
              onSort={toggleGroupSort}
            >
              {t("report.columns.discount")}
            </SortableReportTableHead>

            <SortableReportTableHead
              align="right"
              sort={groupSort}
              sortKey="lineTotal"
              className="min-w-[132px] text-right"
              onSort={toggleGroupSort}
            >
              {t("common.total", { defaultValue: "Total" })}
            </SortableReportTableHead>

            {hasStatusData ? (
              <SortableReportTableHead
                sort={groupSort}
                sortKey="status"
                className="min-w-[118px]"
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
                    "border-b border-border/80 bg-card hover:bg-muted/25 [&>td]:whitespace-nowrap [&>td]:px-2 [&>td]:py-2",
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
                  <TableCell className="text-center">
                    <ReportIndeterminateCheckbox
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

                  <TableCell className="text-center">
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
                      <span className="text-xs font-black text-muted-foreground">
                        {pageStart + index}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className="font-black">
                    {group.invoiceNumber}
                  </TableCell>
                  <TableCell>{formatDate(group.saleDate)}</TableCell>
                  <TableCell>{group.tableName}</TableCell>
                  <TableCell>{group.paymentType}</TableCell>

                  {expanded ? (
                    <>
                      <BlankCell align="right" />
                      <BlankCell align="right" />
                      <BlankCell align="right" />
                      <BlankCell align="right" />
                      <BlankCell align="right" />
                      <BlankCell align="right" />
                    </>
                  ) : (
                    <>
                      <OptionalMoneyCell
                        value={groupSellingPriceTotal(group)}
                      />
                      <TableCell className="text-right font-black tabular-nums">
                        {groupQuantity(group).toLocaleString("en-US")}
                      </TableCell>
                      <OptionalMoneyCell value={group.toppingTotal} />
                      <OptionalMoneyCell value={group.amountTotal} />
                      <OptionalMoneyCell
                        tone="discount"
                        value={groupDiscountTotal(group)}
                      />
                      <MoneyCell value={group.lineTotal} strong tone="total" />
                    </>
                  )}

                  {hasStatusData ? (
                    <TableCell>
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
                  <>
                    {group.items.map((item, itemIndex) => {
                      const recordId = reportRecordId(item);
                      const selected = selectedRecordIds.has(recordId);

                      return (
                        <TableRow
                          key={`${rowKey(item, itemIndex)}-${itemIndex}`}
                          className={cn(
                            "border-b border-border/80 bg-background hover:bg-muted/20 [&>td]:whitespace-nowrap [&>td]:px-2 [&>td]:py-2",
                            groupNeedsAttention &&
                              "bg-red-50/70 hover:bg-red-50/70 dark:bg-red-950/20 dark:hover:bg-red-950/20",
                            selected &&
                              !isCancelledRow(item) &&
                              !isPaymentAttentionRow(item) &&
                              "bg-primary/5",
                          )}
                        >
                          <TableCell className="text-center">
                            <Checkbox
                              aria-label={t("common.selectRow", {
                                name: itemProductName(
                                  item,
                                  `${group.invoiceNumber}-${itemIndex + 1}`,
                                ),
                              })}
                              checked={selected}
                              onChange={(event) =>
                                onToggleRow(item, event.target.checked)
                              }
                            />
                          </TableCell>

                          <TableCell />

                          <TableCell colSpan={4}>
                            <div className="flex min-w-72 items-center gap-2">
                              <ProductImage row={item} />
                              <ProductNameCell row={item} />
                            </div>
                          </TableCell>

                          <OptionalMoneyCell
                            value={itemMoney(item, ["sale_price"])}
                          />
                          <TableCell className="text-right font-black tabular-nums">
                            {itemQuantity(item).toLocaleString("en-US")}
                          </TableCell>
                          <OptionalMoneyCell
                            value={itemMoney(item, ["topping_total"])}
                          />
                          <OptionalMoneyCell
                            value={itemMoney(item, ["amount"])}
                          />
                          <OptionalMoneyCell
                            tone="discount"
                            value={itemMoney(item, ["discount"])}
                          />
                          <OptionalMoneyCell
                            tone="total"
                            value={itemMoney(item, ["total"])}
                            strong
                          />

                          {hasStatusData ? <TableCell /> : null}
                        </TableRow>
                      );
                    })}
                    <DetailBillSummaryRow
                      group={group}
                      hasStatusData={hasStatusData}
                      summaryLabel={t("report.summary")}
                    />
                    <DetailBillAdjustmentRows
                      group={group}
                      hasStatusData={hasStatusData}
                    />
                  </>
                ) : null}
              </Fragment>
            );
          })}
          <DetailReportFooterRow
            hasStatusData={hasStatusData}
            reportTotal={reportTotal}
            summaryCards={summaryCards}
            summaryLabel={t("report.summary")}
            billCountLabel={t("report.cards.billsCount")}
          />
        </TableBody>
      </Table>
    </div>
  );
}

function DetailReportFooterRow({
  billCountLabel,
  hasStatusData,
  reportTotal,
  summaryCards,
  summaryLabel,
}: {
  billCountLabel: string;
  hasStatusData: boolean;
  reportTotal: ApiEntity;
  summaryCards: SummaryCards;
  summaryLabel: string;
}) {
  return (
    <TableRow className="border-t border-primary/25 bg-primary/5 hover:bg-primary/10">
      <SummaryFooterBlankCell />
      <SummaryFooterBlankCell />
      <SummaryFooterLabelCell
        billCount={summaryMetricNumber(summaryCards, reportTotal, [
          "bill_count",
          "bills_count",
          "total_bills",
        ])}
        billCountLabel={billCountLabel}
        colSpan={4}
        label={summaryLabel}
      />
      <SummaryFooterMoneyCell
        value={summaryMetricNumber(summaryCards, reportTotal, [
          "product_price_total",
          "selling_price_total",
          "sale_price_total",
        ])}
      />
      <SummaryFooterNumberCell
        value={summaryMetricNumber(summaryCards, reportTotal, ["total_qty"])}
      />
      <SummaryFooterMoneyCell
        value={summaryMetricNumber(summaryCards, reportTotal, [
          "topping_total",
          "total_topping_price",
          "sum_topping",
        ])}
      />
      <SummaryFooterMoneyCell
        value={summaryMetricNumber(summaryCards, reportTotal, ["amount"])}
      />
      <SummaryFooterMoneyCell
        tone="discount"
        value={summaryMetricNumber(summaryCards, reportTotal, [
          "sum_discount",
          "discount_bill",
          "discount_item",
        ])}
      />
      <SummaryFooterMoneyCell
        strong
        tone="total"
        value={summaryMetricNumber(summaryCards, reportTotal, [
          "sum_total",
          "grand_total",
          "net_total",
        ])}
      />
      {hasStatusData ? <SummaryFooterBlankCell /> : null}
    </TableRow>
  );
}

function DetailBillSummaryRow({
  group,
  hasStatusData,
  summaryLabel,
}: {
  group: DailySalesBillGroup;
  hasStatusData: boolean;
  summaryLabel: string;
}) {
  return (
    <TableRow className="border-0 bg-primary/5 hover:bg-primary/5 [&>td]:whitespace-nowrap [&>td]:px-2 [&>td]:py-2">
      <TableCell />
      <TableCell />
      <TableCell colSpan={4}>
        <span className="text-xs font-black uppercase text-primary">
          {summaryLabel}
        </span>
      </TableCell>
      <OptionalMoneyCell value={groupSellingPriceTotal(group)} strong />
      <TableCell className="text-right font-black tabular-nums">
        {groupQuantity(group).toLocaleString("en-US")}
      </TableCell>
      <OptionalMoneyCell value={group.toppingTotal} strong />
      <OptionalMoneyCell value={group.amountTotal} strong />
      <OptionalMoneyCell
        tone="discount"
        value={groupItemDiscountTotal(group)}
        strong
      />
      <OptionalMoneyCell value={groupItemLineTotal(group)} strong />
      {hasStatusData ? <TableCell /> : null}
    </TableRow>
  );
}

function DetailBillAdjustmentRows({
  group,
  hasStatusData,
}: {
  group: DailySalesBillGroup;
  hasStatusData: boolean;
}) {
  const { t } = useTranslation();

  return (
    <>
      <DetailBillAdjustmentRow
        hasStatusData={hasStatusData}
        label={t("report.columns.billDiscount", {
          defaultValue: "Bill discount",
        })}
        tone="discount"
        value={group.discountBillAmount}
      />
      <DetailBillAdjustmentRow
        hasStatusData={hasStatusData}
        label={t("dashboard.serviceCharge")}
        tone="service"
        value={group.serviceChargeAmount}
      />
      <DetailBillAdjustmentRow
        hasStatusData={hasStatusData}
        label={t("dashboard.vat")}
        tone="vat"
        value={group.vatAmount}
      />
      <DetailBillAdjustmentRow
        hasStatusData={hasStatusData}
        label={t("common.total")}
        last
        tone="total"
        value={group.lineTotal}
      />
    </>
  );
}

function DetailBillAdjustmentRow({
  hasStatusData,
  label,
  last = false,
  tone = "default",
  value,
}: {
  hasStatusData: boolean;
  label: string;
  last?: boolean;
  tone?: MoneyCellTone;
  value: number;
}) {
  return (
    <TableRow
      className={cn(
        "bg-primary/5 hover:bg-primary/5 [&>td]:whitespace-nowrap [&>td]:px-2 [&>td]:py-1",
        last ? "border-b border-border/80" : "border-0",
      )}
    >
      <TableCell colSpan={10} />
      <TableCell className="text-right" colSpan={2}>
        <div className="ml-auto grid w-56 max-w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <span className={adjustmentLabelClass(tone)}>{label}</span>
          <DetailBillAdjustmentValue tone={tone} value={value} />
        </div>
      </TableCell>
      {hasStatusData ? <TableCell /> : null}
    </TableRow>
  );
}

function DetailBillAdjustmentValue({
  tone = "default",
  value,
}: {
  tone?: MoneyCellTone;
  value: number;
}) {
  return (
    <span className={adjustmentValueClass(tone, value)}>
      {money(value)}
    </span>
  );
}

function adjustmentLabelClass(tone: MoneyCellTone) {
  return cn(
    "truncate text-xs font-semibold leading-none",
    tone === "discount" && "text-destructive",
    tone === "service" && "text-sky-700 dark:text-sky-300",
    tone === "vat" && "text-amber-700 dark:text-amber-300",
    tone === "total" && "text-primary",
    tone === "default" && "text-muted-foreground",
  );
}

function adjustmentValueClass(tone: MoneyCellTone, value: number) {
  return cn(
    "whitespace-nowrap text-right font-semibold tabular-nums",
    tone === "discount" && "text-destructive",
    tone === "discount" && value === 0 && "opacity-70",
    tone === "service" &&
      value > 0 &&
      "font-black text-sky-700 dark:text-sky-300",
    tone === "total" && "font-black text-primary",
    tone === "vat" &&
      value > 0 &&
      "font-black text-amber-700 dark:text-amber-300",
    tone === "default" && "font-semibold text-foreground",
    value === 0 &&
      tone !== "discount" &&
      tone !== "total" &&
      "text-muted-foreground",
  );
}

function summaryMetricNumber(
  summaryCards: SummaryCards,
  reportTotal: ApiEntity,
  keys: string[],
) {
  return firstOptionalNumber(summaryCardValue(summaryCards, reportTotal, keys));
}

function SummaryFooterBlankCell({ colSpan }: { colSpan?: number }) {
  return <TableCell className={summaryFooterCellClass()} colSpan={colSpan} />;
}

function SummaryFooterLabelCell({
  billCount,
  billCountLabel,
  colSpan,
  label,
}: {
  billCount: number | null;
  billCountLabel: string;
  colSpan: number;
  label: string;
}) {
  return (
    <TableCell className={summaryFooterCellClass("left")} colSpan={colSpan}>
      <div className="flex min-w-64 items-center gap-2">
        <span className="inline-flex h-6 items-center rounded-full bg-background/80 px-2 text-xs font-black uppercase text-primary ring-1 ring-primary/20">
          {label}
        </span>
        {billCount !== null ? (
          <span className="truncate text-xs font-semibold text-muted-foreground">
            {billCountLabel}: {billCount.toLocaleString("en-US")}
          </span>
        ) : null}
      </div>
    </TableCell>
  );
}

function SummaryFooterMoneyCell({
  strong = false,
  tone = "default",
  value,
}: {
  strong?: boolean;
  tone?: MoneyCellTone;
  value: number | null;
}) {
  if (value === null) return <SummaryFooterBlankCell />;

  return (
    <TableCell
      className={cn(
        summaryFooterCellClass("right"),
        (strong || tone === "total" || (tone === "discount" && value > 0)) &&
          "font-black",
        tone === "total" && "text-foreground",
        tone === "discount" && value > 0 && "text-destructive",
        value === 0 && "text-muted-foreground",
      )}
    >
      {money(value)}
    </TableCell>
  );
}

function SummaryFooterNumberCell({ value }: { value: number | null }) {
  if (value === null) return <SummaryFooterBlankCell />;

  return (
    <TableCell
      className={cn(
        summaryFooterCellClass("right"),
        "font-black",
        value === 0 && "text-muted-foreground",
      )}
    >
      {value.toLocaleString("en-US")}
    </TableCell>
  );
}

export function renderPrintCell(row: ApiEntity, column: ReportColumn) {
  const value = readValue(row, column.keys);

  if (column.kind === "image") return <PrintProductImage row={row} />;
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

function itemProductName(row: ApiEntity, fallback: string) {
  return textValue(
    readValue(row, [
      "product_name",
      "prod_name",
      "prod_name_la",
      "prod_name_eng",
    ]),
    fallback,
  );
}

function itemQuantity(row: ApiEntity) {
  return firstNumber(
    readValue(row, ["quantity", "qty", "order_qty", "qty_total"]),
  );
}

function itemMoney(row: ApiEntity, keys: string[]) {
  const value = readValue(row, keys);
  return hasDisplayValue(value) ? firstNumber(value) : null;
}

function itemSellingPriceTotal(row: ApiEntity) {
  const explicitTotal = itemMoney(row, [
    "product_price_total",
    "base_total",
    "base_line_total",
  ]);
  if (explicitTotal !== null) return explicitTotal;

  const unitPrice = itemMoney(row, [
    "product_price",
    "sale_price",
    "price",
    "unit_price",
    "base_price",
  ]);
  if (unitPrice !== null) return unitPrice * Math.max(itemQuantity(row), 1);

  const amount = itemMoney(row, ["amount"]);
  const toppingTotal = itemMoney(row, ["topping_total"]);
  if (amount !== null) return Math.max(0, amount - (toppingTotal ?? 0));

  return null;
}

function groupSellingPriceTotal(group: DailySalesBillGroup) {
  const itemsTotal = group.items.reduce(
    (total, item) => total + (itemSellingPriceTotal(item) ?? 0),
    0,
  );
  if (itemsTotal > 0) return itemsTotal;
  if (group.baseTotal > 0 && group.baseTotal !== group.amountTotal)
    return group.baseTotal;
  if (group.amountTotal >= group.toppingTotal)
    return group.amountTotal - group.toppingTotal;
  return group.amountTotal;
}

function groupQuantity(group: DailySalesBillGroup) {
  return group.qtyTotal || group.itemCount;
}

function groupDiscountTotal(group: DailySalesBillGroup) {
  return group.discountBillAmount + group.itemDiscountAmount;
}

function groupItemDiscountTotal(group: DailySalesBillGroup) {
  const itemTotal = group.items.reduce(
    (total, item) => total + (itemMoney(item, ["discount"]) ?? 0),
    0,
  );
  return itemTotal > 0 ? itemTotal : group.itemDiscountAmount;
}

function groupItemLineTotal(group: DailySalesBillGroup) {
  let hasLineTotal = false;
  const itemTotal = group.items.reduce((total, item) => {
    const lineTotal = itemMoney(item, ["total", "line_total", "net_total"]);
    if (lineTotal === null) return total;
    hasLineTotal = true;
    return total + lineTotal;
  }, 0);

  if (hasLineTotal) return itemTotal;
  return Math.max(0, group.amountTotal - groupItemDiscountTotal(group));
}

function groupMoney(group: DailySalesBillGroup, keys: string[]) {
  const groupEntity = group as unknown as ApiEntity;
  const value = readValue(groupEntity, keys);
  if (hasDisplayValue(value)) return firstNumber(value);

  if (
    keys.some((key) => ["amount", "order_total", "total_order"].includes(key))
  ) {
    return group.amountTotal;
  }
  if (keys.some((key) => ["topping_total", "toppingTotal"].includes(key))) {
    return group.toppingTotal;
  }
  if (keys.some((key) => ["discount_bill", "discountBill"].includes(key))) {
    return group.discountBillAmount;
  }
  if (
    keys.some((key) =>
      [
        "sum_servicecharge",
        "service_charge",
        "service_charge_amount",
        "serviceCharge",
      ].includes(key),
    )
  ) {
    return group.serviceChargeAmount;
  }
  if (keys.some((key) => ["vat", "vat_amount"].includes(key))) {
    return group.vatAmount;
  }

  const summary = groupEntity.summary;
  if (!summary || typeof summary !== "object") return null;

  const summaryValue = readValue(summary as ApiEntity, keys);
  return hasDisplayValue(summaryValue) ? firstNumber(summaryValue) : null;
}

function dailySalesBillSortValue(
  group: DailySalesBillGroup,
  key: DailySalesBillSortKey,
) {
  switch (key) {
    case "amount":
      return groupMoney(group, ["amount"]) ?? 0;
    case "discount":
      return groupDiscountTotal(group);
    case "invoiceNumber":
      return group.invoiceNumber;
    case "itemCount":
      return groupQuantity(group);
    case "lineTotal":
      return group.lineTotal;
    case "paymentType":
      return group.paymentType;
    case "salePrice":
      return groupSellingPriceTotal(group);
    case "saleDate":
      return group.saleDate;
    case "serviceCharge":
      return (
        groupMoney(group, [
          "sum_servicecharge",
          "service_charge",
          "serviceCharge",
        ]) ?? 0
      );
    case "status":
      return group.status;
    case "tableName":
      return group.tableName;
    case "toppingTotal":
      return groupMoney(group, ["topping_total", "toppingTotal"]) ?? 0;
    case "vat":
      return groupMoney(group, ["vat"]) ?? 0;
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
    "h-9 whitespace-nowrap px-2 text-xs",
    column.align === "right" && "text-right tabular-nums",
    column.kind === "product" && "max-w-72",
    column.wide && column.kind !== "product" && "max-w-72 truncate",
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
    <div className="min-w-0 leading-snug">
      <p className="max-w-72 truncate font-semibold text-foreground">
        {productName}
      </p>
      {toppings.length ? (
        <div className="mt-1 flex max-w-72 flex-col gap-0.5 text-xs font-medium text-muted-foreground">
          {toppings.map((topping, index) => (
            <span key={`${topping}-${index}`} className="truncate">
              {topping}
            </span>
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
  if (/^https?:\/\//i.test(src))
    return `/_next/image?url=${encodeURIComponent(src)}&w=48&q=75`;
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
      className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted"
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

function summaryFooterCellClass(align: "left" | "right" = "left") {
  return cn(
    "sticky bottom-0 z-20 h-10 whitespace-nowrap border-t border-primary/25 bg-primary/10 px-2 py-2 backdrop-blur supports-[backdrop-filter]:bg-primary/10",
    align === "right" && "text-right tabular-nums",
  );
}

function MoneyCell({
  strong = false,
  tone = "default",
  value,
}: {
  strong?: boolean;
  tone?: MoneyCellTone;
  value: number;
}) {
  return (
    <TableCell
      className={cn(
        "whitespace-nowrap px-2 text-right tabular-nums",
        (strong || tone === "total" || (tone === "discount" && value > 0)) &&
          "font-black",
        tone === "total" && "text-foreground",
        tone === "discount" && value > 0 && "text-destructive",
        value === 0 && "text-muted-foreground",
      )}
    >
      {money(value)}
    </TableCell>
  );
}

function OptionalMoneyCell({
  strong = false,
  tone = "default",
  value,
}: {
  strong?: boolean;
  tone?: MoneyCellTone;
  value: number | null;
}) {
  if (value === null) return <BlankCell align="right" />;
  return <MoneyCell value={value} strong={strong} tone={tone} />;
}

function BlankCell({ align = "left" }: { align?: "left" | "right" }) {
  return (
    <TableCell
      className={cn(
        "whitespace-nowrap px-2 text-muted-foreground",
        align === "right" && "text-right",
      )}
    />
  );
}


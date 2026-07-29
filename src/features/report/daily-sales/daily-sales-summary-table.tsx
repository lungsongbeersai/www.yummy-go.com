"use client";

import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
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
import { SortableReportTableHead } from "../report-sort-table-head";
import { ReportIndeterminateCheckbox } from "../shared/report-row-selection";
import { useLocalTableSort } from "../shared/report-sort-utils";
import type {
  ReportColumn,
  ReportTab,
  SummaryCards,
} from "./daily-sales-report-types";
import {
  firstNumber,
  formatDate,
  isCancelledRow,
  isPaymentAttentionRow,
  readValue,
  reportRecordId,
  rowKey,
  textValue,
} from "./daily-sales-report-utils";
import {
  renderCell,
  SummaryFooterBlankCell,
  SummaryFooterLabelCell,
  SummaryFooterMoneyCell,
  SummaryFooterNumberCell,
  summaryMetricNumber,
  tableCellClass,
  tableRowClass,
} from "./daily-sales-report-cells";

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
  const activeColumns = useMemo(
    () => (typePage === "bill" ? summaryColumns(t) : null),
    [t, typePage],
  );
  const columnByHeader = useMemo(
    () => new Map(columns.map((column) => [column.header, column])),
    [columns],
  );

  const getSortValue = useCallback(
    (row: ApiEntity, key: string) => {
      if (activeColumns) return summaryCellValue(row, key);
      const column = columnByHeader.get(key);
      return column ? readValue(row, column.keys) : undefined;
    },
    [activeColumns, columnByHeader],
  );

  const { sort, sortedRows, toggleSort } = useLocalTableSort(
    rows,
    getSortValue,
  );
  const visibleIds = useMemo(
    () => sortedRows.map(reportRecordId),
    [sortedRows],
  );
  const allVisibleSelected =
    visibleIds.length > 0 &&
    visibleIds.every((id) => selectedRecordIds.has(id));
  const someVisibleSelected = visibleIds.some((id) =>
    selectedRecordIds.has(id),
  );

  return (
    <div className="w-full min-w-0">
      <Table className="w-max min-w-full table-auto text-xs">
        <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-30 [&_th]:h-9 [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-border [&_th]:bg-muted [&_th]:px-2 [&_th]:shadow-sm">
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
    <TableRow className="border-t-2 border-primary bg-muted font-bold text-foreground hover:bg-muted">
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

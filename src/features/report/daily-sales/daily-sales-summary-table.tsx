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
import type { ReportColumnOption } from "../shared/report-column-visibility";
import { ReportIndeterminateCheckbox } from "../shared/report-row-selection";
import { useLocalTableSort } from "../shared/report-sort-utils";
import {
  NO_COLUMN_PINNING,
  STICKY_TABLE_CLASS,
  useStickyTable,
  type ReportColumnPinning,
} from "../shared/report-sticky-table";
import { ReportColumnPinningProvider, ReportRowPinToggle, ReportRowPinningProvider } from "@/features/report/shared/report-column-head";
import type {
  ReportColumn,
  ReportTab,
  SummaryCards,
} from "./daily-sales-report-types";
import {
  billPaymentMethodLabel,
  firstNumber,
  formatDate,
  formatSaleDate,
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

type SummaryColumnFooter = {
  keys: string[];
  kind: "money" | "number";
  strong?: boolean;
  tone?: "discount" | "total";
};

type SummaryColumn = {
  align?: "left" | "right";
  footer?: SummaryColumnFooter;
  hideable?: boolean;
  key: SummaryColumnKey;
  label: string;
  minWidth: string;
  sortableKey: string;
};

/** ตัวเลือกของเมนู "คอลัมน์" — เลขบิลเป็นคอลัมน์หลักของแถว ซ่อนไม่ได้ */
export function summaryColumnOptions(t: (key: string) => string): ReportColumnOption[] {
  return summaryColumns(t).map((column) => ({
    hideable: column.hideable,
    id: column.key,
    label: column.label,
  }));
}

function summaryColumns(t: (key: string) => string): SummaryColumn[] {
  return [
    {
      key: "invoice",
      hideable: false,
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
      footer: { keys: ["total_qty"], kind: "number" },
      label: t("report.columns.quantity"),
      align: "right",
      minWidth: "min-w-[92px]",
      sortableKey: "total_qty",
    },
    {
      key: "amount",
      footer: { keys: ["amount"], kind: "money" },
      label: t("report.columns.totalAmount"),
      align: "right",
      minWidth: "min-w-[132px]",
      sortableKey: "amount",
    },
    {
      key: "discountBill",
      footer: { keys: ["discount_bill"], kind: "money", tone: "discount" },
      label: t("report.columns.billDiscount"),
      align: "right",
      minWidth: "min-w-[132px]",
      sortableKey: "discount_bill",
    },
    {
      key: "afterDiscount",
      footer: { keys: ["after_discount"], kind: "money" },
      label: t("report.columns.afterDiscount"),
      align: "right",
      minWidth: "min-w-[138px]",
      sortableKey: "after_discount",
    },
    {
      key: "serviceCharge",
      footer: { keys: ["sum_servicecharge"], kind: "money" },
      label: t("dashboard.serviceCharge"),
      align: "right",
      minWidth: "min-w-[138px]",
      sortableKey: "sum_servicecharge",
    },
    {
      key: "vat",
      footer: { keys: ["sum_vate"], kind: "money" },
      label: t("dashboard.vat"),
      align: "right",
      minWidth: "min-w-[104px]",
      sortableKey: "sum_vate",
    },
    {
      key: "total",
      footer: { keys: ["sum_total"], kind: "money", strong: true, tone: "total" },
      label: t("common.total"),
      align: "right",
      minWidth: "min-w-[132px]",
      sortableKey: "sum_total",
    },
    {
      key: "paidCash",
      footer: { keys: ["paid_cash", "receive_cash"], kind: "money" },
      label: t("report.columns.paidCash"),
      align: "right",
      minWidth: "min-w-[132px]",
      sortableKey: "paid_cash",
    },
    {
      key: "paidTransfer",
      footer: { keys: ["paid_transfer", "receive_transfer"], kind: "money" },
      label: t("report.columns.paidTransfer"),
      align: "right",
      minWidth: "min-w-[142px]",
      sortableKey: "paid_transfer",
    },
    {
      key: "changeAmount",
      footer: { keys: ["change_amount"], kind: "money" },
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
  isColumnVisible,
  pageStart,
  pinning,
  rows,
  selectedRecordIds,
  summaryCards,
  reportTotal,
  typePage,
  onToggleRow,
  onToggleRows,
}: {
  columns: ReportColumn[];
  isColumnVisible: (id: string) => boolean;
  pageStart: number;
  pinning: ReportColumnPinning;
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
    () => (typePage === "bill" ? summaryColumns(t).filter((column) => isColumnVisible(column.key)) : null),
    [isColumnVisible, t, typePage],
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

  // ล็อกคอลัมน์ได้เฉพาะมุมมองบิล (คอลัมน์รู้จักล่วงหน้า) — มุมมองอื่นหัวตารางมาจาก API
  const stickyRef = useStickyTable(activeColumns ? pinning : NO_COLUMN_PINNING);

  return (
    // container ของ Table เป็นตัวสกรอลเอง — หัวตาราง sticky ด้านบน, แถวรวม sticky ด้านล่าง
    <Table containerClassName={cn("min-h-0 flex-1 overflow-auto", STICKY_TABLE_CLASS)} containerRef={stickyRef}>
        <ReportColumnPinningProvider pinning={activeColumns ? pinning : NO_COLUMN_PINNING}>
        <TableHeader className="sticky top-0 z-30 bg-muted">
          <TableRow>
            <TableHead>
              <ReportIndeterminateCheckbox
                aria-label={t("common.selectAll")}
                checked={allVisibleSelected}
                indeterminate={!allVisibleSelected && someVisibleSelected}
                onCheckedChange={(checked) => onToggleRows(sortedRows, checked as boolean)}
              />
            </TableHead>

            <TableHead>{t("fields.no")}</TableHead>

            {activeColumns
              ? activeColumns.map((column) => (
                  <SortableReportTableHead
                    key={column.key}
                    align={column.align}
                    sort={sort}
                    sortKey={column.sortableKey}
                    className={cn(column.minWidth, column.align === "right" && "text-right")}
                    columnId={column.key}
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
        </ReportColumnPinningProvider>

        <ReportRowPinningProvider>
        <TableBody>
          {sortedRows.map((row, index) => {
            const recordId = reportRecordId(row);
            const selected = selectedRecordIds.has(recordId);
            const rowLabel = textValue(
              readValue(row, ["invoice_number", "invoice_no", "invoice", "order_invoice"]),
              String(pageStart + index),
            );

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
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Checkbox
                      aria-label={t("common.selectRow", {
                        name: rowLabel,
                      })}
                      checked={selected}
                      onCheckedChange={(checked) => onToggleRow(row, checked as boolean)}
                    />
                    <ReportRowPinToggle isDefault={index === 0} label={rowLabel} rowId={recordId} />
                  </div>
                </TableCell>

                <TableCell className="tabular-nums text-muted-foreground">
                  {pageStart + index}
                </TableCell>

                {activeColumns
                  ? activeColumns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={summaryCellClass(row, column)}
                      >
                        {renderSummaryCell(row, column, t)}
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
              columns={activeColumns}
              reportTotal={reportTotal}
              summaryCards={summaryCards}
              summaryLabel={t("report.summary")}
              billCountLabel={t("report.cards.billsCount")}
            />
          ) : null}
        </TableBody>
        </ReportRowPinningProvider>
    </Table>
  );
}

function summaryCellValue(row: ApiEntity, key: string) {
  return readValue(row, [key]);
}

function summaryCellClass(row: ApiEntity, column: SummaryColumn) {
  const value = summaryCellValue(row, column.sortableKey);

  return cn(
    column.minWidth,
    column.align === "right" && "text-right tabular-nums",
    column.key === "invoice" && "font-medium",
    column.key === "total" && "font-medium text-primary-text",
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

function renderSummaryCell(row: ApiEntity, column: SummaryColumn, t: (key: string) => string) {
  switch (column.key) {
    case "date":
      return formatSaleDate(readValue(row, ["order_date", "date", "sale_date"]));
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
      return billPaymentMethodLabel(row, t);
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

// แถวรวมท้ายตาราง: ป้าย "สรุป" กินช่องเช็กบ็อกซ์ + ลำดับ + คอลัมน์ข้อความที่แสดงอยู่ด้านหน้า
// แล้วต่อด้วยยอดรวมของแต่ละคอลัมน์ตัวเลขที่แสดงอยู่ — นับจากคอลัมน์ที่เปิดอยู่จริง ไม่ fix colSpan
function SummaryReportFooterRow({
  billCountLabel,
  columns,
  reportTotal,
  summaryCards,
  summaryLabel,
}: {
  billCountLabel: string;
  columns: SummaryColumn[];
  reportTotal: ApiEntity;
  summaryCards: SummaryCards;
  summaryLabel: string;
}) {
  const firstFooterIndex = columns.findIndex((column) => column.footer);
  const leadingCount = firstFooterIndex === -1 ? columns.length : firstFooterIndex;

  return (
    <TableRow className="hover:bg-transparent">
      <SummaryFooterLabelCell
        billCount={summaryMetricNumber(summaryCards, reportTotal, [
          "bill_count",
          "bills_count",
          "total_bills",
        ])}
        billCountLabel={billCountLabel}
        colSpan={2 + leadingCount}
        label={summaryLabel}
      />
      {columns.slice(leadingCount).map((column) => {
        const footer = column.footer;
        if (!footer) return <SummaryFooterBlankCell key={column.key} />;
        const value = summaryMetricNumber(summaryCards, reportTotal, footer.keys);
        return footer.kind === "number" ? (
          <SummaryFooterNumberCell key={column.key} value={value} />
        ) : (
          <SummaryFooterMoneyCell key={column.key} strong={footer.strong} tone={footer.tone} value={value} />
        );
      })}
    </TableRow>
  );
}

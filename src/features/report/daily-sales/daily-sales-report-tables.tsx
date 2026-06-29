"use client";

import { Fragment, useCallback, useEffect, useRef } from "react";
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
  useLocalTableSort,
} from "../report-sort-utils";
import type { ReportColumn } from "./daily-sales-report-types";
import {
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
  textValue,
  toppingLines,
} from "./daily-sales-report-utils";

type DailySalesBillSortKey =
  | "cashierName"
  | "amount"
  | "discount"
  | "invoiceNumber"
  | "itemCount"
  | "lineTotal"
  | "paymentType"
  | "salePrice"
  | "saleDate"
  | "status"
  | "tableName"
  | "toppingTotal"
  | "vat";

type SummaryColumnKey =
  | "date"
  | "invoice"
  | "tableName"
  | "paymentMethod"
  | "amount"
  | "toppingTotal"
  | "discountBill"
  | "itemDiscount"
  | "serviceCharge"
  | "vat"
  | "total"
  | "receiveCash"
  | "receiveTransfer"
  | "debt"
  | "changeAmount"
  | "status";

type SummaryColumn = {
  align?: "left" | "right";
  key: SummaryColumnKey;
  label: string;
  sortableKey: string;
};

function summaryColumns(t: (key: string) => string): SummaryColumn[] {
  return [
    { key: "date", label: t("report.columns.saleDate"), sortableKey: "date" },
    {
      key: "invoice",
      label: t("report.columns.invoiceNumber"),
      sortableKey: "invoice",
    },
    {
      key: "tableName",
      label: t("report.columns.tableName"),
      sortableKey: "table_name",
    },
    {
      key: "paymentMethod",
      label: t("report.columns.paymentType"),
      sortableKey: "payment_method",
    },
    {
      key: "amount",
      label: t("report.columns.amount"),
      sortableKey: "amount",
      align: "right",
    },
    {
      key: "toppingTotal",
      label: t("report.columns.toppingTotal"),
      sortableKey: "topping_total",
      align: "right",
    },
    {
      key: "discountBill",
      label: t("report.columns.discount"),
      sortableKey: "discount_bill",
      align: "right",
    },
    {
      key: "itemDiscount",
      label: t("report.columns.itemDiscount"),
      sortableKey: "item_discount",
      align: "right",
    },
    {
      key: "serviceCharge",
      label: t("report.columns.serviceCharge"),
      sortableKey: "service_charge",
      align: "right",
    },
    {
      key: "vat",
      label: t("report.columns.vat"),
      sortableKey: "vat",
      align: "right",
    },
    {
      key: "total",
      label: t("report.cards.netTotal"),
      sortableKey: "total",
      align: "right",
    },
    {
      key: "receiveCash",
      label: t("report.columns.cashReceived"),
      sortableKey: "receive_cash",
      align: "right",
    },
    {
      key: "receiveTransfer",
      label: t("report.columns.transferReceived"),
      sortableKey: "receive_transfer",
      align: "right",
    },
    {
      key: "debt",
      label: t("report.columns.debtAmount"),
      sortableKey: "debt_amount",
      align: "right",
    },
    {
      key: "changeAmount",
      label: t("report.columns.changeAmount"),
      sortableKey: "change_amount",
      align: "right",
    },
    { key: "status", label: t("report.columns.status"), sortableKey: "status" },
  ];
}

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
  const activeColumns = typePage === "summary" ? summaryColumns(t) : null;

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
      <Table className="w-max min-w-full table-auto text-[13px]">
        <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-30 [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-border [&_th]:bg-background [&_th]:px-3 [&_th]:shadow-sm">
          <TableRow>
            <TableHead className="w-12 text-center">
              <IndeterminateCheckbox
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
                      "h-11",
                      column.align === "right" && "text-right",
                    )}
                    onSort={toggleSort}
                  >
                    {column.label}
                  </SortableReportTableHead>
                ))
              : columns.map((column) =>
                  column.kind === "image" ? (
                    <TableHead key={column.header} className="h-11">
                      {column.header}
                    </TableHead>
                  ) : (
                    <SortableReportTableHead
                      key={column.header}
                      align={column.align}
                      sort={sort}
                      sortKey={column.header}
                      className={cn(
                        "h-11",
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
                <TableCell className="w-12 text-center">
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

                <TableCell className="w-px text-center text-sm font-black text-muted-foreground">
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
    "h-12 whitespace-nowrap px-3 text-[13px]",
    column.align === "right" && "text-right tabular-nums",
    column.key === "invoice" && "font-black",
    column.key === "total" && "font-black",
    column.key === "debt" &&
      firstNumber(value) > 0 &&
      "font-black text-destructive",
    firstNumber(value) === 0 &&
      [
        "amount",
        "toppingTotal",
        "discountBill",
        "itemDiscount",
        "serviceCharge",
        "vat",
        "receiveCash",
        "receiveTransfer",
        "debt",
        "changeAmount",
      ].includes(column.key) &&
      "text-muted-foreground",
  );
}

function renderSummaryCell(row: ApiEntity, column: SummaryColumn) {
  switch (column.key) {
    case "date":
      return formatDate(readValue(row, ["date", "sale_date", "order_date"]));
    case "invoice":
      return textValue(
        readValue(row, [
          "invoice",
          "invoice_number",
          "invoice_no",
          "order_invoice",
        ]),
      );
    case "tableName":
      return textValue(readValue(row, ["table_name", "tableName"]), "-");
    case "paymentMethod":
      return textValue(readValue(row, ["payment_method", "payment_type"]), "-");
    case "amount":
      return money(firstNumber(readValue(row, ["amount"])));
    case "toppingTotal":
      return money(firstNumber(readValue(row, ["topping_total"])));
    case "discountBill":
      return money(firstNumber(readValue(row, ["discount_bill"])));
    case "itemDiscount":
      return money(firstNumber(readValue(row, ["item_discount"])));
    case "serviceCharge":
      return money(firstNumber(readValue(row, ["service_charge"])));
    case "vat":
      return money(firstNumber(readValue(row, ["vat"])));
    case "total":
      return money(firstNumber(readValue(row, ["total"])));
    case "receiveCash":
      return money(firstNumber(readValue(row, ["receive_cash"])));
    case "receiveTransfer":
      return money(firstNumber(readValue(row, ["receive_transfer"])));
    case "debt": {
      const debt = firstNumber(readValue(row, ["debt_amount"]));
      return debt > 0 ? money(debt) : null;
    }
    case "changeAmount":
      return money(firstNumber(readValue(row, ["change_amount"])));
    case "status": {
      const label = textValue(
        readValue(row, ["status", "status_name", "status_text"]),
      );
      return <Badge className={statusClass(row, label)}>{label}</Badge>;
    }
  }
}

export function DetailBillTable({
  collapsedGroups,
  groups,
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
      <Table className="w-max min-w-full table-auto text-[13px]">
        <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-30 [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-border [&_th]:bg-background [&_th]:px-3 [&_th]:shadow-sm">
          <TableRow>
            <TableHead className="w-12 text-center">
              <IndeterminateCheckbox
                aria-label={t("common.selectAll")}
                checked={allVisibleSelected}
                indeterminate={!allVisibleSelected && someVisibleSelected}
                onChange={(event) =>
                  onToggleRows(visibleItems, event.target.checked)
                }
              />
            </TableHead>

            <TableHead className="w-20 text-center">{t("fields.no")}</TableHead>

            <SortableReportTableHead
              sort={groupSort}
              sortKey="invoiceNumber"
              onSort={toggleGroupSort}
            >
              {t("report.columns.invoiceNumber")}
            </SortableReportTableHead>

            <SortableReportTableHead
              sort={groupSort}
              sortKey="saleDate"
              onSort={toggleGroupSort}
            >
              {t("report.columns.saleDate")}
            </SortableReportTableHead>

            <SortableReportTableHead
              sort={groupSort}
              sortKey="tableName"
              onSort={toggleGroupSort}
            >
              {t("report.columns.tableName")}
            </SortableReportTableHead>

            <SortableReportTableHead
              sort={groupSort}
              sortKey="paymentType"
              onSort={toggleGroupSort}
            >
              {t("report.columns.paymentType")}
            </SortableReportTableHead>

            <SortableReportTableHead
              sort={groupSort}
              sortKey="cashierName"
              onSort={toggleGroupSort}
            >
              {t("report.columns.cashierName")}
            </SortableReportTableHead>

            <SortableReportTableHead
              align="right"
              sort={groupSort}
              sortKey="salePrice"
              className="text-right"
              onSort={toggleGroupSort}
            >
              {t("report.columns.salePrice")}
            </SortableReportTableHead>

            <SortableReportTableHead
              align="right"
              sort={groupSort}
              sortKey="itemCount"
              className="text-right"
              onSort={toggleGroupSort}
            >
              {t("report.columns.quantity")}
            </SortableReportTableHead>

            <SortableReportTableHead
              align="right"
              sort={groupSort}
              sortKey="amount"
              className="text-right"
              onSort={toggleGroupSort}
            >
              {t("report.columns.amount")}
            </SortableReportTableHead>

            <SortableReportTableHead
              align="right"
              sort={groupSort}
              sortKey="toppingTotal"
              className="text-right"
              onSort={toggleGroupSort}
            >
              {t("report.columns.toppingTotal")}
            </SortableReportTableHead>

            <SortableReportTableHead
              align="right"
              sort={groupSort}
              sortKey="discount"
              className="text-right"
              onSort={toggleGroupSort}
            >
              {t("report.columns.discount")}
            </SortableReportTableHead>

            <SortableReportTableHead
              align="right"
              sort={groupSort}
              sortKey="vat"
              className="text-right"
              onSort={toggleGroupSort}
            >
              {t("report.columns.vat")}
            </SortableReportTableHead>

            <SortableReportTableHead
              align="right"
              sort={groupSort}
              sortKey="lineTotal"
              className="text-right"
              onSort={toggleGroupSort}
            >
              {t("report.cards.netTotal")}
            </SortableReportTableHead>

            {hasStatusData ? (
              <SortableReportTableHead
                sort={groupSort}
                sortKey="status"
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
                    "border-b border-border/80 bg-card hover:bg-muted/25 [&>td]:whitespace-nowrap [&>td]:px-3 [&>td]:py-3",
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
                      <span className="text-sm font-black text-muted-foreground">
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

                  <TableCell>
                    <span className="block max-w-56 truncate">
                      {group.cashierName}
                    </span>
                  </TableCell>

                  <BlankCell />

                  <TableCell className="text-right tabular-nums">
                    <Badge className="h-7 px-2 text-xs">
                      {group.itemCount.toLocaleString("en-US")}
                    </Badge>
                  </TableCell>

                  <OptionalMoneyCell value={groupMoney(group, ["amount"])} />
                  <OptionalMoneyCell
                    value={groupMoney(group, ["topping_total", "toppingTotal"])}
                  />
                  <OptionalMoneyCell
                    value={groupMoney(group, ["discount_bill", "discountBill"])}
                  />
                  <OptionalMoneyCell value={groupMoney(group, ["vat"])} />
                  <MoneyCell value={group.lineTotal} strong />

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

                {expanded
                  ? group.items.map((item, itemIndex) => {
                      const recordId = reportRecordId(item);
                      const selected = selectedRecordIds.has(recordId);

                      return (
                        <TableRow
                          key={`${rowKey(item, itemIndex)}-${itemIndex}`}
                          className={cn(
                            "border-b border-border/80 bg-background hover:bg-muted/20 [&>td]:whitespace-nowrap [&>td]:px-3 [&>td]:py-3",
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
                                name: itemProductName(item, `${group.invoiceNumber}-${itemIndex + 1}`),
                              })}
                              checked={selected}
                              onChange={(event) =>
                                onToggleRow(item, event.target.checked)
                              }
                            />
                          </TableCell>

                          <TableCell />

                          <TableCell>
                            <div className="flex min-w-80 items-center gap-3">
                              <ProductImage row={item} />
                              <ProductNameCell row={item} />
                            </div>
                          </TableCell>

                          <BlankCell />
                          <BlankCell />
                          {/* <BlankCell /> */}
                          <BlankCell />
                          <BlankCell />

                          <OptionalMoneyCell value={itemMoney(item, ["sale_price"])} />

                          <TableCell className="text-right font-black tabular-nums">
                            {itemQuantity(item).toLocaleString("en-US")}
                          </TableCell>

                          <OptionalMoneyCell value={itemMoney(item, ["amount"])} />
                          <OptionalMoneyCell value={itemMoney(item, ["topping_total"])} />
                          <OptionalMoneyCell value={itemMoney(item, ["discount"])} />
                          <BlankCell />
                          <OptionalMoneyCell value={itemMoney(item, ["total"])} strong />

                          {hasStatusData ? <TableCell /> : null}
                        </TableRow>
                      );
                    })
                  : null}
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
    readValue(row, ["product_name", "prod_name", "prod_name_la", "prod_name_eng"]),
    fallback,
  );
}

function itemQuantity(row: ApiEntity) {
  return firstNumber(readValue(row, ["quantity", "qty", "order_qty", "qty_total"]));
}

function itemMoney(row: ApiEntity, keys: string[]) {
  const value = readValue(row, keys);
  return hasDisplayValue(value) ? firstNumber(value) : null;
}

function groupMoney(group: DailySalesBillGroup, keys: string[]) {
  const groupEntity = group as unknown as ApiEntity;
  const value = readValue(groupEntity, keys);
  if (hasDisplayValue(value)) return firstNumber(value);

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
    case "cashierName":
      return group.cashierName;
    case "amount":
      return groupMoney(group, ["amount"]) ?? 0;
    case "discount":
      return groupMoney(group, ["discount_bill", "discountBill"]) ?? 0;
    case "invoiceNumber":
      return group.invoiceNumber;
    case "itemCount":
      return group.itemCount;
    case "lineTotal":
      return group.lineTotal;
    case "paymentType":
      return group.paymentType;
    case "salePrice":
      return 0;
    case "saleDate":
      return group.saleDate;
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
    "h-12 whitespace-nowrap px-3 text-[13px]",
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
        "whitespace-nowrap px-3 text-right tabular-nums",
        strong && "font-black",
        value === 0 && "text-muted-foreground",
      )}
    >
      {money(value)}
    </TableCell>
  );
}

function OptionalMoneyCell({
  strong = false,
  value,
}: {
  strong?: boolean;
  value: number | null;
}) {
  if (value === null) return <BlankCell align="right" />;
  return <MoneyCell value={value} strong={strong} />;
}

function BlankCell({ align = "left" }: { align?: "left" | "right" }) {
  return (
    <TableCell
      className={cn(
        "whitespace-nowrap px-3 text-muted-foreground",
        align === "right" && "text-right",
      )}
    />
  );
}

function IndeterminateCheckbox({
  indeterminate = false,
  ...props
}: CheckboxProps & { indeterminate?: boolean }) {
  const checkboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <Checkbox
      ref={checkboxRef}
      aria-checked={indeterminate ? "mixed" : props.checked ? "true" : "false"}
      {...props}
    />
  );
}

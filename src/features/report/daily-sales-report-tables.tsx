"use client";

import { Fragment, useEffect, useRef } from "react";
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
import type { ReportColumn } from "./daily-sales-report-types";
import {
  firstNumber,
  formatDate,
  isCancelledRow,
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
  const visibleIds = rows.map(reportRecordId);
  const allVisibleSelected =
    visibleIds.length > 0 &&
    visibleIds.every((id) => selectedRecordIds.has(id));
  const someVisibleSelected = visibleIds.some((id) =>
    selectedRecordIds.has(id),
  );

  return (
    <div className="overflow-x-auto">
      <Table
        className={cn(
          "text-[13px]",
          typePage === "summary" ? "min-w-[1500px]" : "min-w-[1880px]",
        )}
      >
        <TableHeader className="sticky top-0 z-10 bg-background/95 shadow-sm backdrop-blur">
          <TableRow>
            <TableHead className="w-[52px] whitespace-nowrap bg-background/95 text-center">
              <IndeterminateCheckbox
                aria-label={t("common.selectAll")}
                checked={allVisibleSelected}
                indeterminate={!allVisibleSelected && someVisibleSelected}
                onChange={(event) => onToggleRows(rows, event.target.checked)}
              />
            </TableHead>
            <TableHead className="w-px whitespace-nowrap text-center">
              {t("fields.no")}
            </TableHead>
            {columns.map((column) => (
              <TableHead
                key={column.header}
                className={cn(
                  "h-11 whitespace-nowrap bg-background/95",
                  column.align === "right" && "text-right",
                  column.minWidth,
                  column.wide && "min-w-[180px]",
                )}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const recordId = reportRecordId(row);
            const selected = selectedRecordIds.has(recordId);

            return (
              <TableRow
                key={`${rowKey(row, index)}-${index}`}
                className={cn(
                  tableRowClass(row, index),
                  selected && !isCancelledRow(row) && "bg-primary/5",
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
  const parentColumnCount = 20;
  const visibleItems = groups.flatMap((group) => group.items);
  const visibleItemIds = visibleItems.map(reportRecordId);
  const allVisibleSelected =
    visibleItemIds.length > 0 &&
    visibleItemIds.every((id) => selectedRecordIds.has(id));
  const someVisibleSelected = visibleItemIds.some((id) =>
    selectedRecordIds.has(id),
  );

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[2580px] text-[13px]">
        <TableHeader className="sticky top-0 z-10 bg-background/95 shadow-sm backdrop-blur">
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
            <TableHead className="min-w-[132px] whitespace-nowrap bg-background/95">
              {t("report.columns.invoiceNumber")}
            </TableHead>
            <TableHead className="min-w-[118px] whitespace-nowrap bg-background/95">
              {t("report.columns.saleDate")}
            </TableHead>
            <TableHead className="min-w-[84px] whitespace-nowrap bg-background/95">
              {t("report.columns.tableName")}
            </TableHead>
            <TableHead className="min-w-[130px] whitespace-nowrap bg-background/95">
              {t("report.columns.paymentType")}
            </TableHead>
            <TableHead className="min-w-[94px] whitespace-nowrap bg-background/95 text-right">
              {t("report.billItems")}
            </TableHead>
            <TableHead className="min-w-[126px] whitespace-nowrap bg-background/95 text-right">
              {t("report.cards.orderTotal")}
            </TableHead>
            <TableHead className="min-w-[126px] whitespace-nowrap bg-background/95 text-right">
              {t("report.cards.toppingTotal")}
            </TableHead>
            <TableHead className="min-w-[128px] whitespace-nowrap bg-background/95 text-right">
              {t("report.cards.discountAmount")}
            </TableHead>
            <TableHead className="min-w-[128px] whitespace-nowrap bg-background/95 text-right">
              {t("report.cards.itemDiscountAmount")}
            </TableHead>
            <TableHead className="min-w-[130px] whitespace-nowrap bg-background/95 text-right">
              {t("report.cards.serviceCharge")}
            </TableHead>
            <TableHead className="min-w-[112px] whitespace-nowrap bg-background/95 text-right">
              {t("report.cards.vatAmount")}
            </TableHead>
            <TableHead className="min-w-[132px] whitespace-nowrap bg-background/95 text-right">
              {t("report.cards.netTotal")}
            </TableHead>
            <TableHead className="min-w-[132px] whitespace-nowrap bg-background/95 text-right">
              {t("report.cards.receiveCash")}
            </TableHead>
            <TableHead className="min-w-[132px] whitespace-nowrap bg-background/95 text-right">
              {t("report.cards.receiveTransfer")}
            </TableHead>
            <TableHead className="min-w-[124px] whitespace-nowrap bg-background/95 text-right">
              {t("report.cards.debtAmount")}
            </TableHead>
            <TableHead className="min-w-[124px] whitespace-nowrap bg-background/95 text-right">
              {t("report.cards.changeAmount")}
            </TableHead>
            <TableHead className="min-w-[160px] whitespace-nowrap bg-background/95">
              {t("report.columns.cashierName")}
            </TableHead>
            <TableHead className="min-w-[118px] whitespace-nowrap bg-background/95">
              {t("report.columns.status")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group, index) => {
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

            return (
              <Fragment key={group.id}>
                <TableRow
                  className={cn(
                    "border-b border-border/80 bg-card hover:bg-muted/25 [&>td]:py-3",
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
                  <TableCell className="whitespace-nowrap text-right tabular-nums">
                    <Badge className="h-7 px-2 text-xs">
                      {group.itemCount.toLocaleString("en-US")}
                    </Badge>
                  </TableCell>
                  <MoneyCell value={group.amountTotal} />
                  <MoneyCell value={group.toppingTotal} />
                  <MoneyCell value={group.discountBillAmount} />
                  <MoneyCell value={group.itemDiscountAmount} />
                  <MoneyCell value={group.serviceChargeAmount} />
                  <MoneyCell value={group.vatAmount} />
                  <MoneyCell value={group.lineTotal} strong />
                  <MoneyCell value={group.receiveCashAmount} />
                  <MoneyCell value={group.receiveTransferAmount} />
                  <MoneyCell value={group.debtAmount} />
                  <MoneyCell value={group.changeAmount} />
                  <TableCell className="max-w-[220px] whitespace-normal leading-snug">
                    {group.cashierName}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge
                      className={
                        group.cancelled
                          ? "border-destructive/25 bg-destructive/10 text-destructive"
                          : statusClass(statusRow, group.status)
                      }
                    >
                      {group.status}
                    </Badge>
                  </TableCell>
                </TableRow>
                {expanded ? (
                  <TableRow className="border-b border-border/80 bg-muted/20 hover:bg-muted/20">
                    <TableCell colSpan={parentColumnCount} className="p-0">
                      <div className="border-l-4 border-l-primary/20 px-4 py-3">
                        <Table className="min-w-[1040px] text-[13px]">
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
                              {itemColumns.map((column) => (
                                <TableHead
                                  key={column.header}
                                  className={cn(
                                    "h-9 whitespace-nowrap bg-muted/60",
                                    column.align === "right" && "text-right",
                                    column.minWidth,
                                    column.wide && "min-w-[180px]",
                                  )}
                                >
                                  {column.header}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.items.map((item, itemIndex) => {
                              const recordId = reportRecordId(item);
                              const selected = selectedRecordIds.has(recordId);

                              return (
                                <TableRow
                                  key={`${rowKey(item, itemIndex)}-${itemIndex}`}
                                  className={cn(
                                    tableRowClass(item, itemIndex),
                                    selected &&
                                      !isCancelledRow(item) &&
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
                                        onToggleRow(item, event.target.checked)
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
    const color = reportImageColor(row);
    if (color)
      return (
        <span
          className="report-print-image"
          style={{ backgroundColor: color }}
        />
      );
    const src = reportImageSrc(row);
    const name = textValue(
      readValue(row, [
        "product_name",
        "prod_name",
        "prod_name_la",
        "prod_name_eng",
      ]),
      "Product",
    );
    if (src)
      return (
        <Image
          src={src}
          alt={name}
          width={24}
          height={24}
          unoptimized
          className="report-print-image"
        />
      );
    return "-";
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

function tableRowClass(row: ApiEntity, index: number) {
  return cn(
    "group border-b border-border/80",
    index % 2 === 1 && "bg-muted/15",
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

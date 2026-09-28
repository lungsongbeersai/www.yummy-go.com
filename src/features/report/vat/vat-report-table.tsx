"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ReportColumnOption } from "@/features/report/shared/report-column-visibility";
import { ReportIndeterminateCheckbox, selectionStateForVisibleIds } from "@/features/report/shared/report-row-selection";
import type { VatReportRow, VatReportSummary } from "@/services/report";
import { formatReportDate } from "@/features/report/shared/report-date-format";

type VatMoneyKey = "discount_amount" | "net_sale" | "service_charge" | "vat" | "grand_total";
type VatColumnId = "saleDate" | "customer" | VatMoneyKey | "vatRate";

type VatMoneyColumn = { id: VatMoneyKey; label: string; tone: "default" | "discount" | "vat" };

function vatMoneyColumns(t: (key: string) => string): VatMoneyColumn[] {
  return [
    { id: "discount_amount", label: t("report.vat.columns.discount"), tone: "discount" },
    { id: "net_sale", label: t("report.vat.columns.netSale"), tone: "default" },
    { id: "service_charge", label: t("report.vat.columns.serviceCharge"), tone: "default" },
    { id: "vat", label: t("report.vat.columns.vat"), tone: "vat" },
    { id: "grand_total", label: t("report.vat.columns.grandTotal"), tone: "default" },
  ];
}

/** ตัวเลือกของเมนู "คอลัมน์" — เลขบิลกับยอด VAT เป็นแกนของรายงานนี้ ซ่อนไม่ได้ */
export function vatColumnOptions(t: (key: string) => string): ReportColumnOption[] {
  const options: Array<{ id: VatColumnId; label: string }> = [
    { id: "saleDate", label: t("report.vat.columns.saleDate") },
    { id: "customer", label: t("report.vat.columns.customer") },
    ...vatMoneyColumns(t).slice(0, 3),
    { id: "vatRate", label: t("report.vat.columns.vatRate") },
    ...vatMoneyColumns(t).slice(3),
  ];
  return options.map((option) => ({ ...option, hideable: option.id !== "vat" }));
}

// สีตัวเลข: ส่วนลดที่มากกว่า 0 = แดง, ยอด VAT (หัวใจของรายงาน) = สีธีม, ค่า 0 = จาง
function moneyClass(value: number, tone: VatMoneyColumn["tone"]) {
  return cn(
    "text-right tabular-nums",
    value === 0 && "text-muted-foreground",
    tone === "discount" && value > 0 && "text-destructive",
    tone === "vat" && value !== 0 && "font-medium text-primary-text",
  );
}

function footerCellClass(align: "left" | "right" = "left") {
  return cn(
    // แถวรวมค้างขอบล่าง — ทึบ (bg-background) แล้ววางสีธีมจางเป็นชั้น gradient ทับ
    "sticky bottom-0 z-20 border-t border-primary/30 bg-background bg-linear-to-r from-primary/10 to-primary/10 font-medium text-primary-text",
    align === "right" && "text-right tabular-nums",
  );
}

export function VatReportTable({
  isColumnVisible,
  rows,
  selectedRowIds,
  summary,
  onToggleRow,
  onToggleRows,
}: {
  isColumnVisible: (id: string) => boolean;
  rows: VatReportRow[];
  selectedRowIds: Set<string>;
  summary: VatReportSummary | null;
  onToggleRow: (row: VatReportRow, selected: boolean) => void;
  onToggleRows: (rows: VatReportRow[], selected: boolean) => void;
}) {
  const { t } = useTranslation();
  const moneyColumns = useMemo(() => vatMoneyColumns(t).filter((column) => isColumnVisible(column.id)), [isColumnVisible, t]);
  const beforeRate = moneyColumns.filter((column) => column.id !== "vat" && column.id !== "grand_total");
  const afterRate = moneyColumns.filter((column) => column.id === "vat" || column.id === "grand_total");
  const showDate = isColumnVisible("saleDate");
  const showCustomer = isColumnVisible("customer");
  const showRate = isColumnVisible("vatRate");
  const leadingSpan = 2 + (showDate ? 1 : 0) + (showCustomer ? 1 : 0);
  const { allVisibleSelected, someVisibleSelected } = selectionStateForVisibleIds(
    rows.map((row) => row.order_uuid),
    selectedRowIds,
  );

  return (
    // container ของ Table เป็นตัวสกรอลเอง — หัวตาราง sticky ด้านบน, แถวรวม sticky ด้านล่าง
    <Table containerClassName="min-h-0 flex-1 overflow-auto">
      <TableHeader className="sticky top-0 z-30 bg-muted">
        <TableRow>
          <TableHead>
            <ReportIndeterminateCheckbox
              aria-label={t("common.selectAll")}
              checked={allVisibleSelected}
              indeterminate={!allVisibleSelected && someVisibleSelected}
              onCheckedChange={(checked) => onToggleRows(rows, checked as boolean)}
            />
          </TableHead>
          {showDate ? <TableHead>{t("report.vat.columns.saleDate")}</TableHead> : null}
          <TableHead>{t("report.vat.columns.invoice")}</TableHead>
          {showCustomer ? <TableHead>{t("report.vat.columns.customer")}</TableHead> : null}
          {beforeRate.map((column) => (
            <TableHead key={column.id} className="text-right">
              {column.label}
            </TableHead>
          ))}
          {showRate ? <TableHead className="text-right">{t("report.vat.columns.vatRate")}</TableHead> : null}
          {afterRate.map((column) => (
            <TableHead key={column.id} className="text-right">
              {column.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const selected = selectedRowIds.has(row.order_uuid);

          return (
            <TableRow key={row.order_uuid} data-state={selected ? "selected" : undefined}>
              <TableCell>
                <Checkbox
                  aria-label={t("common.selectRow", { name: row.order_invoice })}
                  checked={selected}
                  onCheckedChange={(checked) => onToggleRow(row, checked as boolean)}
                />
              </TableCell>
              {showDate ? <TableCell className="tabular-nums">{formatReportDate(row.sale_date)}</TableCell> : null}
              <TableCell className="font-medium">{row.order_invoice}</TableCell>
              {showCustomer ? (
                <TableCell className={cn("max-w-48 truncate", !row.customer_name && "text-muted-foreground")}>
                  {row.customer_name || "-"}
                </TableCell>
              ) : null}
              {beforeRate.map((column) => (
                <TableCell key={column.id} className={moneyClass(row[column.id], column.tone)}>
                  {money(row[column.id])}
                </TableCell>
              ))}
              {showRate ? (
                <TableCell className="text-right">
                  <Badge variant="secondary">{row.vat_rate}%</Badge>
                </TableCell>
              ) : null}
              {afterRate.map((column) => (
                <TableCell key={column.id} className={moneyClass(row[column.id], column.tone)}>
                  {money(row[column.id])}
                </TableCell>
              ))}
            </TableRow>
          );
        })}

        {summary ? (
          <TableRow className="hover:bg-transparent">
            <TableCell className={footerCellClass()} colSpan={leadingSpan}>
              {t("report.summary")}
              <span className="ml-2 font-normal text-muted-foreground">
                {t("report.vat.columns.billCount")}: {summary.bill_count.toLocaleString("en-US")}
              </span>
            </TableCell>
            {beforeRate.map((column) => (
              <TableCell
                key={column.id}
                className={cn(
                  footerCellClass("right"),
                  "text-foreground",
                  column.tone === "discount" && summary[column.id] > 0 && "text-destructive",
                )}
              >
                {money(summary[column.id])}
              </TableCell>
            ))}
            {showRate ? <TableCell className={footerCellClass()} /> : null}
            {afterRate.map((column) => (
              <TableCell
                key={column.id}
                className={cn(footerCellClass("right"), column.tone === "vat" ? "font-semibold" : "text-foreground")}
              >
                {money(summary[column.id])}
              </TableCell>
            ))}
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}

// จอเล็ก: บิลละ 1 Item — ยอด VAT ด้านขวา (ตัวเลขหลักของรายงาน), ยอดขาย/ยอดรวมด้านล่าง
export function VatReportRowCard({
  rows,
  selectedRowIds,
  onToggleRow,
}: {
  rows: VatReportRow[];
  selectedRowIds: Set<string>;
  onToggleRow: (row: VatReportRow, selected: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <ItemGroup>
      {rows.map((row) => (
        <Item key={row.order_uuid} variant="outline">
          <Checkbox
            aria-label={t("common.selectRow", { name: row.order_invoice })}
            checked={selectedRowIds.has(row.order_uuid)}
            onCheckedChange={(checked) => onToggleRow(row, checked as boolean)}
          />
          <ItemContent>
            <ItemTitle>{row.order_invoice}</ItemTitle>
            <ItemDescription>
              {formatReportDate(row.sale_date)} · {row.customer_name || "-"}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Badge variant="secondary">{row.vat_rate}%</Badge>
            <span className="font-medium tabular-nums text-primary-text">{money(row.vat)}</span>
          </ItemActions>
          <ItemFooter>
            <span className="text-muted-foreground">
              {t("report.vat.columns.netSale")} {money(row.net_sale)}
              {row.discount_amount > 0 ? (
                <span className="text-destructive">
                  {" · "}
                  {t("report.vat.columns.discount")} {money(row.discount_amount)}
                </span>
              ) : null}
            </span>
            <span className="font-medium tabular-nums">{money(row.grand_total)}</span>
          </ItemFooter>
        </Item>
      ))}
    </ItemGroup>
  );
}

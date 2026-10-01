"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ReportColumnOption } from "@/features/report/shared/report-column-visibility";
import { ReportIndeterminateCheckbox, selectionStateForVisibleIds } from "@/features/report/shared/report-row-selection";
import { ReportColumnHead, ReportColumnPinningProvider, ReportRowPinToggle, ReportRowPinningProvider } from "@/features/report/shared/report-column-head";
import { STICKY_TABLE_CLASS, useStickyTable, type ReportColumnPinning } from "@/features/report/shared/report-sticky-table";
import { userInitials } from "@/features/settings/user/user-utils";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CustomerSalesReportSummary, CustomerSalesRow } from "@/services/report";

type CustomerMetricKey = "bill_count" | "net_sale" | "service_charge" | "vat" | "grand_total";

type CustomerMetric = { key: CustomerMetricKey; kind: "money" | "number"; label: string };

function customerMetrics(t: (key: string) => string): CustomerMetric[] {
  return [
    { key: "bill_count", kind: "number", label: t("report.customerSales.columns.billCount") },
    { key: "net_sale", kind: "money", label: t("report.customerSales.columns.netSale") },
    { key: "service_charge", kind: "money", label: t("report.customerSales.columns.serviceCharge") },
    { key: "vat", kind: "money", label: t("report.customerSales.columns.vat") },
    { key: "grand_total", kind: "money", label: t("report.customerSales.columns.grandTotal") },
  ];
}

/** ตัวเลือกของเมนู "คอลัมน์" — ชื่อลูกค้ากับยอดรวมเป็นแกนของรายงาน ซ่อนไม่ได้ */
export function customerSalesColumnOptions(t: (key: string) => string): ReportColumnOption[] {
  return [
    { hideable: false, id: "customer", label: t("report.customerSales.customer") },
    ...customerMetrics(t).map((metric) => ({
      hideable: metric.key !== "grand_total",
      id: metric.key,
      label: metric.label,
    })),
  ];
}

function displayMetric(value: number, kind: CustomerMetric["kind"]) {
  return kind === "money" ? money(value) : value.toLocaleString("en-US");
}

// สัดส่วนยอดซื้อของลูกค้าต่อยอดรวมทั้งหมด — เห็นทันทีว่าลูกค้าคนไหนซื้อมากที่สุด
function customerShare(row: CustomerSalesRow, total: number) {
  if (total <= 0) return null;
  return Math.min(100, Math.max(0, (row.summary.grand_total / total) * 100));
}

function customerName(row: CustomerSalesRow) {
  return row.customer_name || row.member_code || "-";
}

function CustomerAvatar({ row }: { row: CustomerSalesRow }) {
  return (
    <Avatar>
      <AvatarFallback>{userInitials(customerName(row))}</AvatarFallback>
    </Avatar>
  );
}

function footerCellClass(align: "left" | "right" = "left") {
  return cn(
    // แถวรวมค้างขอบล่าง — ทึบ (bg-background) แล้ววางสีธีมจางเป็นชั้น gradient ทับ
    "sticky bottom-0 z-20 border-t border-primary/30 bg-background bg-linear-to-r from-primary/10 to-primary/10 font-medium text-primary-text",
    align === "right" && "text-right tabular-nums",
  );
}

function activate(event: React.KeyboardEvent, action: () => void) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  action();
}

export function CustomerSalesTable({
  isColumnVisible,
  pinning,
  rows,
  selectedRowIds,
  summary,
  onSelect,
  onToggleRow,
  onToggleRows,
}: {
  isColumnVisible: (id: string) => boolean;
  pinning: ReportColumnPinning;
  rows: CustomerSalesRow[];
  selectedRowIds: Set<string>;
  summary: CustomerSalesReportSummary | null;
  onSelect: (customerUuid: string) => void;
  onToggleRow: (row: CustomerSalesRow, selected: boolean) => void;
  onToggleRows: (rows: CustomerSalesRow[], selected: boolean) => void;
}) {
  const { t } = useTranslation();
  const metrics = useMemo(() => customerMetrics(t).filter((metric) => isColumnVisible(metric.key)), [isColumnVisible, t]);
  const { allVisibleSelected, someVisibleSelected } = selectionStateForVisibleIds(
    rows.map((row) => row.customer_uuid),
    selectedRowIds,
  );
  const total = summary?.grand_total ?? 0;
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
              onCheckedChange={(checked) => onToggleRows(rows, checked as boolean)}
            />
          </TableHead>
          <ReportColumnHead className="min-w-64" columnId="customer">{t("report.customerSales.customer")}</ReportColumnHead>
          {metrics.map((metric) => (
            <ReportColumnHead key={metric.key} className="text-right" columnId={metric.key} align="right">
              {metric.label}
            </ReportColumnHead>
          ))}
        </TableRow>
      </TableHeader>
      </ReportColumnPinningProvider>
      <ReportRowPinningProvider>
      <TableBody>
        {rows.map((row) => {
          const selected = selectedRowIds.has(row.customer_uuid);
          const share = customerShare(row, total);

          return (
            <TableRow
              key={row.customer_uuid}
              role="button"
              tabIndex={0}
              data-state={selected ? "selected" : undefined}
              className="cursor-pointer"
              onClick={() => onSelect(row.customer_uuid)}
              onKeyDown={(event) => activate(event, () => onSelect(row.customer_uuid))}
            >
              <TableCell onClick={(event) => event.stopPropagation()}>
                <div className="flex items-center gap-1">
                  <Checkbox
                    aria-label={t("common.selectRow", { name: customerName(row) })}
                    checked={selected}
                    onCheckedChange={(checked) => onToggleRow(row, checked as boolean)}
                  />
                  <ReportRowPinToggle isDefault={row === rows[0]} label={customerName(row)} rowId={row.customer_uuid} />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <CustomerAvatar row={row} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="font-medium" translate="no">{row.customer_name || "-"}</span>
                    <span className="text-muted-foreground">
                      {row.member_code} · {row.customer_phone}
                    </span>
                    {share !== null ? (
                      <span className="flex max-w-56 items-center gap-2">
                        <Progress value={share} aria-hidden="true" />
                        <span className="shrink-0 tabular-nums text-muted-foreground">{share.toFixed(1)}%</span>
                      </span>
                    ) : null}
                  </div>
                </div>
              </TableCell>
              {metrics.map((metric) => {
                const value = row.summary[metric.key];
                return (
                  <TableCell
                    key={metric.key}
                    className={cn(
                      "text-right tabular-nums",
                      value === 0 && "text-muted-foreground",
                      metric.key === "grand_total" && value !== 0 && "font-medium text-primary-text",
                    )}
                  >
                    {displayMetric(value, metric.kind)}
                  </TableCell>
                );
              })}
            </TableRow>
          );
        })}

        {summary ? (
          <TableRow className="hover:bg-transparent">
            <TableCell className={footerCellClass()} colSpan={2}>
              {t("report.summary")}
              <span className="ml-2 font-normal text-muted-foreground">
                {t("report.customerSales.columns.customerCount")}: {summary.customer_count.toLocaleString("en-US")}
              </span>
            </TableCell>
            {metrics.map((metric) => (
              <TableCell
                key={metric.key}
                className={cn(footerCellClass("right"), metric.key === "grand_total" ? "font-semibold" : "text-foreground")}
              >
                {displayMetric(summary[metric.key], metric.kind)}
              </TableCell>
            ))}
          </TableRow>
        ) : null}
      </TableBody>
      </ReportRowPinningProvider>
    </Table>
  );
}

// จอเล็ก: ลูกค้าละ 1 Item — ยอดรวมด้านขวา, บิล/ยอดขายด้านล่าง, แถบสัดส่วนของยอดรวมทั้งหมด
// แตะที่รายการเปิดรายละเอียด (ช่องติ๊กเลือกไว้สำหรับ export ไม่เปิดรายละเอียด)
export function CustomerSalesRowCard({
  rows,
  selectedRowIds,
  total,
  onSelect,
  onToggleRow,
}: {
  rows: CustomerSalesRow[];
  selectedRowIds: Set<string>;
  total: number;
  onSelect: (customerUuid: string) => void;
  onToggleRow: (row: CustomerSalesRow, selected: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <ItemGroup>
      {rows.map((row) => {
        const share = customerShare(row, total);

        return (
          <Item
            key={row.customer_uuid}
            variant="outline"
            role="button"
            tabIndex={0}
            className="cursor-pointer"
            onClick={() => onSelect(row.customer_uuid)}
            onKeyDown={(event) => activate(event, () => onSelect(row.customer_uuid))}
          >
            <div onClick={(event) => event.stopPropagation()}>
              <Checkbox
                aria-label={t("common.selectRow", { name: customerName(row) })}
                checked={selectedRowIds.has(row.customer_uuid)}
                onCheckedChange={(checked) => onToggleRow(row, checked as boolean)}
              />
            </div>
            <CustomerAvatar row={row} />
            <ItemContent>
              <ItemTitle translate="no">{row.customer_name || "-"}</ItemTitle>
              <ItemDescription>
                {row.member_code} · {row.customer_phone}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <span className="font-medium tabular-nums text-primary-text">{money(row.summary.grand_total)}</span>
            </ItemActions>
            <ItemFooter>
              <span className="text-muted-foreground">
                {t("report.customerSales.columns.billCount")} {row.summary.bill_count} ·{" "}
                {t("report.customerSales.columns.netSale")} {money(row.summary.net_sale)}
              </span>
            </ItemFooter>
            {share !== null ? (
              <ItemFooter>
                <Progress value={share} aria-hidden="true" />
                <span className="shrink-0 tabular-nums text-muted-foreground">{share.toFixed(1)}%</span>
              </ItemFooter>
            ) : null}
          </Item>
        );
      })}
    </ItemGroup>
  );
}

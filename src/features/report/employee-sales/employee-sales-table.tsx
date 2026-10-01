"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { userInitials } from "@/features/settings/user/user-utils";
import type { ReportColumnOption } from "@/features/report/shared/report-column-visibility";
import { ReportIndeterminateCheckbox, selectionStateForVisibleIds } from "@/features/report/shared/report-row-selection";
import { ReportColumnHead, ReportColumnPinningProvider, ReportRowPinToggle, ReportRowPinningProvider } from "@/features/report/shared/report-column-head";
import { STICKY_TABLE_CLASS, useStickyTable, type ReportColumnPinning } from "@/features/report/shared/report-sticky-table";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { EmployeeSalesReportSummary, EmployeeSalesRow, EmployeeSalesSummary } from "@/services/report";

type EmployeeMetricKey = "bill_count" | "total_qty" | "net_sale" | "service_charge" | "vat" | "grand_total";

type EmployeeMetric = {
  key: EmployeeMetricKey;
  kind: "money" | "number";
  label: string;
};

function employeeMetrics(t: (key: string) => string): EmployeeMetric[] {
  return [
    { key: "bill_count", kind: "number", label: t("employeeSales.billCount") },
    { key: "total_qty", kind: "number", label: t("employeeSales.totalQty") },
    { key: "net_sale", kind: "money", label: t("employeeSales.netSale") },
    { key: "service_charge", kind: "money", label: t("employeeSales.serviceCharge") },
    { key: "vat", kind: "money", label: t("employeeSales.vat") },
    { key: "grand_total", kind: "money", label: t("employeeSales.grandTotal") },
  ];
}

/** ตัวเลือกของเมนู "คอลัมน์" — ชื่อพนักงานกับยอดรวมทั้งหมดเป็นแกนของรายงาน ซ่อนไม่ได้ */
export function employeeSalesColumnOptions(t: (key: string) => string): ReportColumnOption[] {
  return [
    { hideable: false, id: "employee", label: t("employeeSales.employee") },
    ...employeeMetrics(t).map((metric) => ({
      hideable: metric.key !== "grand_total",
      id: metric.key,
      label: metric.label,
    })),
  ];
}

function displayMetric(value: number, kind: EmployeeMetric["kind"]) {
  return kind === "money" ? money(value) : value.toLocaleString("en-US");
}

// สัดส่วนยอดขายของพนักงานต่อยอดรวมทั้งสาขา — เห็นทันทีว่าใครทำยอดได้มากที่สุด
export function employeeShare(row: EmployeeSalesRow, total: number) {
  if (total <= 0) return null;
  return Math.min(100, Math.max(0, (row.summary.grand_total / total) * 100));
}

export function EmployeeIdentity({ row }: { row: EmployeeSalesRow }) {
  return (
    <Avatar>
      {row.login_profile ? <AvatarImage alt={row.login_email} src={row.login_profile} /> : null}
      <AvatarFallback>{userInitials(row.login_email)}</AvatarFallback>
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

export function EmployeeSalesTable({
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
  rows: EmployeeSalesRow[];
  selectedRowIds: Set<string>;
  summary: EmployeeSalesReportSummary | null;
  onSelect: (loginUuid: string) => void;
  onToggleRow: (row: EmployeeSalesRow, selected: boolean) => void;
  onToggleRows: (rows: EmployeeSalesRow[], selected: boolean) => void;
}) {
  const { t } = useTranslation();
  const metrics = useMemo(() => employeeMetrics(t).filter((metric) => isColumnVisible(metric.key)), [isColumnVisible, t]);
  const { allVisibleSelected, someVisibleSelected } = selectionStateForVisibleIds(
    rows.map((row) => row.login_uuid),
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
          <ReportColumnHead className="min-w-64" columnId="employee">{t("employeeSales.employee")}</ReportColumnHead>
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
          const selected = selectedRowIds.has(row.login_uuid);
          const share = employeeShare(row, total);

          return (
            <TableRow
              key={row.login_uuid}
              role="button"
              tabIndex={0}
              data-state={selected ? "selected" : undefined}
              className="cursor-pointer"
              onClick={() => onSelect(row.login_uuid)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                onSelect(row.login_uuid);
              }}
            >
              <TableCell onClick={(event) => event.stopPropagation()}>
                <div className="flex items-center gap-1">
                  <Checkbox
                    aria-label={t("common.selectRow", { name: row.login_email })}
                    checked={selected}
                    onCheckedChange={(checked) => onToggleRow(row, checked as boolean)}
                  />
                  <ReportRowPinToggle isDefault={row === rows[0]} label={row.login_email} rowId={row.login_uuid} />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <EmployeeIdentity row={row} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium" translate="no">{row.login_email}</span>
                      {row.cancel_summary.cancel_bill_count > 0 ? (
                        <Badge className="bg-destructive/10 text-destructive">
                          {t("employeeSales.cancelledBadge", { count: row.cancel_summary.cancel_bill_count })}
                        </Badge>
                      ) : null}
                    </div>
                    <span className="text-muted-foreground">{row.roles_name}</span>
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
                const value = row.summary[metric.key as keyof EmployeeSalesSummary];
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
                {t("employeeSales.summaryLine", { employeeCount: summary.employee_count, billCount: summary.bill_count })}
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

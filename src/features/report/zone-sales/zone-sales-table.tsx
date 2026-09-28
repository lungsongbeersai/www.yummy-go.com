"use client";

import { useMemo } from "react";
import { MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ReportColumnOption } from "@/features/report/shared/report-column-visibility";
import { ReportIndeterminateCheckbox, selectionStateForVisibleIds } from "@/features/report/shared/report-row-selection";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ZoneSalesRow, ZoneSalesSummary } from "@/services/report";
import { zoneOptionLabel } from "./zone-sales-utils";

type ZoneMetricKey = "bill_count" | "customer_count" | "discount_amount" | "net_sale" | "service_charge" | "vat" | "grand_total";

type ZoneMetric = { key: ZoneMetricKey; kind: "money" | "number"; label: string; tone: "default" | "discount" | "total" };

function zoneMetrics(t: (key: string) => string): ZoneMetric[] {
  return [
    { key: "bill_count", kind: "number", label: t("report.zoneSales.columns.billCount"), tone: "default" },
    { key: "customer_count", kind: "number", label: t("report.zoneSales.columns.customerCount"), tone: "default" },
    { key: "discount_amount", kind: "money", label: t("report.zoneSales.columns.discount"), tone: "discount" },
    { key: "net_sale", kind: "money", label: t("report.zoneSales.columns.netSale"), tone: "default" },
    { key: "service_charge", kind: "money", label: t("report.zoneSales.columns.serviceCharge"), tone: "default" },
    { key: "vat", kind: "money", label: t("report.zoneSales.columns.vat"), tone: "default" },
    { key: "grand_total", kind: "money", label: t("report.zoneSales.columns.grandTotal"), tone: "total" },
  ];
}

/** ตัวเลือกของเมนู "คอลัมน์" — ชื่อโซนกับยอดรวมเป็นแกนของรายงาน ซ่อนไม่ได้ */
export function zoneSalesColumnOptions(t: (key: string) => string): ReportColumnOption[] {
  return zoneMetrics(t).map((metric) => ({
    hideable: metric.key !== "grand_total",
    id: metric.key,
    label: metric.label,
  }));
}

function displayMetric(value: number, kind: ZoneMetric["kind"]) {
  return kind === "money" ? money(value) : value.toLocaleString("en-US");
}

// สีตัวเลข: ส่วนลดที่มากกว่า 0 = แดง, ยอดรวม = สีธีม, ค่า 0 = จาง
function metricClass(value: number, tone: ZoneMetric["tone"]) {
  return cn(
    "text-right tabular-nums",
    value === 0 && "text-muted-foreground",
    tone === "discount" && value > 0 && "text-destructive",
    tone === "total" && value !== 0 && "font-medium text-primary-text",
  );
}

// สัดส่วนยอดขายของโซนต่อยอดรวมทั้งสาขา — เห็นทันทีว่าโซนไหนทำเงินมากที่สุด
function zoneShare(row: ZoneSalesRow, total: number) {
  if (total <= 0) return null;
  return Math.min(100, Math.max(0, (row.grand_total / total) * 100));
}

function ZoneShare({ share }: { share: number | null }) {
  if (share === null) return null;
  return (
    <span className="flex w-full max-w-56 items-center gap-2">
      <Progress value={share} aria-hidden="true" />
      <span className="shrink-0 tabular-nums text-muted-foreground">{share.toFixed(1)}%</span>
    </span>
  );
}

export function ZoneSalesTable({
  isColumnVisible,
  language,
  rows,
  selectedRowIds,
  summary,
  onToggleRow,
  onToggleRows,
}: {
  isColumnVisible: (id: string) => boolean;
  language: string;
  rows: ZoneSalesRow[];
  selectedRowIds: Set<string>;
  summary: ZoneSalesSummary;
  onToggleRow: (row: ZoneSalesRow, selected: boolean) => void;
  onToggleRows: (rows: ZoneSalesRow[], selected: boolean) => void;
}) {
  const { t } = useTranslation();
  const metrics = useMemo(() => zoneMetrics(t).filter((metric) => isColumnVisible(metric.key)), [isColumnVisible, t]);
  const { allVisibleSelected, someVisibleSelected } = selectionStateForVisibleIds(
    rows.map((row) => row.zone_uuid),
    selectedRowIds,
  );

  return (
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
          <TableHead className="min-w-56">{t("report.zoneSales.zone")}</TableHead>
          {metrics.map((metric) => (
            <TableHead key={metric.key} className="text-right">
              {metric.label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const selected = selectedRowIds.has(row.zone_uuid);

          return (
            <TableRow key={row.zone_uuid} data-state={selected ? "selected" : undefined}>
              <TableCell>
                <Checkbox
                  aria-label={t("common.selectRow", { name: zoneOptionLabel(row, language) })}
                  checked={selected}
                  onCheckedChange={(checked) => onToggleRow(row, checked as boolean)}
                />
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1.5">
                  {/* บิลที่ไม่ได้ผูกโซน — ตัวอักษรจางให้แยกออกจากโซนจริง */}
                  <span className={cn("font-medium", row.is_unassigned && "font-normal text-muted-foreground")}>
                    {zoneOptionLabel(row, language)}
                  </span>
                  <ZoneShare share={zoneShare(row, summary.grand_total)} />
                </div>
              </TableCell>
              {metrics.map((metric) => (
                <TableCell key={metric.key} className={metricClass(row[metric.key], metric.tone)}>
                  {displayMetric(row[metric.key], metric.kind)}
                </TableCell>
              ))}
            </TableRow>
          );
        })}

        {/* แถวรวม — ตารางนี้สั้น (ไม่กี่โซน) ไม่ต้องค้างขอบล่าง จึงใช้พื้นสีธีมจางธรรมดา */}
        <TableRow className="bg-primary/5 font-medium text-primary-text hover:bg-primary/5">
          <TableCell colSpan={2}>
            {t("common.total")}
            <span className="ml-2 font-normal text-muted-foreground">
              {t("report.zoneSales.columns.zoneCount")}: {summary.zone_count.toLocaleString("en-US")}
            </span>
          </TableCell>
          {metrics.map((metric) => (
            <TableCell
              key={metric.key}
              className={cn(
                "text-right tabular-nums",
                metric.tone === "total" ? "font-semibold" : "text-foreground",
                metric.tone === "discount" && summary[metric.key] > 0 && "text-destructive",
              )}
            >
              {displayMetric(summary[metric.key], metric.kind)}
            </TableCell>
          ))}
        </TableRow>
      </TableBody>
    </Table>
  );
}

// จอเล็ก: โซนละ 1 Item — ยอดรวมด้านขวา, บิล/ลูกค้า/ยอดขายด้านล่าง, แถบสัดส่วนของยอดรวมทั้งสาขา
export function ZoneSalesRowCard({
  language,
  rows,
  selectedRowIds,
  total,
  onToggleRow,
}: {
  language: string;
  rows: ZoneSalesRow[];
  selectedRowIds: Set<string>;
  total: number;
  onToggleRow: (row: ZoneSalesRow, selected: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <ItemGroup>
      {rows.map((row) => (
        <Item key={row.zone_uuid} variant="outline">
          <Checkbox
            aria-label={t("common.selectRow", { name: zoneOptionLabel(row, language) })}
            checked={selectedRowIds.has(row.zone_uuid)}
            onCheckedChange={(checked) => onToggleRow(row, checked as boolean)}
          />
          <ItemMedia variant="icon">
            <MapPin />
          </ItemMedia>
          <ItemContent>
            <ItemTitle className={cn(row.is_unassigned && "font-normal text-muted-foreground")}>
              {zoneOptionLabel(row, language)}
            </ItemTitle>
            <ItemDescription>
              {t("report.zoneSales.columns.billCount")} {row.bill_count} · {t("report.zoneSales.columns.customerCount")}{" "}
              {row.customer_count}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <span className="font-medium tabular-nums text-primary-text">{money(row.grand_total)}</span>
          </ItemActions>
          <ItemFooter>
            <ZoneShare share={zoneShare(row, total)} />
          </ItemFooter>
        </Item>
      ))}
    </ItemGroup>
  );
}

"use client";

import type { ReactNode, RefObject } from "react";
import {
  ArrowLeftRight,
  BadgePercent,
  Banknote,
  Calculator,
  CreditCard,
  HandCoins,
  HandPlatter,
  Landmark,
  Package,
  ReceiptText,
  Scale,
  Tag,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ReportOfficialHeader,
  ReportSignatures,
} from "@/lib/export/official-layout";
import { ReportFilterCard, ReportFilterSheet } from "../shared/report-filter-shell";
import { ReportLocationFields } from "../shared/report-location-fields";
import type { ReportLocationOptions } from "../shared/report-location";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type {
  PaymentMethodOption,
  PaymentMethodReportRow,
  PaymentMethodSummaryCard,
} from "@/stores/report-store";
import {
  ReportBranchField,
  ReportDateRangeFields,
  ReportPageLimitField,
  ReportPaymentMethodField,
} from "../shared/report-filter-fields";
import type { ReportColumnOption } from "../shared/report-column-visibility";
import { ReportStatCards, type ReportStat, type ReportStatTone } from "../shared/report-stat-cards";
import { metricNumber } from "../shared/report-metrics";
import {
  ReportIndeterminateCheckbox,
  selectionStateForVisibleIds,
} from "../shared/report-row-selection";
import type { PaymentMethodsReportFilters } from "./payment-methods-report-types";
import {
  displayMetric,
  paymentMethodExportMetricConfigs,
  paymentMethodExportTotals,
  paymentMethodReportRowId,
  paymentMethodRowMetricConfigs,
  paymentMethodTotalMetricConfigs,
} from "./payment-methods-report-utils";

type FilterProps = {
  branchLoading: boolean;
  branchLocked: boolean;
  branchOptions: Array<{ label: string; value: string }>;
  canApply: boolean;
  draftFilters: PaymentMethodsReportFilters;
  loading: boolean;
  locationOptions: ReportLocationOptions & { loading: boolean };
  methodOptions: PaymentMethodOption[];
  onApply: () => void;
  onDraftChange: (filters: PaymentMethodsReportFilters) => void;
};

// ชนิดของตัวเลขต่อการ์ด (ความหมายของสีดูใน report-stat-cards.tsx) — ยอดสุทธิเป็นใบ highlight กว้าง 2 ช่อง
const SUMMARY_PRESENTATION: Record<string, { icon: LucideIcon; tone: ReportStatTone }> = {
  bill_count: { icon: ReceiptText, tone: "info" },
  item_count: { icon: Package, tone: "info" },
  total_qty: { icon: Package, tone: "info" },
  product_price_total: { icon: Wallet, tone: "success" },
  topping_total: { icon: Wallet, tone: "success" },
  total: { icon: Wallet, tone: "success" },
  bill_total: { icon: Wallet, tone: "success" },
  discount_item_amount: { icon: BadgePercent, tone: "danger" },
  discount_bill: { icon: Tag, tone: "danger" },
  after_discount_item: { icon: Calculator, tone: "primary" },
  after_discount_bill: { icon: Calculator, tone: "primary" },
  sum_servicecharge: { icon: HandPlatter, tone: "primary" },
  sum_vate: { icon: Landmark, tone: "warning" },
  payment_total: { icon: Banknote, tone: "success" },
  difference: { icon: Scale, tone: "warning" },
  grand_total: { icon: TrendingUp, tone: "highlight" },
};

export function PaymentMethodsSummaryCards({
  cards,
  id,
  reportTotal,
}: {
  cards: PaymentMethodSummaryCard[];
  id?: string;
  reportTotal: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const source = cards.length
    ? cards.map((card) => ({ key: card.key, kind: card.valueType, label: card.label, value: card.value }))
    : paymentMethodTotalMetricConfigs(t)
        .filter((metric) => isPresent(reportTotal[metric.key]))
        .map((metric) => ({
          key: metric.key,
          kind: metric.kind,
          label: metric.label,
          value: Number(reportTotal[metric.key] ?? 0),
        }));
  const stats: ReportStat[] = source.map((card) => {
    const presentation = SUMMARY_PRESENTATION[card.key] ?? { icon: ReceiptText, tone: "primary" };
    const value = metricNumber(card.value);

    return {
      ...presentation,
      key: card.key,
      label: card.label,
      negative: presentation.tone === "danger" && value > 0,
      span: presentation.tone === "highlight",
      value: displayMetric(card.value, card.kind),
    };
  });

  return (
    <ReportStatCards
      id={id}
      stats={[...stats.filter((stat) => stat.tone === "highlight"), ...stats.filter((stat) => stat.tone !== "highlight")]}
    />
  );
}

export function PaymentMethodsFilterSheet({
  branchLoading,
  branchLocked,
  branchOptions,
  canApply,
  draftFilters,
  loading,
  locationOptions,
  methodOptions,
  open,
  onApply,
  onDraftChange,
  onOpenChange,
}: FilterProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <ReportFilterSheet
      canApply={canApply}
      description={t("report.paymentMethodsReport.title")}
      gridClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-12"
      loading={loading}
      open={open}
      onApply={onApply}
      onOpenChange={onOpenChange}
    >
      <PaymentMethodsFilterFields
        branchLoading={branchLoading}
        branchLocked={branchLocked}
        branchOptions={branchOptions}
        draftFilters={draftFilters}
        idPrefix="payment-methods-mobile"
        methodOptions={methodOptions}
        locationOptions={locationOptions}
        onDraftChange={onDraftChange}
      />
    </ReportFilterSheet>
  );
}

// จอ lg ขึ้นไปกรองได้จากหน้าเลย โครงเดียวกับ /settings/store และหน้ารายงานขายประจำวัน
export function PaymentMethodsFilterBar({
  actions,
  branchLoading,
  branchLocked,
  branchOptions,
  canApply,
  draftFilters,
  loading,
  locationOptions,
  methodOptions,
  onApply,
  onDraftChange,
}: FilterProps & { actions?: ReactNode }) {
  return (
    <ReportFilterCard
      actions={actions}
      canApply={canApply}
      actionsClassName="lg:col-span-4 xl:col-span-1"
      // shrink-0: Card มี overflow-hidden (min-height ของ flex item = 0) — กันถูกบีบตอนโหลด ดู report-layout.tsx
      className="hidden shrink-0 shadow-none lg:block"
      contentClassName="grid items-end gap-3 py-4 lg:grid-cols-12 xl:grid-cols-[repeat(7,minmax(0,1fr))_auto]"
      loading={loading}
      onApply={onApply}
    >
      <PaymentMethodsFilterFields
        branchLoading={branchLoading}
        branchLocked={branchLocked}
        branchOptions={branchOptions}
        draftFilters={draftFilters}
        idPrefix="payment-methods"
        methodOptions={methodOptions}
        locationOptions={locationOptions}
        onDraftChange={onDraftChange}
      />
    </ReportFilterCard>
  );
}

export function PaymentMethodsFilterFields({
  branchLoading,
  branchLocked,
  branchOptions,
  draftFilters,
  idPrefix,
  locationOptions,
  methodOptions,
  onDraftChange,
}: {
  branchLoading: boolean;
  branchLocked: boolean;
  branchOptions: Array<{ label: string; value: string }>;
  draftFilters: PaymentMethodsReportFilters;
  idPrefix: string;
  methodOptions: PaymentMethodOption[];
  locationOptions: ReportLocationOptions & { loading: boolean };
  onDraftChange: (filters: PaymentMethodsReportFilters) => void;
}) {
  function patch(patch: Partial<PaymentMethodsReportFilters>) {
    onDraftChange({ ...draftFilters, ...patch });
  }

  return (
    <>
      <ReportBranchField
        branchLoading={branchLoading}
        branchLocked={branchLocked}
        fieldClassName="lg:col-span-4 xl:col-span-1"
        id={`${idPrefix}-branch`}
        options={branchOptions}
        value={draftFilters.branchUuid}
        onValueChange={(value) => patch({ branchUuid: value, tableUuid: "all", zoneUuid: "all" })}
      />
      <ReportLocationFields
        branchUuid={draftFilters.branchUuid}
        fieldClassName="lg:col-span-4 xl:col-span-1"
        idPrefix={idPrefix}
        loading={locationOptions.loading}
        tableOptions={locationOptions.tableOptions}
        tableUuid={draftFilters.tableUuid}
        zoneOptions={locationOptions.zoneOptions}
        zoneUuid={draftFilters.zoneUuid}
        onTableChange={(tableUuid) => patch({ tableUuid })}
        onZoneChange={(zoneUuid) => patch({ tableUuid: "all", zoneUuid })}
      />
      <ReportDateRangeFields
        dateFrom={draftFilters.dateFrom}
        dateTo={draftFilters.dateTo}
        fieldClassName="lg:col-span-4 xl:col-span-1"
        idPrefix={idPrefix}
        withNativeName
        onDateFromChange={(value) => patch({ dateFrom: value })}
        onDateToChange={(value) => patch({ dateTo: value })}
      />
      <ReportPaymentMethodField
        fieldClassName="lg:col-span-4 xl:col-span-1"
        id={`${idPrefix}-payment-method`}
        options={methodOptions}
        value={draftFilters.paymentMethod}
        onValueChange={(value) => patch({ paymentMethod: value })}
      />
      <ReportPageLimitField
        fieldClassName="lg:col-span-4 xl:col-span-1"
        id={`${idPrefix}-limit`}
        value={draftFilters.limit}
        onValueChange={(value) => patch({ limit: value })}
      />
    </>
  );
}

// เอกลักษณ์ประจำวิธีชำระ: ไอคอนคนละตัว + สีคนละโทน — แยกออกจากกันได้แม้มองผ่าน ๆ
// และไม่ได้ใช้สีเป็นตัวบอกอย่างเดียว (Design.md §10) เพราะไอคอนกับชื่อกำกับอยู่เสมอ
//
// จับคู่จาก code ก่อนแล้วค่อยดูชื่อ เพราะ backend อาจส่ง payment_method_code เป็นตัวเลข
// จับไม่ได้ = คืนโทนกลาง ดีกว่าเดาผิดแล้วติดสีให้วิธีชำระผิดตัว
//
// ใช้ semantic token success / info / pending (เงินสด=รับแล้ว, โอน=ข้อมูล, เชื่อ/ໜີ້=ค้างจ่าย)
// แทนสีดิบ — โทนเดียวกับป้าย order-audit/employee-sales ในรายงานอื่น (Design.md §8)
const PAYMENT_METHOD_IDENTITIES = [
  {
    match: /cash|ສົດ|สด/,
    Icon: Banknote,
    chipClass: "bg-success/10 text-success",
    progressClass: "*:data-[slot=progress-indicator]:bg-success",
  },
  {
    match: /transfer|bank|ໂອນ|โอน/,
    Icon: ArrowLeftRight,
    chipClass: "bg-info/10 text-info-text",
    progressClass: "*:data-[slot=progress-indicator]:bg-info",
  },
  {
    match: /debt|credit|ໜີ້|ຕິດ|เชื่อ/,
    Icon: HandCoins,
    chipClass: "bg-pending/10 text-pending",
    progressClass: "*:data-[slot=progress-indicator]:bg-pending",
  },
] as const;

const DEFAULT_PAYMENT_METHOD_IDENTITY = {
  Icon: CreditCard,
  chipClass: "bg-primary/10 text-primary-text",
  progressClass: "",
};

function paymentMethodIdentity(row: PaymentMethodReportRow) {
  const key = `${row.paymentMethodCode} ${row.paymentMethodName}`.toLowerCase();
  return PAYMENT_METHOD_IDENTITIES.find((identity) => identity.match.test(key)) ?? DEFAULT_PAYMENT_METHOD_IDENTITY;
}

function MethodIcon({ row, size = "sm" }: { row: PaymentMethodReportRow; size?: "sm" | "lg" }) {
  const { Icon, chipClass } = paymentMethodIdentity(row);

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md",
        size === "lg" ? "size-9 rounded-lg" : "size-5",
        chipClass,
      )}
    >
      <Icon aria-hidden="true" className={size === "lg" ? "size-4.5" : "size-3"} />
    </span>
  );
}

/** ตัวเลือกของเมนู "ตัวชี้วัด" — ตารางนี้กลับแกน แถว = ตัวชี้วัด จึงซ่อน "แถว" แทนคอลัมน์ ยอดสุทธิซ่อนไม่ได้ */
export function paymentMethodMetricOptions(t: (key: string) => string): ReportColumnOption[] {
  return paymentMethodRowMetricConfigs(t).map((metric) => ({
    hideable: metric.key !== "grand_total",
    id: metric.key,
    label: metric.label,
  }));
}

// การ์ดต่อวิธีชำระ: ยอดรับกับสัดส่วนของยอดรวม — อ่านคำตอบหลักของรายงานได้ทันทีโดยไม่ต้องไล่ตาราง
// ติ๊กเลือกอยู่บนการ์ด (เลือกวิธีชำระก่อน export) ใช้ได้ทุกขนาดจอ
export function PaymentMethodShareCards({
  reportTotal,
  rows,
  selectedRowIds,
  onToggleRow,
}: {
  reportTotal: Record<string, unknown>;
  rows: PaymentMethodReportRow[];
  selectedRowIds: Set<string>;
  onToggleRow: (row: PaymentMethodReportRow, selected: boolean) => void;
}) {
  const { t } = useTranslation();
  const total = paymentTotalAmount(reportTotal);

  return (
    <section className="grid shrink-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => {
        const id = paymentMethodReportRowId(row);
        const share = paymentShare(row.paymentAmount, total);

        return (
          <Card key={id} size="sm">
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <Checkbox
                  aria-label={t("common.selectRow", { name: row.paymentMethodName })}
                  checked={selectedRowIds.has(id)}
                  onCheckedChange={(checked) => onToggleRow(row, checked as boolean)}
                />
                {row.paymentMethodName}
              </CardDescription>
              <CardTitle className="text-lg tabular-nums">{displayMetric(row.paymentAmount, "money")}</CardTitle>
              <CardAction>
                <MethodIcon row={row} size="lg" />
              </CardAction>
            </CardHeader>
            <CardContent className="flex items-center gap-2">
              <Progress value={share} aria-hidden="true" className={paymentMethodIdentity(row).progressClass} />
              <span className="shrink-0 tabular-nums text-muted-foreground">{share.toFixed(1)}%</span>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}

// รายงานนี้มีวิธีชำระแค่ 3 แบบ แต่มีตัวชี้วัด 12 ตัว — ตารางแบบ "แถว = วิธีชำระ" จึงกลับด้านกับ
// รูปร่างข้อมูล: ได้ 3 แถวลอยอยู่บนหน้าเต็มจอ และต้องเลื่อนแนวนอน 12 คอลัมน์เพื่ออ่านวิธีเดียว
// สลับแกนเป็น "แถว = ตัวชี้วัด, คอลัมน์ = วิธีชำระ" แทน — เทียบ 3 วิธีได้ในบรรทัดเดียวซึ่งเป็น
// คำถามจริงของรายงานนี้ ใช้ตารางเดียวกันทุกขนาดจอ (5 คอลัมน์ เลื่อนแนวนอนได้บนมือถือ)
export function PaymentMethodsTable({
  isMetricVisible,
  reportTotal,
  rows,
  selectedRowIds,
  onToggleRows,
}: {
  isMetricVisible: (id: string) => boolean;
  reportTotal: Record<string, unknown>;
  rows: PaymentMethodReportRow[];
  selectedRowIds: Set<string>;
  onToggleRows: (rows: PaymentMethodReportRow[], selected: boolean) => void;
}) {
  const { t } = useTranslation();
  const metrics = paymentMethodRowMetricConfigs(t).filter((metric) => isMetricVisible(metric.key));
  const visibleIds = rows.map(paymentMethodReportRowId);
  const { allVisibleSelected, someVisibleSelected } = selectionStateForVisibleIds(visibleIds, selectedRowIds);

  return (
    <Table containerClassName="min-h-0 flex-1 overflow-auto">
      <TableHeader className="sticky top-0 z-20 bg-muted">
        <TableRow>
          <TableHead>
            <span className="flex items-center gap-2">
              <ReportIndeterminateCheckbox
                aria-label={t("common.selectAll")}
                checked={allVisibleSelected}
                indeterminate={!allVisibleSelected && someVisibleSelected}
                onCheckedChange={(checked) => onToggleRows(rows, checked as boolean)}
              />
              {t("report.paymentMethodsReport.columns.paymentMethod")}
            </span>
          </TableHead>
          {rows.map((row) => (
            <TableHead key={paymentMethodReportRowId(row)} className="text-right">
              <span className="inline-flex items-center gap-2">
                <MethodIcon row={row} />
                {row.paymentMethodName}
              </span>
            </TableHead>
          ))}
          <TableHead className="text-right">{t("report.paymentMethodsReport.totalSummary")}</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {metrics.map((metric) => {
          // ยอดรวมมาจาก summary ที่ backend คำนวณมาให้ ไม่บวกแถวเองที่ frontend
          // (หลังบ้านกรอง exclude_order_is_cancelled / exclude_order_item_status ซึ่งหน้าบ้านไม่รู้)
          const columnTotal = reportTotal[metric.summaryKey];
          const grand = metric.key === "grand_total";

          return (
            <TableRow key={metric.key} className={cn(grand && "bg-primary/5 font-medium text-primary-text hover:bg-primary/5")}>
              <TableCell className={grand ? undefined : "text-muted-foreground"}>{metric.label}</TableCell>
              {rows.map((row) => (
                <TableCell
                  key={paymentMethodReportRowId(row)}
                  className={cn("text-right tabular-nums", !grand && financialTextClass(metric.key, row[metric.field]))}
                >
                  {displayMetric(row[metric.field], metric.kind)}
                </TableCell>
              ))}
              {/* กติกาสีเดียวกับคอลัมน์ของแต่ละวิธีชำระ — ส่วนลดแดงทั้งแถว ไม่ใช่เฉพาะฝั่งซ้าย */}
              <TableCell
                className={cn(
                  "text-right font-medium tabular-nums",
                  grand ? "font-semibold" : financialTextClass(metric.key, columnTotal),
                )}
              >
                {displayMetric(columnTotal, metric.kind)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function isPresent(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

// ฐานคำนวณสัดส่วน % ของแต่ละวิธีชำระ อ่านจาก summary ของ backend เท่านั้น
// เดิมมี fallback บวก paymentAmount ของทุกแถวเอง ซึ่งได้ตัวเลขคนละชุดกับรายงานจริง
// เพราะหลังบ้านกรอง exclude_order_is_cancelled / exclude_order_item_status ไว้ก่อนแล้ว
function paymentTotalAmount(reportTotal: Record<string, unknown>) {
  const paymentTotal = metricNumber(reportTotal.payment_total);
  if (paymentTotal > 0) return paymentTotal;

  return metricNumber(reportTotal.grand_total);
}

function paymentShare(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (value / total) * 100));
}

// สีตัวเลข: ส่วนลดที่มากกว่า 0 = แดง, ยอดรวม = ตัวหนาขึ้น, ค่า 0 = จาง
// เช็ค startsWith("discount") ไม่ใช่ includes — after_discount_* คือ "ยอดคงเหลือหลังหักส่วนลด" ไม่ใช่ยอดที่ถูกหัก
function financialTextClass(key: string, value: unknown) {
  const number = metricNumber(value);
  const isDiscount = key.startsWith("discount");
  const isTotal = key === "total" || key.includes("total") || key.includes("amount");

  return cn(
    isTotal && "font-medium",
    number === 0 && "text-muted-foreground",
    isDiscount && number > 0 && "text-destructive",
  );
}

export function PaymentMethodsExportSurface({
  containerRef,
  dateRange,
  methodLabel,
  reportTotal,
  rows,
  title,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  dateRange: string;
  methodLabel: string;
  reportTotal: Record<string, unknown>;
  rows: PaymentMethodReportRow[];
  title: string;
}) {
  const { t } = useTranslation();
  const rowMetrics = paymentMethodExportMetricConfigs(t);
  const totals = paymentMethodExportTotals(reportTotal, rowMetrics);

  return (
    <div ref={containerRef} className="report-print-surface">
      <ReportOfficialHeader />
      <div className="report-print-header">
        <div>
          <p className="report-print-kicker">{methodLabel}</p>
          <h1>{title}</h1>
        </div>
        <div className="report-print-meta">
          <span>{dateRange}</span>
        </div>
      </div>
      <table className="report-print-table">
        <thead>
          <tr>
            <th>{t("report.paymentMethodsReport.columns.paymentMethod")}</th>
            {rowMetrics.map((metric) => (
              <th key={metric.key} className="is-right">
                {metric.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.paymentMethodCode}-${row.sortOrder}`}>
              <td>{row.paymentMethodName}</td>
              {rowMetrics.map((metric) => (
                <td key={metric.key} className="is-right">
                  {displayMetric(row[metric.field], metric.kind)}
                </td>
              ))}
            </tr>
          ))}
          {/* แถวรวมท้ายตารางแบบเดียวกับ footer ของตารางบนหน้าจอ แทน section สรุปแยก */}
          <tr className="is-bill">
            <td>{t("report.paymentMethodsReport.totalSummary")}</td>
            {rowMetrics.map((metric, index) => (
              <td key={metric.key} className="is-right">
                {displayMetric(totals[index], metric.kind)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <ReportSignatures />
    </div>
  );
}

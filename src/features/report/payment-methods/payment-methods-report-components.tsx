"use client";

import type { ReactNode, RefObject } from "react";
import { ArrowLeftRight, Banknote, CreditCard, HandCoins } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ReportOfficialHeader,
  ReportSignatures,
} from "@/lib/export/official-layout";
import { ReportFilterCard, ReportFilterSheet } from "../shared/report-filter-shell";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
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
import { ReportSummaryCardsGrid, type ReportSummaryCard } from "../shared/report-metric-display";
import { metricNumber } from "../shared/report-metrics";
import {
  ReportIndeterminateCheckbox,
  selectionStateForVisibleIds,
} from "../shared/report-row-selection";
import type {
  PaymentMethodsReportFilters,
  PaymentMethodsRowMetricConfig,
} from "./payment-methods-report-types";
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
  methodOptions: PaymentMethodOption[];
  onApply: () => void;
  onDraftChange: (filters: PaymentMethodsReportFilters) => void;
};

export function PaymentMethodsSummaryCards({
  cards,
  reportTotal,
}: {
  cards: PaymentMethodSummaryCard[];
  reportTotal: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const visibleCards: ReportSummaryCard[] = cards.length
    ? cards.map((card) => ({ key: card.key, kind: card.valueType, label: card.label, value: card.value }))
    : paymentMethodTotalMetricConfigs(t)
        .filter((metric) => isPresent(reportTotal[metric.key]))
        .map((metric) => ({
          key: metric.key,
          kind: metric.kind,
          label: metric.label,
          value: Number(reportTotal[metric.key] ?? 0),
        }));

  return (
    <ReportSummaryCardsGrid
      cards={visibleCards}
      gridClassName="sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5"
      cardClassName={(card) =>
        cn(
          "border-border bg-card",
          (card.key === "grand_total" || card.key === "payment_total") &&
            "border-primary/40 border-l-4 border-l-primary",
          card.key.includes("discount") &&
            metricNumber(card.value) > 0 &&
            "border-destructive/40 border-l-4 border-l-destructive"
        )
      }
      labelClassName={() => "text-muted-foreground"}
      valueClassName={(card) => financialTextClass(card.key, card.value, true)}
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
  methodOptions,
  onApply,
  onDraftChange,
}: FilterProps & { actions?: ReactNode }) {
  return (
    <ReportFilterCard
      actions={actions}
      canApply={canApply}
      actionsClassName="lg:col-span-4 xl:col-span-1"
      className="hidden shrink-0 rounded-none border-x-0 border-t-0 shadow-none lg:block"
      contentClassName="grid min-w-0 items-end gap-3 px-3 py-3 sm:grid-cols-2 lg:grid-cols-12 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]"
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
  methodOptions,
  onDraftChange,
}: {
  branchLoading: boolean;
  branchLocked: boolean;
  branchOptions: Array<{ label: string; value: string }>;
  draftFilters: PaymentMethodsReportFilters;
  idPrefix: string;
  methodOptions: PaymentMethodOption[];
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
        fieldClassName="min-w-0 gap-1.5 sm:col-span-2 lg:col-span-4 xl:col-span-1"
        id={`${idPrefix}-branch`}
        options={branchOptions}
        value={draftFilters.branchUuid}
        onValueChange={(value) => patch({ branchUuid: value })}
      />
      <ReportDateRangeFields
        dateFrom={draftFilters.dateFrom}
        dateTo={draftFilters.dateTo}
        fieldClassName="min-w-0 gap-1.5 lg:col-span-4 xl:col-span-1"
        idPrefix={idPrefix}
        withNativeName
        onDateFromChange={(value) => patch({ dateFrom: value })}
        onDateToChange={(value) => patch({ dateTo: value })}
      />
      <ReportPaymentMethodField
        fieldClassName="min-w-0 gap-1.5 lg:col-span-4 xl:col-span-1"
        id={`${idPrefix}-payment-method`}
        options={methodOptions}
        value={draftFilters.paymentMethod}
        onValueChange={(value) => patch({ paymentMethod: value })}
      />
      <ReportPageLimitField
        fieldClassName="min-w-0 gap-1.5 lg:col-span-4 xl:col-span-1"
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
// เลือกจากจานสี emerald / sky / violet เพราะทั้งสามมีค่า fallback อยู่ใน .android-webview-compat
// ของ globals.css แล้ว (teal ที่ Design.md §4 แนะนำไม่มี) จึงเรนเดอร์ได้บน Android WebView รุ่นเก่า
const PAYMENT_METHOD_IDENTITIES = [
  {
    match: /cash|ສົດ|สด/,
    Icon: Banknote,
    chipClass: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    accentClass: "bg-emerald-500"
  },
  {
    match: /transfer|bank|ໂອນ|โอน/,
    Icon: ArrowLeftRight,
    chipClass: "bg-sky-500/12 text-sky-600 dark:text-sky-400",
    accentClass: "bg-sky-500"
  },
  {
    match: /debt|credit|ໜີ້|ຕິດ|เชื่อ/,
    Icon: HandCoins,
    chipClass: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
    accentClass: "bg-violet-500"
  }
] as const;

const DEFAULT_PAYMENT_METHOD_IDENTITY = {
  Icon: CreditCard,
  chipClass: "bg-primary/10 text-primary",
  accentClass: "bg-primary"
};

function paymentMethodIdentity(row: PaymentMethodReportRow) {
  const key = `${row.paymentMethodCode} ${row.paymentMethodName}`.toLowerCase();
  return (
    PAYMENT_METHOD_IDENTITIES.find((identity) => identity.match.test(key)) ??
    DEFAULT_PAYMENT_METHOD_IDENTITY
  );
}

type PaymentMethodTableField = {
  field: keyof PaymentMethodReportRow;
  minWidth: string;
  summaryKey: string;
};

const PAYMENT_METHOD_TABLE_FIELDS = [
  { field: "billCount", minWidth: "min-w-[84px]", summaryKey: "bill_count" },
  {
    field: "productPriceTotal",
    minWidth: "min-w-[132px]",
    summaryKey: "product_price_total",
  },
  {
    field: "toppingTotal",
    minWidth: "min-w-[116px]",
    summaryKey: "topping_total",
  },
  { field: "total", minWidth: "min-w-[132px]", summaryKey: "total" },
  {
    field: "discountItemAmount",
    minWidth: "min-w-[124px]",
    summaryKey: "discount_item_amount",
  },
  {
    field: "discountBill",
    minWidth: "min-w-[124px]",
    summaryKey: "discount_bill",
  },
  {
    field: "serviceCharge",
    minWidth: "min-w-[124px]",
    summaryKey: "sum_servicecharge",
  },
  { field: "vat", minWidth: "min-w-[104px]", summaryKey: "sum_vate" },
  {
    field: "grandTotal",
    minWidth: "min-w-[132px]",
    summaryKey: "grand_total",
  },
] as const satisfies readonly PaymentMethodTableField[];

type PaymentMetricByField = Partial<
  Record<keyof PaymentMethodReportRow, PaymentMethodsRowMetricConfig>
>;

// รายงานนี้มีวิธีชำระแค่ 3 แบบ แต่มีตัวชี้วัด 12 ตัว — ตารางแบบ "แถว = วิธีชำระ" จึงกลับด้านกับ
// รูปร่างข้อมูล: ได้ 3 แถวลอยอยู่บนหน้าเต็มจอ และต้องเลื่อนแนวนอน 12 คอลัมน์เพื่ออ่านวิธีเดียว
// สลับแกนเป็น "แถว = ตัวชี้วัด, คอลัมน์ = วิธีชำระ" แทน — เทียบ 3 วิธีได้ในบรรทัดเดียวซึ่งเป็น
// คำถามจริงของรายงานนี้ และ 12 แถวเติมความสูงหน้าเต็มพอดีโดยไม่ต้องเลื่อนแนวนอน
export function PaymentMethodsTable({
  reportTotal,
  rows,
  selectedRowIds,
  onToggleRow,
  onToggleRows,
}: {
  reportTotal: Record<string, unknown>;
  rows: PaymentMethodReportRow[];
  selectedRowIds: Set<string>;
  onToggleRow: (row: PaymentMethodReportRow, selected: boolean) => void;
  onToggleRows: (rows: PaymentMethodReportRow[], selected: boolean) => void;
}) {
  const { t } = useTranslation();
  const metrics = paymentMethodRowMetricConfigs(t);
  const totalPaymentAmount = paymentTotalAmount(reportTotal);
  const visibleIds = rows.map(paymentMethodReportRowId);
  const { allVisibleSelected, someVisibleSelected } = selectionStateForVisibleIds(
    visibleIds,
    selectedRowIds,
  );

  return (
    <div className="hidden min-w-0 md:block">
      <div className="grid gap-3 border-b border-border p-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <PaymentMethodShareCard key={paymentMethodReportRowId(row)} row={row} total={totalPaymentAmount} />
        ))}
      </div>

      <Table className="w-full table-auto text-sm">
        <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:h-10 [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-border [&_th]:bg-muted [&_th]:px-3 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground">
          <TableRow>
            <TableHead className="min-w-56">
              <span className="inline-flex items-center gap-2">
                <ReportIndeterminateCheckbox
                  aria-label={t("common.selectAll")}
                  checked={allVisibleSelected}
                  indeterminate={!allVisibleSelected && someVisibleSelected}
                  onCheckedChange={(checked) => onToggleRows(rows, checked as boolean)}
                />
                {t("report.paymentMethodsReport.columns.paymentMethod")}
              </span>
            </TableHead>

            {/* ติ๊กเลือกย้ายมาอยู่หัวคอลัมน์ — ยังกรองวิธีชำระก่อน export ได้เหมือนเดิม */}
            {rows.map((row) => {
              const id = paymentMethodReportRowId(row);
              const { Icon, chipClass } = paymentMethodIdentity(row);
              return (
                <TableHead key={id} className="min-w-32 text-right">
                  <span className="inline-flex items-center justify-end gap-2">
                    <Checkbox
                      aria-label={t("common.selectRow", { name: row.paymentMethodName })}
                      checked={selectedRowIds.has(id)}
                                            onCheckedChange={(checked) => onToggleRow(row, checked as boolean)}
                    />
                    <span className={cn("grid size-5 shrink-0 place-items-center rounded", chipClass)}>
                      <Icon className="size-3" aria-hidden="true" />
                    </span>
                    <span className="truncate font-semibold text-foreground">{row.paymentMethodName}</span>
                  </span>
                </TableHead>
              );
            })}

            <TableHead className="min-w-32 text-right font-semibold text-foreground">
              {t("report.paymentMethodsReport.totalSummary")}
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {metrics.map((metric, index) => {
            // ยอดรวมมาจาก summary ที่ backend คำนวณมาให้ ไม่บวกแถวเองที่ frontend
            // (ตัวเลขฝั่งหลังบ้านผ่านเงื่อนไข exclude_order_is_cancelled / exclude_order_item_status
            //  ซึ่งหน้าบ้านไม่รู้ การบวกเองจึงมีโอกาสได้เลขที่ไม่ตรงกับรายงานจริง)
            const columnTotal = reportTotal[metric.summaryKey];
            const grand = metric.key === "grand_total";

            return (
              <TableRow
                key={metric.key}
                className={cn(
                  "[&>td]:px-3 [&>td]:py-2.5",
                  index % 2 === 1 && "bg-muted/10",
                  grand && "border-t-2 border-primary bg-primary/5 hover:bg-primary/5",
                )}
              >
                <TableCell className={cn("whitespace-nowrap", grand ? "font-semibold text-foreground" : "text-muted-foreground")}>
                  {metric.label}
                </TableCell>

                {rows.map((row) => (
                  <TableCell
                    key={paymentMethodReportRowId(row)}
                    className={cn(
                      "whitespace-nowrap text-right tabular-nums",
                      grand ? "text-base font-semibold text-primary" : financialTextClass(metric.key, row[metric.field]),
                    )}
                  >
                    {displayMetric(row[metric.field], metric.kind)}
                  </TableCell>
                ))}

                {/* ใช้กติกาสีเดียวกับคอลัมน์ของแต่ละวิธีชำระ — ไม่งั้นส่วนลดจะแดงเฉพาะฝั่งซ้าย
                    แต่ยอดรวมของแถวเดียวกันกลับเป็นสีปกติ อ่านแล้วเหมือนคนละความหมาย */}
                <TableCell
                  className={cn(
                    "whitespace-nowrap text-right font-medium tabular-nums",
                    grand
                      ? "text-base font-semibold text-primary"
                      : financialTextClass(metric.key, columnTotal),
                  )}
                >
                  {displayMetric(columnTotal, metric.kind)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// การ์ดหัวเรื่องต่อวิธีชำระ: ยอดเงินกับสัดส่วนของยอดรวม อ่านได้ทันทีโดยไม่ต้องไล่ตาราง
function PaymentMethodShareCard({
  row,
  total,
}: {
  row: PaymentMethodReportRow;
  total: number;
}) {
  const share = paymentShare(row.paymentAmount, total);
  const { Icon, chipClass, accentClass } = paymentMethodIdentity(row);

  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-3">
      <div className="flex min-w-0 items-center gap-2">
        <div className={cn("grid size-8 shrink-0 place-items-center rounded-md", chipClass)}>
          <Icon className="size-4" aria-hidden="true" />
        </div>
        <p className="min-w-0 truncate text-sm font-semibold text-foreground">{row.paymentMethodName}</p>
      </div>
      <p className="mt-2 truncate text-xl font-semibold tabular-nums text-foreground">
        {displayMetric(row.paymentAmount, "money")}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full", accentClass)} style={{ width: `${share}%` }} />
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{Math.round(share)}%</span>
      </div>
    </div>
  );
}

export function PaymentMethodsMobileList({
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
  const metricByField = Object.fromEntries(
    paymentMethodRowMetricConfigs(t).map((metric) => [metric.field, metric]),
  ) as PaymentMetricByField;
  const totalPaymentAmount = paymentTotalAmount(reportTotal);
  const detailFields = PAYMENT_METHOD_TABLE_FIELDS.filter(
    ({ field }) => field !== "billCount" && field !== "grandTotal",
  );

  return (
    <div className="flex flex-col gap-3 p-3 md:hidden">
      {rows.map((row) => (
        <section
          key={`${row.paymentMethodCode}-${row.sortOrder}`}
          className={cn(
            "overflow-hidden rounded-md border border-border bg-card shadow-sm",
            selectedRowIds.has(paymentMethodReportRowId(row)) &&
              "border-primary/30 bg-primary/5",
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border bg-muted/20 px-3 py-3">
            <div className="flex min-w-0 items-start gap-3">
              <Checkbox
                aria-label={t("common.selectRow", {
                  name: row.paymentMethodName,
                })}
                className="mt-1"
                checked={selectedRowIds.has(paymentMethodReportRowId(row))}
                                onCheckedChange={(checked) => onToggleRow(row, checked as boolean)}
              />
              <PaymentMethodNameCell
                row={row}
                totalPaymentAmount={totalPaymentAmount}
              />
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[11px] font-bold text-muted-foreground">
                {t("report.paymentMethodsReport.columns.grandTotal")}
              </p>
              <p
                className={cn(
                  "text-base tabular-nums",
                  metricValueClass("grandTotal", row.grandTotal),
                )}
              >
                {displayMetric(row.grandTotal, "money")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
            <div className="px-3 py-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {t("report.paymentMethodsReport.columns.billsCount")}
              </p>
              <p className="text-sm font-black tabular-nums">
                {row.billCount}
              </p>
            </div>
            <div className="px-3 py-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {t("report.paymentMethodsReport.columns.total")}
              </p>
              <p
                className={cn(
                  "text-sm tabular-nums",
                  metricValueClass("total", row.total),
                )}
              >
                {displayMetric(row.total, "money")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 bg-muted/10 p-3">
            {detailFields.map(({ field }) => {
              const metric = metricByField[field];
              return (
                <div
                  key={field}
                  className="min-w-0 rounded-md border border-border bg-background/70 px-2.5 py-1.5"
                >
                  <p className="truncate text-[10px] font-bold text-muted-foreground">
                    {metric?.label ?? field}
                  </p>
                  <p
                    className={cn(
                      "truncate text-xs tabular-nums",
                      metricValueClass(field, row[field]),
                    )}
                  >
                    {metric
                      ? displayMetric(row[field], metric.kind)
                      : String(row[field] ?? "-")}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <PaymentMethodsMobileSummary
        metricByField={metricByField}
        reportTotal={reportTotal}
        rows={rows}
      />
    </div>
  );
}

function PaymentMethodNameCell({
  row,
  totalPaymentAmount,
}: {
  row: PaymentMethodReportRow;
  totalPaymentAmount: number;
}) {
  const share = paymentShare(row.paymentAmount, totalPaymentAmount);
  const { Icon, chipClass, accentClass } = paymentMethodIdentity(row);

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <div className={cn("grid size-8 shrink-0 place-items-center rounded-md", chipClass)}>
          <Icon className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold">{row.paymentMethodName}</p>
          <p className="text-xs text-muted-foreground">{row.paymentMethodCode}</p>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full", accentClass)} style={{ width: `${share}%` }} />
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">{share.toFixed(1)}%</span>
      </div>
    </div>
  );
}

function PaymentMethodsMobileSummary({
  metricByField,
  reportTotal,
  rows,
}: {
  metricByField: PaymentMetricByField;
  reportTotal: Record<string, unknown>;
  rows: PaymentMethodReportRow[];
}) {
  const { t } = useTranslation();

  return (
    <section className="overflow-hidden rounded-md border border-l-4 border-primary/40 border-l-primary bg-muted shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-primary/20 px-3 py-2.5">
        <p className="text-sm font-black text-primary">
          {t("report.paymentMethodsReport.totalSummary")}
        </p>
        <Badge className="border-primary/30 bg-card text-primary">
          {t("report.paymentMethodsReport.rowsLabel", { count: rows.length })}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-1.5 p-3">
        {PAYMENT_METHOD_TABLE_FIELDS.map(({ field, summaryKey }) => {
          const metric = metricByField[field];
          const value = summaryValue(reportTotal, rows, field, summaryKey);
          return (
            <div
              key={field}
              className="min-w-0 rounded-md border border-border bg-card px-2.5 py-1.5"
            >
              <p className="truncate text-[10px] font-bold text-muted-foreground">
                {metric?.label ?? field}
              </p>
              <p
                className={cn(
                  "truncate text-xs tabular-nums",
                  metricValueClass(field, value),
                  "font-bold",
                )}
              >
                {metric ? displayMetric(value, metric.kind) : String(value)}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function PaymentMethodsLoadingSkeleton() {
  return (
    <section aria-busy="true" className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="rounded-md border border-border bg-card p-4 shadow-sm">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-32" />
          </div>
        ))}
      </div>
      <div className="hidden overflow-hidden rounded-md border border-border md:block">
        <div className="grid min-w-295 grid-cols-[12rem_repeat(10,minmax(7rem,1fr))] gap-3 border-b border-border bg-muted/30 px-3 py-3">
          {Array.from({ length: 11 }).map((_, index) => (
            <Skeleton key={index} className="h-4" />
          ))}
        </div>
        {Array.from({ length: 7 }).map((_, rowIndex) => (
          <div key={rowIndex} className="grid min-w-295 grid-cols-[12rem_repeat(10,minmax(7rem,1fr))] gap-3 border-b border-border/70 px-3 py-3 last:border-b-0">
            {Array.from({ length: 11 }).map((__, cellIndex) => (
              <Skeleton key={cellIndex} className="h-5" />
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 md:hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-md border border-border bg-card p-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="grid flex-1 gap-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-7 w-24" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function isPresent(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

function summaryValue(
  reportTotal: Record<string, unknown>,
  rows: PaymentMethodReportRow[],
  field: keyof PaymentMethodReportRow,
  summaryKey: string,
) {
  const backendValue = reportTotal[summaryKey];
  if (isPresent(backendValue)) return metricNumber(backendValue);

  return rows.reduce((total, row) => total + metricNumber(row[field]), 0);
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

function financialTextClass(key: string, value: unknown, strong = false) {
  const number = metricNumber(value);
  // เดิมเช็ค key.includes("discount") ทำให้ after_discount_item / after_discount_bill
  // ซึ่งเป็น "ยอดคงเหลือหลังหักส่วนลด" ถูกทาสีแดงเหมือนเป็นยอดที่ถูกหักไป อ่านแล้วเข้าใจผิด
  const isDiscount = key.startsWith("discount");
  const isTotal = key === "total" || key.includes("total") || key.includes("amount");

  return cn(
    (strong || isTotal || (isDiscount && number > 0)) && "font-semibold",
    number === 0 && "text-muted-foreground",
    isDiscount && number > 0 && "text-destructive",
    !isDiscount && number > 0 && "text-foreground"
  );
}

function metricValueClass(field: keyof PaymentMethodReportRow, value: unknown) {
  const number = metricNumber(value);
  const isDiscount =
    field === "discountBill" || field === "discountItemAmount";
  const isTotal =
    field === "grandTotal" || field === "paymentAmount" || field === "total";

  return cn(
    "font-semibold",
    field === "billCount" && "font-black text-foreground",
    field === "paymentAmount" && number > 0 && "font-black text-primary",
    field === "grandTotal" && number > 0 && "font-black text-foreground",
    field === "total" && number > 0 && "font-black text-foreground",
    isDiscount && number > 0 && "font-black text-destructive",
    field === "serviceCharge" &&
      number > 0 &&
      "font-black text-sky-700 dark:text-sky-300",
    field === "vat" &&
      number > 0 &&
      "font-black text-amber-700 dark:text-amber-300",
    !isTotal &&
      !isDiscount &&
      field !== "serviceCharge" &&
      field !== "vat" &&
      number > 0 &&
      "text-foreground",
    number === 0 && "text-muted-foreground",
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

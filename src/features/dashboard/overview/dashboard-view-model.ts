import { Fragment, createElement } from "react";
import { businessDateInputValue } from "@/lib/format";

export type Row = Record<string, unknown>;

/** Translated `dashboard.*` strings, resolved once per language by the page. */
export type DashboardCopy = Record<string, string>;

export const DASHBOARD_PERIOD_TYPES = ["daily", "monthly", "yearly"] as const;
export type DashboardPeriodType = (typeof DASHBOARD_PERIOD_TYPES)[number];

// Monthly = one year + a month range (periodMonth..periodMonthEnd).
// Yearly = a year range (periodYear..periodYearEnd).
export type DashboardFilters = {
  end_date: string;
  periodMonth: number;
  periodMonthEnd: number;
  periodType: DashboardPeriodType;
  periodYear: number;
  periodYearEnd: number;
  start_date: string;
};

export type SelectOption = {
  label: string;
  value: string;
};

export type TrendPoint = {
  balance: number;
  cash: number;
  date: string;
  day: string;
  debt: number;
  mixed: number;
  orders: number;
  paid: number;
  revenue: number;
  transfer: number;
};

export type BreakdownRow = {
  count?: number;
  key: string;
  label: string;
  orderPercent: number;
  percent: number;
  revenuePercent: number;
  tone: Tone;
  value: number;
};

export type ProductRow = {
  hasImage: boolean;
  image: string;
  key: string;
  name: string;
  percent: number;
  qty: number;
  rank: number;
  revenue: number;
  size: string;
};

export type AccountingRow = {
  important: boolean;
  key: string;
  label: string;
  negative: boolean;
  value: number;
};

export type PaymentSummaryCard = {
  subLabel: import("react").JSX.Element;
  important: boolean;
  key: string;
  label: string;
  value: number;
};

const emptyPaymentSummarySubLabel = createElement(Fragment);

export type PaymentSummary = {
  cashTotal: number;
  debtTotal: number;
  hasMixedSplitColumns: boolean;
  mixedCashColumn: number;
  mixedTotal: number;
  mixedTransferColumn: number;
  total: number;
  transferTotal: number;
  unallocatedMixedTotal: number;
};

export type DashboardWarning = {
  copyKey?: string;
  key: string;
  value: string;
};

export type DashboardModel = {
  accountingRows: AccountingRow[];
  channelRows: BreakdownRow[];
  dashboard: Row;
  filters: Row;
  highestRevenueProduct: ProductRow | null;
  insights: Row;
  kpis: Row;
  mainOrderChannel: BreakdownRow | null;
  paymentRows: BreakdownRow[];
  paymentSummary: PaymentSummary;
  paymentSummaryCards: PaymentSummaryCard[];
  paymentTrendRows: TrendPoint[];
  peakRevenueDay: TrendPoint | null;
  productRows: ProductRow[];
  requestParams: Row;
  section: Row;
  tableSummary: Row;
  trendRows: TrendPoint[];
  warnings: DashboardWarning[];
};

export type Tone = "primary" | "sky" | "amber" | "rose" | "violet" | "slate";

export function toDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createDefaultFilters(date = new Date()): DashboardFilters {
  const today = businessDateInputValue(date);
  const [periodYear, periodMonth] = today.split("-").map(Number);

  return {
    end_date: today,
    periodMonth,
    periodMonthEnd: periodMonth,
    periodType: "daily",
    periodYear,
    periodYearEnd: periodYear,
    start_date: today
  };
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function monthRangeDates(year: number, fromMonth: number, toMonth: number) {
  const lastDay = new Date(year, toMonth, 0).getDate();

  return {
    end_date: `${year}-${pad2(toMonth)}-${pad2(lastDay)}`,
    start_date: `${year}-${pad2(fromMonth)}-01`
  };
}

function yearRangeDates(fromYear: number, toYear: number) {
  return {
    end_date: `${toYear}-12-31`,
    start_date: `${fromYear}-01-01`
  };
}

// Recomputes start/end dates from the period fields. A start that moves past the end drags
// the end along (and vice versa), so the range can never come out inverted.
function withPeriodDates(filters: DashboardFilters): DashboardFilters {
  if (filters.periodType === "monthly") {
    const periodMonthEnd = Math.max(filters.periodMonth, filters.periodMonthEnd);
    return {
      ...filters,
      periodMonthEnd,
      ...monthRangeDates(filters.periodYear, filters.periodMonth, periodMonthEnd)
    };
  }
  if (filters.periodType === "yearly") {
    const periodYearEnd = Math.max(filters.periodYear, filters.periodYearEnd);
    return { ...filters, periodYearEnd, ...yearRangeDates(filters.periodYear, periodYearEnd) };
  }
  return filters;
}

// e.g. picking 2024 in "yearly" mode auto-fills Jan 1 - Dec 31, 2024.
export function applyPeriodType(filters: DashboardFilters, periodType: DashboardPeriodType): DashboardFilters {
  return withPeriodDates({ ...filters, periodType });
}

/** The single year of a monthly range, or the first year of a yearly range. */
export function applyPeriodYear(filters: DashboardFilters, periodYear: number): DashboardFilters {
  return withPeriodDates({ ...filters, periodYear });
}

export function applyPeriodYearEnd(filters: DashboardFilters, periodYearEnd: number): DashboardFilters {
  return withPeriodDates({ ...filters, periodYear: Math.min(filters.periodYear, periodYearEnd), periodYearEnd });
}

export function applyPeriodMonth(filters: DashboardFilters, periodMonth: number): DashboardFilters {
  return withPeriodDates({ ...filters, periodMonth });
}

export function applyPeriodMonthEnd(filters: DashboardFilters, periodMonthEnd: number): DashboardFilters {
  return withPeriodDates({ ...filters, periodMonth: Math.min(filters.periodMonth, periodMonthEnd), periodMonthEnd });
}

export function yearSelectOptions(centerYear: number, span = 7): SelectOption[] {
  return Array.from({ length: span + 1 }, (_, index) => {
    const year = centerYear - index;
    return { label: String(year), value: String(year) };
  });
}

const tones: Tone[] = ["primary", "sky", "amber", "rose", "violet", "slate"];

export function asRow(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : {};
}

export function asRows(value: unknown): Row[] {
  return Array.isArray(value) ? value.map(asRow) : [];
}

export function text(value: unknown, fallback = "-") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

export function numberFrom(source: Row, key: string) {
  const value = source[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) return Number(value);
  return 0;
}

export function formatKip(value: unknown) {
  return `${Number(value ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })} ₭`;
}

export function formatNumber(value: unknown, digits = 0) {
  return Number(value ?? 0).toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function formatPercent(value: unknown) {
  return `${formatNumber(value, 2)}%`;
}

export function optionList(source: Row, key: string) {
  const options = asRows(asRow(source.parameter_options)[key]);
  return options.map((option) => ({
    value: text(option.value),
    label: text(option.label, text(option.value))
  }));
}

export function selectedLabel(options: SelectOption[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function branchLabel(branch: Row, language: string) {
  const localizedName = language === "en" ? branch.branch_name_eng : branch.branch_name_la;
  return text(localizedName, text(branch.branch_name, text(branch.branch_code, text(branch.branch_uuid))));
}

function breakdownRows(rows: Row[], totalKey = "value"): BreakdownRow[] {
  const filtered = rows.filter((row) => !text(row.key).toLowerCase().includes("total"));
  const total = filtered.reduce((sum, row) => sum + numberFrom(row, totalKey), 0);
  const totalCount = filtered.reduce((sum, row) => sum + (numberFrom(row, "orders_count") || numberFrom(row, "count")), 0);

  return filtered.map((row, index) => {
    const value = numberFrom(row, totalKey);
    const count = numberFrom(row, "orders_count") || numberFrom(row, "count");
    const orderPercent = numberFrom(row, "orders_percent") || (totalCount ? (count / totalCount) * 100 : 0);
    const revenuePercent = numberFrom(row, "revenue_percent") || (total ? (value / total) * 100 : 0);

    return {
      count: count || undefined,
      key: text(row.key, text(row.channel_code, text(row.label, String(index)))),
      label: text(row.label, text(row.channel_name, text(row.channel_code))),
      orderPercent,
      percent: revenuePercent || orderPercent,
      revenuePercent,
      tone: tones[index % tones.length],
      value
    };
  });
}

function productRows(rows: Row[], limit: number): ProductRow[] {
  const maxQty = Math.max(1, ...rows.map((row) => numberFrom(row, "qty_total") || numberFrom(row, "value")));

  return rows.slice(0, limit).map((row, index) => {
    const image = text(row.prod_image, "");
    const imageStatus = row.prod_status_imge;

    return {
      hasImage: Boolean(image) && (imageStatus === undefined || imageStatus === null || numberFrom(row, "prod_status_imge") > 0),
      image,
      key: text(row.prod_uuid, text(row.key, String(index))),
      name: text(row.prod_name, text(row.label)),
      percent: numberFrom(row, "bar_percent") || ((numberFrom(row, "qty_total") || numberFrom(row, "value")) / maxQty) * 100,
      qty: numberFrom(row, "qty_total") || numberFrom(row, "value"),
      rank: numberFrom(row, "rank") || index + 1,
      revenue: numberFrom(row, "revenue_total"),
      size: text(row.size_name, text(row.prod_size, text(row.size, "")))
    };
  });
}

function accountingRows(rows: Row[]): AccountingRow[] {
  return rows.map((row) => ({
    important: Boolean(row.important),
    key: text(row.key, text(row.label)),
    label: text(row.label),
    negative: Boolean(row.negative),
    value: numberFrom(row, "value")
  }));
}

function paymentSummaryCards(rows: Row[], fallbackRows: BreakdownRow[]): PaymentSummaryCard[] {
  if (!rows.length) {
    return fallbackRows.map((row) => ({
      important: false,
      key: row.key,
      label: row.label,
      subLabel: emptyPaymentSummarySubLabel,
      value: row.value
    }));
  }

  return rows.map((row) => ({
    important: Boolean(row.important),
    key: text(row.key, text(row.label)),
    label: text(row.label),
    subLabel: emptyPaymentSummarySubLabel,
    value: numberFrom(row, "value")
  }));
}

function normalizePaymentSummary(row: Row): PaymentSummary {
  return {
    cashTotal: numberFrom(row, "cash_total"),
    debtTotal: numberFrom(row, "debt_total"),
    hasMixedSplitColumns: Boolean(row.has_mixed_split_columns),
    mixedCashColumn: numberFrom(row, "mixed_cash_column"),
    mixedTotal: numberFrom(row, "mixed_total"),
    mixedTransferColumn: numberFrom(row, "mixed_transfer_column"),
    total: numberFrom(row, "total"),
    transferTotal: numberFrom(row, "transfer_total"),
    unallocatedMixedTotal: numberFrom(row, "unallocated_mixed_total")
  };
}

function normalizeMainOrderChannel(row: Row): BreakdownRow | null {
  if (!Object.keys(row).length) return null;

  const value = numberFrom(row, "revenue_total") || numberFrom(row, "value");
  const count = numberFrom(row, "orders_count") || numberFrom(row, "count");
  const orderPercent = numberFrom(row, "orders_percent");
  const revenuePercent = numberFrom(row, "revenue_percent");

  return {
    count: count || undefined,
    key: text(row.channel_code, text(row.key, text(row.channel_name, "main"))),
    label: text(row.channel_name, text(row.label, text(row.channel_code))),
    orderPercent,
    percent: revenuePercent || orderPercent,
    revenuePercent,
    tone: "primary",
    value
  };
}

function highestRevenueProduct(rows: ProductRow[]) {
  return rows.reduce<ProductRow | null>(
    (selected, row) => (!selected || row.revenue > selected.revenue ? row : selected),
    null
  );
}

function peakRevenueDay(rows: TrendPoint[]) {
  return rows.reduce<TrendPoint | null>(
    (selected, row) => (!selected || row.revenue > selected.revenue ? row : selected),
    null
  );
}

function normalizeWarnings(warnings: Row): DashboardWarning[] {
  const copyKeys: Record<string, string> = {
    payment_split_warning: "paymentSplitWarning"
  };

  // The API sends every warning key, with an empty/null value when it does not apply;
  // only real messages become banners.
  return Object.entries(warnings).filter(([, value]) => text(value, "").trim() !== "").map(([key, value]) => {
    const valueText = text(value);
    const copyKey = copyKeys[valueText] ?? copyKeys[key];

    return copyKey ? { copyKey, key, value: valueText } : { key, value: valueText };
  });
}

function rowsAtPath(source: Row, path: unknown): Row[] {
  const key = text(path, "");
  if (!key) return [];

  return asRows(key.split(".").reduce<unknown>((current, part) => asRow(current)[part], source));
}

function normalizeTrendRows(rows: Row[]): TrendPoint[] {
  return rows.map((row) => ({
    balance: numberFrom(row, "balance_total"),
    cash: numberFrom(row, "cash_total"),
    date: text(row.business_date),
    day: text(row.day),
    debt: numberFrom(row, "debt_total"),
    mixed: numberFrom(row, "mixed_total") || numberFrom(row, "split_total") || numberFrom(row, "split_payment_total"),
    orders: numberFrom(row, "orders_count"),
    paid: numberFrom(row, "paid_total"),
    revenue: numberFrom(row, "revenue_total"),
    transfer: numberFrom(row, "transfer_total")
  }));
}

// ---------------------------------------------------------------------------
// Presentation helpers for the redesigned dashboard. Pure, so every branch is unit-tested
// without mounting React.

const moneyUnits = new Set(["k", "kip", "kib", "lak", "₭", "ກີບ"]);

/** The API's main total carries its own unit; Kip spellings all print as ₭. */
export function formatApiMoney(value: unknown, unit: string) {
  if (!unit || moneyUnits.has(unit.trim().toLowerCase())) return formatKip(value);
  return `${formatNumber(value)} ${unit}`;
}

export function share(value: number, total: number) {
  return total > 0 ? (value / total) * 100 : 0;
}

/** "25,480,000 ₭" → { number: "25,480,000", unit: "₭" }; null when it is not a plain figure. */
export function splitMoneyString(value: string): { number: string; unit: string } | null {
  const match = /^(-?\d[\d,]*(?:\.\d+)?)(?:\s+(.+))?$/.exec(value.trim());
  if (!match) return null;
  return { number: match[1], unit: match[2] ?? "" };
}

/**
 * Figures past `digitLimit` digits (a yearly total in Kip) step down one size to stay unbroken;
 * the plate allows 11, the narrower KPI tiles 9.
 */
export function kipFigureSize(figure: string, digitLimit = 11): "default" | "long" {
  return figure.replace(/\D/g, "").length > digitLimit ? "long" : "default";
}

/** What the daily sales bars measure. */
export type TrendMetric = "orders" | "revenue";

export type TrendBucketKind = "day" | "week" | "month";

export type TrendBucket = {
  balance: number;
  cash: number;
  /** First business date in the bucket. */
  date: string;
  debt: number;
  dates: string[];
  /** Days summed into this bucket; an edge week or month of the range can hold fewer. */
  days: number;
  key: string;
  label: string;
  mixed: number;
  orders: number;
  paid: number;
  revenue: number;
  transfer: number;
};

/** Past this many days the chart switches to weekly totals; past MONTH_BUCKET_LIMIT, monthly. */
export const DAY_BUCKET_LIMIT = 62;
export const MONTH_BUCKET_LIMIT = 400;

function parseBusinessDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function weekStartKey(date: Date) {
  // ISO weeks start on Monday.
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return `${monday.getFullYear()}-${pad2(monday.getMonth() + 1)}-${pad2(monday.getDate())}`;
}

function bucketOf(row: TrendPoint, kind: TrendBucketKind, index: number) {
  const parsed = parseBusinessDate(row.date);
  if (kind === "day" || !parsed) {
    return { key: row.date !== "-" ? row.date : String(index), label: row.day !== "-" ? row.day : row.date };
  }
  if (kind === "week") {
    // Keyed by the ISO week, labelled by its first day inside the range, so a range that starts
    // mid-week never shows a date it does not cover.
    return { key: weekStartKey(parsed), label: `${row.date.slice(8, 10)}/${row.date.slice(5, 7)}` };
  }
  return { key: row.date.slice(0, 7), label: `${row.date.slice(5, 7)}/${row.date.slice(0, 4)}` };
}

export function trendBucketKind(rowCount: number): TrendBucketKind {
  if (rowCount > MONTH_BUCKET_LIMIT) return "month";
  if (rowCount > DAY_BUCKET_LIMIT) return "week";
  return "day";
}

type PaymentParts = Pick<TrendPoint, "cash" | "debt" | "revenue" | "transfer">;

/** Revenue the cash/transfer/debt split does not cover (mixed payments the API could not split). */
export function unsplitRevenue(row: PaymentParts) {
  return Math.max(0, row.revenue - (row.cash + row.transfer + row.debt));
}

/**
 * Height of a stacked revenue bar: cash + transfer + debt plus the unsplit remainder, i.e. the
 * day's revenue, or the split's sum when the payment rows carry no revenue figure.
 */
export function plottedRevenue(row: PaymentParts) {
  return Math.max(row.revenue, row.cash + row.transfer + row.debt);
}

/** Sums daily rows into at most ~62 bars so a yearly range stays readable. */
export function bucketTrendRows(rows: TrendPoint[]): { kind: TrendBucketKind; rows: TrendBucket[] } {
  const kind = trendBucketKind(rows.length);
  const buckets = new Map<string, TrendBucket>();

  rows.forEach((row, index) => {
    const { key, label } = bucketOf(row, kind, index);
    const bucket = buckets.get(key) ?? {
      balance: 0, cash: 0, date: row.date, dates: [], days: 0, debt: 0, key, label,
      mixed: 0, orders: 0, paid: 0, revenue: 0, transfer: 0,
    };
    bucket.balance += row.balance;
    bucket.cash += row.cash;
    bucket.debt += row.debt;
    bucket.mixed += row.mixed;
    bucket.orders += row.orders;
    bucket.paid += row.paid;
    bucket.revenue += row.revenue;
    bucket.transfer += row.transfer;
    bucket.dates.push(row.date);
    bucket.days += 1;
    buckets.set(key, bucket);
  });

  return { kind, rows: Array.from(buckets.values()) };
}

export type SkylineColumn = {
  /** Column height as a share of the tallest column, 0-100. */
  height: number;
  isPeak: boolean;
  key: string;
  /** Share of the column that is still owed, 0-100. */
  owedPercent: number;
};

/**
 * One column per day (or week/month once bucketed) for the plate's skyline: height is revenue,
 * the hatched cap is what is still owed. Revenue comes from the sales rows and the owed amount
 * from the payment rows of the same date, because the API may split them across two charts.
 */
export function skylineColumns(
  trendRows: TrendPoint[],
  paymentTrendRows: TrendPoint[],
  peakDate: string | null,
): SkylineColumn[] {
  const payments = new Map(paymentTrendRows.map((row) => [row.date, row]));
  const source = trendRows.length ? trendRows : paymentTrendRows;
  const merged = source.map((row) => {
    const payment = payments.get(row.date);
    const revenue = row.revenue || (payment ? payment.revenue || payment.cash + payment.transfer + payment.debt : 0);
    const owedSource = row.balance || row.debt || payment?.balance || payment?.debt || 0;
    return { ...row, balance: Math.min(Math.max(owedSource, 0), revenue), revenue };
  });
  const { rows } = bucketTrendRows(merged);
  const max = Math.max(0, ...rows.map((row) => row.revenue));

  return rows.map((row) => ({
    height: max > 0 ? (row.revenue / max) * 100 : 0,
    isPeak: Boolean(peakDate) && row.revenue > 0 && row.dates.includes(peakDate ?? ""),
    key: row.key,
    owedPercent: row.revenue > 0 ? (row.balance / row.revenue) * 100 : 0,
  }));
}

export type PaymentSplitKey = "cash" | "transfer" | "debt" | "unallocated";

export type PaymentSplitSegment = {
  key: PaymentSplitKey;
  /** The API's own label when it sent one. */
  label: string;
  share: number;
  value: number;
};

const paymentSplitKeys = ["cash", "transfer", "debt"] as const;

/**
 * Cash / transfer / debt for the whole period, in that fixed order so a method keeps its colour.
 * Whatever the period total holds beyond the three (mixed payments the API could not split) is
 * shown as its own neutral segment instead of being silently dropped.
 */
export function paymentSplit(cards: PaymentSummaryCard[]): { segments: PaymentSplitSegment[]; total: number } {
  const methods = paymentSplitKeys.map((key) => {
    const card = cards.find((item) => item.key === key);
    return { key, label: card?.label ?? "", value: Math.max(0, card?.value ?? 0) };
  });
  const methodTotal = methods.reduce((sum, method) => sum + method.value, 0);
  // The period total is the card the API marks important (or keys "total"). Without one it is
  // every payment line, so methods beyond the three (e.g. "mixed") still count in the shares.
  const totalCard = cards.find((card) => card.important) ?? cards.find((card) => card.key === "total");
  const reported = totalCard
    ? Math.max(0, totalCard.value)
    : cards.reduce((sum, card) => sum + Math.max(0, card.value), 0);
  const total = Math.max(reported, methodTotal);
  const unallocated = total - methodTotal;
  const segments: Omit<PaymentSplitSegment, "share">[] =
    unallocated >= 1 ? [...methods, { key: "unallocated", label: "", value: unallocated }] : methods;

  return { segments: segments.map((segment) => ({ ...segment, share: share(segment.value, total) })), total };
}

/** Running share of the total after each item, in the given order. */
export function cumulativeShares(values: number[]) {
  const total = values.reduce((sum, value) => sum + value, 0);
  let running = 0;
  return values.map((value) => {
    running += value;
    return share(running, total);
  });
}

/** How many items (in the given order) it takes to reach 80% of the total. */
export function paretoCount(values: number[]) {
  const reached = cumulativeShares(values).findIndex((value) => value >= 80 - 1e-9);
  return reached === -1 ? values.length : reached + 1;
}

export type LedgerStep = {
  /** Bar start and end as a share of the widest amount, 0-100. */
  from: number;
  key: string;
  kind: "step" | "total";
  to: number;
};

/** A 1 ₭ rounding difference is noted; past 1% the rows are not a gross-to-net walk at all. */
export const LEDGER_GAP_TOLERANCE = 0.01;

/**
 * Gross-to-net waterfall for the accounting card. The first row and every `important` row are
 * totals drawn from zero; the rows between them move the running total (negative rows down).
 * The walk must end on a reported total (rows after the last one, or a list with no total, are
 * unchecked and may not be increments at all) and land on every total within
 * LEDGER_GAP_TOLERANCE; otherwise no bars are drawn — the receipt still lists every row.
 */
export function buildLedgerSteps(rows: AccountingRow[]): { gap: number; reconciles: boolean; steps: LedgerStep[] } {
  if (rows.length < 2 || !rows[rows.length - 1].important) return { gap: 0, reconciles: false, steps: [] };

  let running = 0;
  let gap = 0;
  let reconciles = true;
  const spans = rows.map((row, index) => {
    const isTotal = index === 0 || row.important;
    if (isTotal) {
      if (index > 0) {
        const difference = Math.abs(running - row.value);
        gap = Math.max(gap, difference);
        if (difference > Math.max(1, Math.abs(row.value) * LEDGER_GAP_TOLERANCE)) reconciles = false;
      }
      running = row.value;
      return { from: 0, key: row.key, kind: "total" as const, to: row.value };
    }
    const start = running;
    running += row.negative ? -Math.abs(row.value) : row.value;
    return { from: Math.min(start, running), key: row.key, kind: "step" as const, to: Math.max(start, running) };
  });

  const max = Math.max(0, ...spans.map((span) => span.to));
  if (!reconciles || max <= 0 || spans.some((span) => span.from < 0)) {
    return { gap, reconciles: false, steps: [] };
  }

  return {
    gap,
    reconciles,
    steps: spans.map((span) => ({ ...span, from: (span.from / max) * 100, to: (span.to / max) * 100 })),
  };
}

export type SeatState = "occupied" | "waiting" | "available" | "unknown";

/** Up to this many tables are drawn one cell each; more become a single segmented bar. */
export const SEAT_GRID_LIMIT = 60;

export function seatSummary(summary: Row) {
  const total = Math.max(0, numberFrom(summary, "total_tables"));
  const occupied = Math.max(0, numberFrom(summary, "occupied_tables"));
  const waiting = Math.max(0, numberFrom(summary, "waiting_tables"));
  const available = Math.max(0, numberFrom(summary, "available_tables"));
  const counted = occupied + waiting + available;
  // Counts that do not add up to the table total leave the remainder visibly unknown.
  const unknown = Math.max(0, total - counted);
  const cells: SeatState[] | null =
    total > 0 && total <= SEAT_GRID_LIMIT
      ? [
          ...Array<SeatState>(Math.min(occupied, total)).fill("occupied"),
          ...Array<SeatState>(Math.min(waiting, Math.max(0, total - occupied))).fill("waiting"),
          ...Array<SeatState>(Math.min(available, Math.max(0, total - occupied - waiting))).fill("available"),
          ...Array<SeatState>(unknown).fill("unknown"),
        ]
      : null;

  return {
    available,
    cells,
    occupancy: Math.min(100, Math.max(0, numberFrom(summary, "occupancy_rate"))),
    occupied,
    total,
    unknown,
    waiting,
  };
}

/** Per-day values for a KPI sparkline; null when there are too few days to draw a line. */
export function sparklineValues(rows: TrendPoint[], metric: "orders" | "avgBill"): number[] | null {
  if (rows.length < 3) return null;
  if (metric === "orders") return rows.map((row) => row.orders);
  const values = rows.filter((row) => row.orders > 0).map((row) => row.revenue / row.orders);
  return values.length >= 3 ? values : null;
}

/** SVG path for a sparkline in a 100 x 32 viewBox, with 2 units of vertical breathing room. */
export function sparklinePath(values: number[]) {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 30 - ((value - min) / range) * 28;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export function createDashboardModel(data: unknown, _filters: DashboardFilters, top = "10"): DashboardModel {
  const dashboard = asRow(data);
  const charts = asRow(dashboard.charts);
  const section = asRow(asRow(dashboard.dashboard_sections).rank_1_sales_payment_summary);
  const tables = asRow(dashboard.tables);
  const requestParams = asRow(dashboard.request_params);
  const salesTrendSource = rowsAtPath(dashboard, section.chart_source_key);
  const paymentTrendSource = rowsAtPath(dashboard, section.payment_chart_source_key);
  const paymentLines = asRows(section.payment_lines);
  const monthlySalesPieRows = asRows(charts.monthly_sales_pie);
  const orderChannelRows = asRows(charts.order_channel_chart);
  const orderChannelFallbackRows = asRows(asRow(dashboard.order_channel_summary).channels);
  const topSellingProductRows = asRows(charts.top_selling_products_chart);
  const topSellingProductFallbackRows = asRows(dashboard.top_selling_products);
  const monthlyDailySalesRows = asRows(charts.monthly_daily_sales);
  const revenueTrendRows = asRows(charts.revenue_trend);
  const monthlyDailyPaymentRows = asRows(charts.monthly_daily_payments);
  const accountingSummaryRows = asRows(section.accounting_summary);
  const paymentSource = paymentLines.length ? paymentLines : monthlySalesPieRows;
  const channelSource = orderChannelRows.length ? orderChannelRows : orderChannelFallbackRows;
  const productSource = topSellingProductRows.length ? topSellingProductRows : topSellingProductFallbackRows;
  const paymentRows = breakdownRows(paymentSource);
  const trendSource = salesTrendSource.length
    ? salesTrendSource
    : monthlyDailySalesRows.length
      ? monthlyDailySalesRows
      : revenueTrendRows;
  const productLimit = numberFrom(requestParams, "top") || Number(top) || productSource.length;
  const products = productRows(productSource, productLimit);
  const trendRows = normalizeTrendRows(trendSource);
  const paymentTrendRows = normalizeTrendRows(
    paymentTrendSource.length ? paymentTrendSource : monthlyDailyPaymentRows
  );

  return {
    accountingRows: accountingRows(accountingSummaryRows),
    channelRows: breakdownRows(channelSource, "revenue_total"),
    dashboard,
    filters: asRow(dashboard.filters),
    highestRevenueProduct: highestRevenueProduct(products),
    insights: asRow(dashboard.insights),
    kpis: asRow(dashboard.kpis),
    mainOrderChannel: normalizeMainOrderChannel(asRow(asRow(dashboard.insights).main_order_channel)),
    paymentRows,
    paymentSummary: normalizePaymentSummary(asRow(charts.payment_summary)),
    paymentSummaryCards: paymentSummaryCards(paymentLines, paymentRows),
    paymentTrendRows,
    peakRevenueDay: peakRevenueDay(trendRows),
    productRows: products,
    requestParams,
    section,
    tableSummary: asRow(tables.summary),
    trendRows,
    warnings: normalizeWarnings(asRow(dashboard.warnings))
  };
}

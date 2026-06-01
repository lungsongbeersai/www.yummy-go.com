export type Row = Record<string, unknown>;

export type DashboardFilters = {
  summary_range: string;
  report_year: string;
  report_month: string;
  top: string;
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
  percent: number;
  tone: Tone;
  value: number;
};

export type ProductRow = {
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

export type DashboardModel = {
  accountingRows: AccountingRow[];
  channelRows: BreakdownRow[];
  dashboard: Row;
  filters: Row;
  insights: Row;
  kpis: Row;
  paymentRows: BreakdownRow[];
  paymentTrendRows: TrendPoint[];
  productRows: ProductRow[];
  requestParams: Row;
  section: Row;
  tableSummary: Row;
  trendRows: TrendPoint[];
  warnings: Array<{ key: string; value: string }>;
};

export type Tone = "primary" | "sky" | "amber" | "rose" | "violet" | "slate";

export function createDefaultFilters(): DashboardFilters {
  return {
    summary_range: "",
    report_year: "",
    report_month: "",
    top: ""
  };
}

export const defaultFilters = createDefaultFilters();

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

export function formatCompactKip(value: unknown) {
  const amount = Number(value ?? 0);
  if (amount >= 1_000_000) return `${formatNumber(amount / 1_000_000, 1)}M`;
  if (amount >= 1_000) return `${formatNumber(amount / 1_000, 0)}K`;
  return formatNumber(amount);
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

  return filtered.map((row, index) => {
    const value = numberFrom(row, totalKey);
    const explicitPercent = numberFrom(row, "revenue_percent") || numberFrom(row, "orders_percent");

    return {
      count: numberFrom(row, "orders_count") || numberFrom(row, "count") || undefined,
      key: text(row.key, text(row.channel_code, text(row.label, String(index)))),
      label: text(row.label, text(row.channel_name, text(row.channel_code))),
      percent: explicitPercent || (total ? (value / total) * 100 : 0),
      tone: tones[index % tones.length],
      value
    };
  });
}

function productRows(rows: Row[], limit: number): ProductRow[] {
  const maxQty = Math.max(1, ...rows.map((row) => numberFrom(row, "qty_total") || numberFrom(row, "value")));

  return rows.slice(0, limit).map((row, index) => ({
    key: text(row.prod_uuid, text(row.key, String(index))),
    name: text(row.prod_name, text(row.label)),
    percent: numberFrom(row, "bar_percent") || ((numberFrom(row, "qty_total") || numberFrom(row, "value")) / maxQty) * 100,
    qty: numberFrom(row, "qty_total") || numberFrom(row, "value"),
    rank: numberFrom(row, "rank") || index + 1,
    revenue: numberFrom(row, "revenue_total"),
    size: text(row.size_name, text(row.prod_size, text(row.size, "")))
  }));
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
    mixed: numberFrom(row, "mixed_total") || numberFrom(row, "split_total") || numberFrom(row, "split_payment_total"),
    orders: numberFrom(row, "orders_count"),
    paid: numberFrom(row, "paid_total"),
    revenue: numberFrom(row, "revenue_total"),
    transfer: numberFrom(row, "transfer_total")
  }));
}

export function createDashboardModel(data: unknown, filters: DashboardFilters): DashboardModel {
  const dashboard = asRow(data);
  const charts = asRow(dashboard.charts);
  const section = asRow(asRow(dashboard.dashboard_sections).rank_1_sales_payment_summary);
  const tables = asRow(dashboard.tables);
  const requestParams = asRow(dashboard.request_params);
  const salesTrendSource = rowsAtPath(dashboard, section.chart_source_key);
  const paymentTrendSource = rowsAtPath(dashboard, section.payment_chart_source_key);
  const paymentSource = asRows(section.payment_lines).length
    ? asRows(section.payment_lines)
    : asRows(charts.monthly_sales_pie);
  const channelSource = asRows(charts.order_channel_chart).length
    ? asRows(charts.order_channel_chart)
    : asRows(asRow(dashboard.order_channel_summary).channels);
  const productSource = asRows(charts.top_selling_products_chart).length
    ? asRows(charts.top_selling_products_chart)
    : asRows(dashboard.top_selling_products);
  const trendSource = salesTrendSource.length
    ? salesTrendSource
    : asRows(charts.monthly_daily_sales).length
      ? asRows(charts.monthly_daily_sales)
      : asRows(charts.revenue_trend);

  return {
    accountingRows: accountingRows(asRows(section.accounting_summary)),
    channelRows: breakdownRows(channelSource, "revenue_total"),
    dashboard,
    filters: asRow(dashboard.filters),
    insights: asRow(dashboard.insights),
    kpis: asRow(dashboard.kpis),
    paymentRows: breakdownRows(paymentSource),
    paymentTrendRows: normalizeTrendRows(
      paymentTrendSource.length ? paymentTrendSource : asRows(charts.monthly_daily_payments)
    ),
    productRows: productRows(productSource, numberFrom(requestParams, "top") || Number(filters.top) || productSource.length),
    requestParams,
    section,
    tableSummary: asRow(tables.summary),
    trendRows: normalizeTrendRows(trendSource),
    warnings: Object.entries(asRow(dashboard.warnings)).map(([key, value]) => ({
      key,
      value: text(value)
    }))
  };
}

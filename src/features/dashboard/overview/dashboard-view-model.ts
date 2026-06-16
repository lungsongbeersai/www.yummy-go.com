export type Row = Record<string, unknown>;

export type DashboardFilters = {
  end_date: string;
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
  important: boolean;
  key: string;
  label: string;
  value: number;
};

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
  const today = toDateInputValue(date);

  return {
    end_date: today,
    start_date: today
  };
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
      value: row.value
    }));
  }

  return rows.map((row) => ({
    important: Boolean(row.important),
    key: text(row.key, text(row.label)),
    label: text(row.label),
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

  return Object.entries(warnings).map(([key, value]) => {
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
    mixed: numberFrom(row, "mixed_total") || numberFrom(row, "split_total") || numberFrom(row, "split_payment_total"),
    orders: numberFrom(row, "orders_count"),
    paid: numberFrom(row, "paid_total"),
    revenue: numberFrom(row, "revenue_total"),
    transfer: numberFrom(row, "transfer_total")
  }));
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

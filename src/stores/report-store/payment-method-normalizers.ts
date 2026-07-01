import { pageLimitNumber } from "@/lib/pagination";
import {
  isPaymentMethodReportFilter,
  PAYMENT_METHOD_REPORT_FILTER_OPTIONS,
  type PaymentMethodReportFilter,
  type PaymentMethodsReportResponse
} from "@/services/report";
import type { ApiEntity, PageLimit } from "@/services/shared/types";

export type PaymentMethodCardValueType = "money" | "number";

export interface PaymentMethodSummaryCard {
  key: string;
  label: string;
  sortOrder: number;
  value: number;
  valueType: PaymentMethodCardValueType;
}

export interface PaymentMethodOption {
  label: string;
  sortOrder: number;
  value: PaymentMethodReportFilter;
}

export interface PaymentMethodReportRow {
  activeCount: number;
  amount: number;
  billsCount: number;
  cancelledCount: number;
  cancelledTotal: number;
  changeAmount: number;
  debtAmount: number;
  discountBill: number;
  discountTotal: number;
  itemDiscount: number;
  itemsCount: number;
  paymentMethodCode: string;
  paymentMethodName: string;
  qtyTotal: number;
  rank: number;
  receiveCash: number;
  receiveTransfer: number;
  serviceCharge: number;
  sortOrder: number;
  toppingTotal: number;
  total: number;
  vat: number;
}

export interface PaymentMethodsPagination {
  limit: PageLimit;
  page: number;
  total: number;
  totalPages: number;
}

export interface PaymentMethodsReportNormalized {
  cards: PaymentMethodSummaryCard[];
  pagination: PaymentMethodsPagination;
  paymentMethods: PaymentMethodOption[];
  reportName: string;
  reportTotal: ApiEntity;
  rows: PaymentMethodReportRow[];
  summaryCards: ApiEntity;
}

function isRecord(value: unknown): value is ApiEntity {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown): ApiEntity {
  return isRecord(value) ? value : {};
}

function asRecords(value: unknown): ApiEntity[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function isPresent(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

function textValue(value: unknown, fallback = "") {
  return isPresent(value) ? String(value) : fallback;
}

function numberValue(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (!isPresent(value)) continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function readValue(row: ApiEntity, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (isPresent(value)) return value;
  }
  return undefined;
}

function responseRoot(response: PaymentMethodsReportResponse) {
  const data = response.data;
  if (
    isRecord(data) &&
    (
      data.summary ||
      data.report_total ||
      data.payment_methods ||
      data.dashboard_cards ||
      data.card_summary ||
      data.rows ||
      data.items ||
      data.methods ||
      data.payment_rows ||
      data.payment_method_summaries ||
      data.payment_summary_by_method
    )
  ) {
    return data as PaymentMethodsReportResponse;
  }
  return response;
}

function valueType(value: unknown): PaymentMethodCardValueType {
  return value === "number" ? "number" : "money";
}

function normalizeCards(root: ApiEntity) {
  return asRecords(root.dashboard_cards).length
    ? asRecords(root.dashboard_cards)
    : asRecords(root.card_summary);
}

function normalizeCard(row: ApiEntity, index: number): PaymentMethodSummaryCard {
  const key = textValue(readValue(row, ["key", "name", "field", "id"]), `card-${index + 1}`);
  return {
    key,
    label: textValue(readValue(row, ["label", "title", "name"]), key),
    sortOrder: firstNumber(readValue(row, ["sort_order", "sortOrder"]), index + 1),
    value: numberValue(readValue(row, ["value", "amount", "total", "count"])),
    valueType: valueType(readValue(row, ["value_type", "type", "kind"]))
  };
}

function fallbackPaymentMethodOptions(): PaymentMethodOption[] {
  return PAYMENT_METHOD_REPORT_FILTER_OPTIONS.map((value, index) => ({
    label: value,
    sortOrder: index + 1,
    value
  }));
}

function normalizePaymentOption(row: ApiEntity, index: number): PaymentMethodOption | null {
  const value = readValue(row, ["value", "code", "key"]);
  if (!isPaymentMethodReportFilter(value)) return null;
  return {
    label: textValue(readValue(row, ["label", "name", "title"]), value),
    sortOrder: firstNumber(readValue(row, ["sort_order", "sortOrder"]), index + 1),
    value
  };
}

function normalizePaymentOptions(root: ApiEntity) {
  const options = asRecords(root.payment_methods)
    .map(normalizePaymentOption)
    .filter((option): option is PaymentMethodOption => Boolean(option))
    .sort((left, right) => left.sortOrder - right.sortOrder);

  return options.length ? options : fallbackPaymentMethodOptions();
}

function normalizeReportTotal(root: ApiEntity) {
  const summary = asRecord(root.summary);
  const reportTotal = asRecord(root.report_total ?? root.summary_cards);
  const source = Object.keys(summary).length ? summary : reportTotal;

  if (!Object.keys(source).length) return reportTotal;

  const normalized: ApiEntity = { ...source };
  const assignNumber = (key: string, aliases: string[]) => {
    const value = readValue(source, aliases);
    if (isPresent(value)) normalized[key] = numberValue(value);
  };

  assignNumber("active_count", ["active_count"]);
  assignNumber("amount", ["amount", "product_price_total"]);
  assignNumber("avg_bill", ["avg_bill", "average_bill"]);
  assignNumber("bills_count", ["bills_count", "bill_count"]);
  assignNumber("cancelled_count", ["cancelled_count", "canceled_count"]);
  assignNumber("cancelled_total", ["cancelled_total", "canceled_total"]);
  assignNumber("change_amount", ["change_amount", "change_total"]);
  assignNumber("debt_amount", ["debt_amount", "debt_total", "paid_debt"]);
  assignNumber("discount_bill", ["discount_bill", "bill_discount"]);
  assignNumber("discount_total", ["discount_total", "sum_discount"]);
  assignNumber("item_discount", ["item_discount", "discount_item", "discount_item_amount"]);
  assignNumber("items_count", ["items_count", "item_count"]);
  assignNumber("qty_total", ["qty_total", "total_qty", "item_qty"]);
  assignNumber("receive_cash", ["receive_cash", "paid_cash", "cash_total"]);
  assignNumber("receive_transfer", ["receive_transfer", "paid_transfer", "transfer_total"]);
  assignNumber("rows_count", ["rows_count", "method_count", "payment_method_count"]);
  assignNumber("service_charge", ["service_charge", "service_charge_amount", "sum_servicecharge"]);
  assignNumber("topping_total", ["topping_total"]);
  assignNumber("total", ["grand_total", "payment_total", "payment_amount", "sum_total", "net_total", "paid_amount", "total"]);
  assignNumber("vat", ["vat", "vat_amount", "sum_vate"]);

  return normalized;
}

function paymentRows(root: ApiEntity) {
  const candidates = [
    root.data,
    root.rows,
    root.items,
    root.methods,
    root.payment_rows,
    root.payment_method_summaries,
    root.payment_summary_by_method,
    root.payment_summary
  ];

  for (const candidate of candidates) {
    const rows = asRecords(candidate);
    if (rows.length) return rows;
  }

  return [];
}

function normalizeLimit(value: unknown, fallback: PageLimit): PageLimit {
  if (typeof value === "string" && value.toLowerCase() === "all") return "All";
  if (typeof value === "number" || value === "All" || value === null) return value;
  return fallback;
}

function normalizeRow(row: ApiEntity, index: number): PaymentMethodReportRow {
  const code = textValue(readValue(row, ["payment_method_code", "payment_code", "payment_method", "payment_type", "code", "key"]), "-");
  return {
    activeCount: numberValue(readValue(row, ["active_count"])),
    amount: numberValue(readValue(row, ["amount", "product_price_total"])),
    billsCount: numberValue(readValue(row, ["bills_count", "bill_count"])),
    cancelledCount: numberValue(readValue(row, ["cancelled_count", "canceled_count"])),
    cancelledTotal: numberValue(readValue(row, ["cancelled_total", "canceled_total"])),
    changeAmount: numberValue(readValue(row, ["change_amount", "change_total"])),
    debtAmount: numberValue(readValue(row, ["debt_amount", "debt_total", "paid_debt"])),
    discountBill: numberValue(readValue(row, ["discount_bill", "bill_discount"])),
    discountTotal: numberValue(readValue(row, ["discount_total", "sum_discount"])),
    itemDiscount: numberValue(readValue(row, ["item_discount", "discount_item", "item_discount_amount", "discount_item_amount"])),
    itemsCount: numberValue(readValue(row, ["items_count", "item_count"])),
    paymentMethodCode: code,
    paymentMethodName: textValue(readValue(row, ["payment_method_name", "payment_name", "payment_method_label", "name", "label"]), code),
    qtyTotal: numberValue(readValue(row, ["qty_total", "total_qty", "qty", "quantity", "item_qty"])),
    rank: firstNumber(readValue(row, ["rank"]), index + 1),
    receiveCash: numberValue(readValue(row, ["receive_cash", "paid_cash", "cash_received", "cash_total"])),
    receiveTransfer: numberValue(readValue(row, ["receive_transfer", "paid_transfer", "transfer_received", "transfer_total"])),
    serviceCharge: numberValue(readValue(row, ["service_charge", "service_charge_amount", "sum_servicecharge"])),
    sortOrder: firstNumber(readValue(row, ["sort_order", "sortOrder"]), index + 1),
    toppingTotal: numberValue(readValue(row, ["topping_total"])),
    total: numberValue(readValue(row, ["grand_total", "payment_amount", "sum_total", "net_total", "paid_amount", "total"])),
    vat: numberValue(readValue(row, ["vat", "vat_amount", "sum_vate"]))
  };
}

function totalPages(root: ApiEntity, total: number, limit: PageLimit, page: number) {
  const explicit = firstNumber(root.totalPages, root.total_pages, root.total_page, root.totalPage);
  if (explicit > 0) return Math.max(1, explicit);
  const numericLimit = pageLimitNumber(limit);
  return total > 0 && numericLimit > 0 ? Math.max(1, Math.ceil(total / numericLimit)) : Math.max(1, page);
}

export function normalizePaymentMethodsReportResponse(
  response: PaymentMethodsReportResponse,
  requestedLimit: PageLimit,
  requestedPage: number
): PaymentMethodsReportNormalized {
  const root = responseRoot(response);
  const rows = paymentRows(root).map(normalizeRow).sort((left, right) => left.sortOrder - right.sortOrder);
  const total = firstNumber(root.total, root.total_rows, rows.length);
  const page = firstNumber(root.page, requestedPage) || requestedPage;
  const limitValue = normalizeLimit(root.limit, requestedLimit);
  const reportTotal = normalizeReportTotal(root);

  return {
    cards: normalizeCards(root).map(normalizeCard).sort((left, right) => left.sortOrder - right.sortOrder),
    pagination: {
      limit: limitValue,
      page,
      total,
      totalPages: totalPages(root, total, limitValue, page)
    },
    paymentMethods: normalizePaymentOptions(root),
    reportName: textValue(root.report_name, ""),
    reportTotal,
    rows,
    summaryCards: asRecord(root.summary ?? root.summary_cards)
  };
}

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
  if (isRecord(data) && (data.report_total || data.payment_methods || data.dashboard_cards || data.card_summary)) {
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

function normalizeRow(row: ApiEntity, index: number): PaymentMethodReportRow {
  const code = textValue(readValue(row, ["payment_method_code", "payment_code", "code"]), "-");
  return {
    activeCount: numberValue(readValue(row, ["active_count"])),
    amount: numberValue(readValue(row, ["amount"])),
    billsCount: numberValue(readValue(row, ["bills_count", "bill_count"])),
    cancelledCount: numberValue(readValue(row, ["cancelled_count", "canceled_count"])),
    cancelledTotal: numberValue(readValue(row, ["cancelled_total", "canceled_total"])),
    changeAmount: numberValue(readValue(row, ["change_amount", "change_total"])),
    debtAmount: numberValue(readValue(row, ["debt_amount", "debt_total"])),
    discountBill: numberValue(readValue(row, ["discount_bill", "bill_discount"])),
    discountTotal: numberValue(readValue(row, ["discount_total"])),
    itemDiscount: numberValue(readValue(row, ["item_discount", "item_discount_amount"])),
    itemsCount: numberValue(readValue(row, ["items_count", "item_count"])),
    paymentMethodCode: code,
    paymentMethodName: textValue(readValue(row, ["payment_method_name", "payment_name", "name"]), code),
    qtyTotal: numberValue(readValue(row, ["qty_total", "qty", "quantity"])),
    rank: firstNumber(readValue(row, ["rank"]), index + 1),
    receiveCash: numberValue(readValue(row, ["receive_cash", "cash_received"])),
    receiveTransfer: numberValue(readValue(row, ["receive_transfer", "transfer_received"])),
    serviceCharge: numberValue(readValue(row, ["service_charge", "service_charge_amount"])),
    sortOrder: firstNumber(readValue(row, ["sort_order", "sortOrder"]), index + 1),
    toppingTotal: numberValue(readValue(row, ["topping_total"])),
    total: numberValue(readValue(row, ["total", "net_total"])),
    vat: numberValue(readValue(row, ["vat", "vat_amount"]))
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
  const rows = asRecords(root.data).map(normalizeRow).sort((left, right) => left.sortOrder - right.sortOrder);
  const total = firstNumber(root.total, root.total_rows, rows.length);
  const page = firstNumber(root.page, requestedPage) || requestedPage;
  const limitValue = (root.limit as PageLimit | undefined) ?? requestedLimit;
  const reportTotal = asRecord(root.report_total ?? root.summary_cards);

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
    summaryCards: asRecord(root.summary_cards)
  };
}

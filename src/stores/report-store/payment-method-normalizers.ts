import { firstNumberOrZero as firstNumber, isPresent, readValue, textValue as textValueWithDash } from "@/lib/values";
import { pageLimitNumber } from "@/lib/pagination";
import {
  isPaymentMethodReportFilter,
  type PaymentMethodReportFilter,
  type PaymentMethodsReportResponse
} from "@/services/report";
import type { ApiEntity, PageLimit } from "@/services/shared/types";

const textValue = (value: unknown, fallback = "") => textValueWithDash(value, fallback);

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
  afterDiscountBill: number;
  afterDiscountItem: number;
  billCount: number;
  billTotal: number;
  discountBill: number;
  discountItemAmount: number;
  grandTotal: number;
  paymentAmount: number;
  paymentMethodCode: string;
  paymentMethodName: string;
  productPriceTotal: number;
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

function numberValue(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
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

function normalizePaymentOption(row: ApiEntity, index: number): PaymentMethodOption | null {
  const value = readValue(row, ["value", "code", "key"]);
  if (!isPaymentMethodReportFilter(value)) return null;
  return {
    label: textValue(readValue(row, ["label", "name", "title"]), value),
    sortOrder: firstNumber(readValue(row, ["sort_order", "sortOrder"]), index + 1),
    value
  };
}

// ห้าม fallback เป็นรหัสดิบ (all/cash/...) ที่ store — ถ้า API ไม่ส่ง options มา
// ให้คืน [] เพื่อให้ paymentMethodOptions() ฝั่ง UI ใส่ fallback ที่แปลภาษาแล้วแทน
function normalizePaymentOptions(root: ApiEntity) {
  return asRecords(root.payment_methods)
    .map(normalizePaymentOption)
    .filter((option): option is PaymentMethodOption => Boolean(option))
    .sort((left, right) => left.sortOrder - right.sortOrder);
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

  assignNumber("after_discount_bill", ["after_discount_bill"]);
  assignNumber("after_discount_item", ["after_discount_item"]);
  assignNumber("bill_count", ["bill_count", "bills_count"]);
  assignNumber("bill_total", ["bill_total"]);
  assignNumber("discount_bill", ["discount_bill", "bill_discount"]);
  assignNumber("discount_item_amount", [
    "discount_item_amount",
    "discount_item",
    "item_discount",
  ]);
  assignNumber("difference", ["difference"]);
  assignNumber("grand_total", ["grand_total", "sum_total", "net_total"]);
  assignNumber("item_count", ["item_count", "items_count"]);
  assignNumber("payment_total", ["payment_total", "payment_amount"]);
  assignNumber("product_price_total", ["product_price_total", "amount"]);
  assignNumber("sum_servicecharge", ["sum_servicecharge", "service_charge"]);
  assignNumber("sum_vate", ["sum_vate", "vat", "vat_amount"]);
  assignNumber("topping_total", ["topping_total"]);
  assignNumber("total", ["total"]);
  assignNumber("total_qty", ["total_qty", "qty_total"]);

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
    afterDiscountBill: numberValue(readValue(row, ["after_discount_bill"])),
    afterDiscountItem: numberValue(readValue(row, ["after_discount_item"])),
    billCount: numberValue(readValue(row, ["bill_count", "bills_count"])),
    billTotal: numberValue(readValue(row, ["bill_total"])),
    discountBill: numberValue(readValue(row, ["discount_bill", "bill_discount"])),
    discountItemAmount: numberValue(
      readValue(row, [
        "discount_item_amount",
        "item_discount_amount",
        "discount_item",
        "item_discount",
      ]),
    ),
    grandTotal: numberValue(readValue(row, ["grand_total", "sum_total"])),
    paymentAmount: numberValue(readValue(row, ["payment_amount", "payment_total"])),
    paymentMethodCode: code,
    paymentMethodName: textValue(readValue(row, ["payment_method_name", "payment_name", "payment_method_label", "name", "label"]), code),
    productPriceTotal: numberValue(readValue(row, ["product_price_total", "amount"])),
    serviceCharge: numberValue(readValue(row, ["service_charge", "service_charge_amount", "sum_servicecharge"])),
    sortOrder: firstNumber(readValue(row, ["sort_order", "sortOrder"]), index + 1),
    toppingTotal: numberValue(readValue(row, ["topping_total"])),
    total: numberValue(readValue(row, ["total"])),
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

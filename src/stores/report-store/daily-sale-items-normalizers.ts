import { isAllPageLimit, pageLimitNumber } from "@/lib/pagination";
import type { DailySaleItemsResponse } from "@/services/report";
import type { ApiEntity, PageLimit } from "@/services/shared/types";

export interface DailySaleItemsBillGroup {
  amountTotal: number;
  branchName: string;
  cancelled: boolean;
  debtAmount: number;
  discountTotal: number;
  id: string;
  invoiceNumber: string;
  itemCount: number;
  items: ApiEntity[];
  lineTotal: number;
  paymentMethodCode: string;
  paymentMethodName: string;
  qtyTotal: number;
  raw: ApiEntity;
  receiveCashAmount: number;
  receiveTransferAmount: number;
  saleDate: string;
  serviceChargeAmount: number;
  status: string;
  tableName: string;
  toppingTotal: number;
  vatAmount: number;
}

export interface DailySaleItemsPagination {
  limit: PageLimit;
  page: number;
  total: number;
  totalPages: number;
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

function readValue(row: ApiEntity, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (isPresent(value)) return value;
  }
  return undefined;
}

function numberValue(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function firstNumber(row: ApiEntity, keys: string[]) {
  return numberValue(readValue(row, keys));
}

function responseRoot(response: DailySaleItemsResponse) {
  return isRecord(response.data) ? response.data : response;
}

function responseRows(root: ApiEntity, response: DailySaleItemsResponse) {
  const directRows = Array.isArray(response.data) ? asRecords(response.data) : [];
  if (directRows.length) return directRows;

  for (const key of ["data", "items", "orders", "rows", "list"]) {
    const rows = asRecords(root[key]);
    if (rows.length) return rows;
  }

  return [];
}

function isCancelled(row: ApiEntity) {
  const status = textValue(readValue(row, ["bill_status", "status", "status_name", "status_text"]), "").toLowerCase();
  return status.includes("cancel") || status.includes("void") || status === "0";
}

function syntheticItemId(billId: string, item: ApiEntity, index: number) {
  return [
    "daily-sale-item",
    billId,
    index,
    textValue(readValue(item, ["order_item_uuid", "prod_uuid", "pro_detail_uuid", "prod_code"])),
    textValue(readValue(item, ["product_name", "prod_name", "name"])),
    textValue(readValue(item, ["qty", "quantity"]))
  ].join(":");
}

function normalizeBill(row: ApiEntity, index: number): DailySaleItemsBillGroup {
  const summary = asRecord(row.summary);
  const invoiceNumber = textValue(readValue(row, ["order_invoice", "invoice_number", "invoice_no", "invoice"]), `bill-${index + 1}`);
  const id = textValue(readValue(row, ["order_uuid", "bill_uuid", "uuid", "id"]), `bill:${invoiceNumber}`);
  const saleDate = textValue(readValue(row, ["sale_date", "created_at", "order_date", "date"]), "-");
  const tableName = textValue(readValue(row, ["table_name", "table_name_la", "table_name_eng"]), "-");
  const paymentMethodName = textValue(readValue(row, ["payment_method_name", "payment_method", "payment_type_name"]), "-");
  const paymentMethodCode = textValue(readValue(row, ["payment_method_code", "payment_method", "payment_type"]), "");
  const status = textValue(readValue(row, ["bill_status", "status", "status_name", "status_text"]), "-");
  const items = asRecords(row.items).map((item, itemIndex) => ({
    ...item,
    __report_bill_id: id,
    __report_record_id: textValue(readValue(item, ["order_item_uuid", "order_it_uuid"]), "") || syntheticItemId(id, item, itemIndex),
    branch_name: textValue(readValue(row, ["branch_name", "branch_name_la", "branch_name_eng"]), ""),
    order_invoice: invoiceNumber,
    order_uuid: textValue(readValue(row, ["order_uuid"]), ""),
    payment_method_code: paymentMethodCode,
    payment_method_name: paymentMethodName,
    sale_date: saleDate,
    status_name: status,
    table_name: tableName
  }));
  const qtyTotal = firstNumber(summary, ["qty_total", "quantity_total"]) || items.reduce((total, item) => total + firstNumber(item, ["qty", "quantity"]), 0);

  return {
    amountTotal: firstNumber(summary, ["amount", "order_total", "subtotal"]),
    branchName: textValue(readValue(row, ["branch_name", "branch_name_la", "branch_name_eng"]), "-"),
    cancelled: isCancelled(row),
    debtAmount: firstNumber(summary, ["debt_amount", "debt_total", "balance_total"]),
    discountTotal: firstNumber(summary, ["discount_total", "discount_amount", "item_discount", "discount_bill"]),
    id,
    invoiceNumber,
    itemCount: firstNumber(summary, ["items_count", "item_count"]) || items.length,
    items,
    lineTotal: firstNumber(summary, ["total", "net_total", "grand_total"]),
    paymentMethodCode,
    paymentMethodName,
    qtyTotal,
    raw: row,
    receiveCashAmount: firstNumber(summary, ["receive_cash", "cash_received", "cash_total"]),
    receiveTransferAmount: firstNumber(summary, ["receive_transfer", "transfer_received", "transfer_total"]),
    saleDate,
    serviceChargeAmount: firstNumber(summary, ["service_charge", "service_charge_amount", "service_total"]),
    status,
    tableName,
    toppingTotal: firstNumber(summary, ["topping_total", "topping_line_total"]),
    vatAmount: firstNumber(summary, ["vat", "vat_amount", "vat_total"])
  };
}

function totalPages(root: ApiEntity, total: number, limit: PageLimit, page: number) {
  if (isAllPageLimit(limit)) return 1;
  const explicit = Number(readValue(root, ["totalPages", "total_pages", "total_page", "totalPage"]));
  if (Number.isFinite(explicit) && explicit > 0) return Math.max(1, explicit);
  const numericLimit = pageLimitNumber(limit);
  return total > 0 && numericLimit > 0 ? Math.max(1, Math.ceil(total / numericLimit)) : Math.max(1, page);
}

export function normalizeDailySaleItemsResponse(
  response: DailySaleItemsResponse,
  fallback: { limit: PageLimit; page: number }
) {
  const root = responseRoot(response);
  const rows = responseRows(root, response);
  const bills = rows.map(normalizeBill);
  const total = numberValue(readValue(root, ["total", "total_rows", "count", "rows_count"])) || bills.length;
  const page = numberValue(root.page) || fallback.page;
  const limit = isAllPageLimit(fallback.limit) ? fallback.limit : numberValue(root.limit) || fallback.limit;

  return {
    bills,
    pagination: {
      limit,
      page,
      total,
      totalPages: totalPages(root, total, fallback.limit, page)
    },
    reportTotal: asRecord(root.report_total),
    response,
    rows: bills.flatMap((bill) => bill.items)
  };
}

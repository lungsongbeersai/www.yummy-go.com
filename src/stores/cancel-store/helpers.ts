import { pageLimitNumber } from "@/lib/pagination";
import type {
  CancelableBill,
  CancelableBillDetail,
  CancelableBillsResponse,
  CancelableDateOption,
  CancelledBill,
  CancelledBillsResponse,
  FetchCancelledBillsParams,
  FetchCancelableBillsParams
} from "@/services/cancel";
import type { ApiEntity, PageLimit } from "@/services/shared/types";

export interface CancelHistoryBill {
  balance: number;
  branchName: string;
  branchUuid: string;
  cancelReason: string;
  cancelledAt: string;
  discountAmount: number;
  grandTotal: number;
  invoice: string;
  orderDate: string;
  orderQty: number;
  orderTotal: number;
  orderUuid: string;
  paidTotal: number;
  raw: CancelledBill;
  serviceAmount: number;
  statusCode: string;
  statusName: string;
  subtotal: number;
  tableName: string;
  tableUuid: string;
  vatAmount: number;
}

function isRecord(value: unknown): value is ApiEntity {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecords<T extends ApiEntity>(value: unknown): T[] {
  return Array.isArray(value) ? value.filter(isRecord) as T[] : [];
}

function asRecord<T extends ApiEntity>(value: unknown): T | null {
  return isRecord(value) ? value as T : null;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function numberValue(value: unknown) {
  return firstNumber(value) ?? 0;
}

function textValue(value: unknown) {
  return value === null || value === undefined || value === "" ? "" : String(value);
}

function responseRoot(response: ApiEntity) {
  return isRecord(response.data) ? response.data : response;
}

export function cancelResponseTotalPages(root: ApiEntity, total: number, limit: PageLimit, page: number) {
  const explicit = firstNumber(root.totalPages, root.total_pages, root.total_page, root.totalPage);
  if (explicit !== null) return Math.max(1, explicit);
  const numericLimit = pageLimitNumber(limit);
  return total > 0 && numericLimit > 0 ? Math.max(1, Math.ceil(total / numericLimit)) : Math.max(1, page);
}

export function normalizeCancelableBillsResponse(
  response: CancelableBillsResponse,
  params: FetchCancelableBillsParams
) {
  const root = responseRoot(response);
  const bills = asRecords<CancelableBill>(response.data);
  const dateOptions = asRecords<CancelableDateOption>(root.date_options ?? root.dateOptions);
  const selectedBill = asRecord<CancelableBillDetail>(root.selected_bill ?? root.selectedBill);
  const total = firstNumber(root.total, root.total_rows, root.total_count, root.count) ?? bills.length;
  const totalPages = cancelResponseTotalPages(root, total, params.limit, params.page);

  return { bills, dateOptions, selectedBill, total, totalPages };
}

function normalizeCancelledBill(row: CancelledBill): CancelHistoryBill {
  return {
    balance: numberValue(row.order_balance),
    branchName: textValue(row.branch_name || row.branch_name_eng),
    branchUuid: textValue(row.branch_uuid_fk),
    cancelReason: textValue(row.order_cancel_reason),
    cancelledAt: textValue(row.order_cancelled_at),
    discountAmount: numberValue(row.order_discount_amount),
    grandTotal: numberValue(row.order_grand_total),
    invoice: textValue(row.order_invoice),
    orderDate: textValue(row.order_date),
    orderQty: numberValue(row.order_qty),
    orderTotal: numberValue(row.order_total),
    orderUuid: textValue(row.order_uuid),
    paidTotal: numberValue(row.order_paid_total),
    raw: row,
    serviceAmount: numberValue(row.order_service_amount),
    statusCode: textValue(row.status_code),
    statusName: textValue(row.status_name),
    subtotal: numberValue(row.order_subtotal),
    tableName: textValue(row.table_name_la || row.table_name_eng || row.table_id),
    tableUuid: textValue(row.table_uuid_fk),
    vatAmount: numberValue(row.order_vat_amount)
  };
}

export function normalizeCancelledBillsResponse(
  response: CancelledBillsResponse,
  params: FetchCancelledBillsParams
) {
  const root = responseRoot(response);
  const bills = asRecords<CancelledBill>(root.data).map(normalizeCancelledBill);
  const page = firstNumber(root.page) ?? params.page;
  const limit = firstNumber(root.limit) ?? params.limit;
  const total = firstNumber(root.total, root.total_rows, root.total_count, root.count) ?? bills.length;
  const totalPages = cancelResponseTotalPages(root, total, limit, page);

  return { historyBills: bills, historyLimit: limit, historyPage: page, historyTotal: total, historyTotalPages: totalPages };
}

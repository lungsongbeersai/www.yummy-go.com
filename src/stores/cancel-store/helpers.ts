import { pageLimitNumber } from "@/lib/pagination";
import type {
  CancelableBill,
  CancelableBillDetail,
  CancelableBillsResponse,
  CancelableDateOption,
  FetchCancelableBillsParams
} from "@/services/cancel";
import type { ApiEntity, PageLimit } from "@/services/shared/types";

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

function responseRoot(response: CancelableBillsResponse) {
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

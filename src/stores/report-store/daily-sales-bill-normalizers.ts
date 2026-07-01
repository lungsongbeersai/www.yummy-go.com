import { isAllPageLimit, pageLimitNumber } from "@/lib/pagination";
import type { DailySalesBillReportResponse } from "@/services/report";
import type { ApiEntity, PageLimit } from "@/services/shared/types";

export interface DailySalesBillReportPagination {
  limit: PageLimit;
  page: number;
  total: number;
  totalPages: number;
}

export interface DailySalesBillReportNormalized {
  filters: ApiEntity;
  pagination: DailySalesBillReportPagination;
  response: DailySalesBillReportResponse;
  rows: ApiEntity[];
  summary: ApiEntity;
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

function readValue(row: ApiEntity, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return undefined;
}

function totalPages(root: ApiEntity, total: number, limit: PageLimit, page: number) {
  if (isAllPageLimit(limit)) return 1;
  const explicit = numberValue(readValue(root, ["totalPages", "total_pages", "total_page", "totalPage"]));
  if (explicit > 0) return Math.max(1, explicit);
  const numericLimit = pageLimitNumber(limit);
  return total > 0 && numericLimit > 0 ? Math.max(1, Math.ceil(total / numericLimit)) : Math.max(1, page);
}

export function normalizeDailySalesBillReportResponse(
  response: DailySalesBillReportResponse,
  fallback: { limit: PageLimit; page: number },
): DailySalesBillReportNormalized {
  const root = response as ApiEntity;
  const rows = asRecords(response.bills ?? root.bills);
  const total = numberValue(readValue(root, ["total", "total_rows", "count"])) || rows.length;
  const page = numberValue(root.page) || fallback.page;
  const limit = isAllPageLimit(fallback.limit) ? fallback.limit : numberValue(root.limit) || fallback.limit;

  return {
    filters: asRecord(root.filters),
    pagination: {
      limit,
      page,
      total,
      totalPages: totalPages(root, total, fallback.limit, page),
    },
    response,
    rows,
    summary: asRecord(root.summary),
  };
}

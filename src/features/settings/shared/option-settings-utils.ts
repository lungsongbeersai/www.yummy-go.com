import { DEFAULT_PAGE_LIMIT } from "@/lib/pagination";
import type { ApiEntity, PageLimit } from "@/services/shared/types";

export function optionValue(row: ApiEntity | null | undefined, key: string, fallback = "") {
  const raw = row?.[key];
  if (raw === null || raw === undefined || raw === "") return fallback;
  return String(raw);
}

export function optionPageSize(limit: PageLimit, rowsLength: number) {
  return limit === "All" ? rowsLength || Number(DEFAULT_PAGE_LIMIT) : Number(limit ?? DEFAULT_PAGE_LIMIT);
}

export function optionTotalPages(totalPages: number, total: number, pageSize: number) {
  return Math.max(1, Number(totalPages || Math.ceil(total / pageSize) || 1));
}

export function optionPageRange(rowsLength: number, page: number, pageSize: number) {
  const start = rowsLength ? (page - 1) * pageSize + 1 : 0;
  return {
    start,
    end: rowsLength ? start + rowsLength - 1 : 0
  };
}

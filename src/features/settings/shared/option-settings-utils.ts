import { pageLimitSize, pageRange, pageTotalPages } from "@/lib/pagination";
import type { ApiEntity, PageLimit } from "@/services/shared/types";

export function optionValue(row: ApiEntity | null | undefined, key: string, fallback = "") {
  const raw = row?.[key];
  if (raw === null || raw === undefined || raw === "") return fallback;
  return String(raw);
}

// Re-exported under their original names: the pagination-range math itself now
// lives in src/lib/pagination.ts (promoted so src/features/stock can share it).
export function optionPageSize(limit: PageLimit, rowsLength: number) {
  return pageLimitSize(limit, rowsLength);
}

export const optionTotalPages = pageTotalPages;

export const optionPageRange = pageRange;

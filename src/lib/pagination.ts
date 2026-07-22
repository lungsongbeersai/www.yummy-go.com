import type { PageLimit } from "@/services/shared/types";

export const DEFAULT_PAGE_LIMIT: PageLimit = 20;
export const PAGE_LIMIT_ALL = "All";
export const PAGE_LIMIT_ALL_BATCH = 200;
export const PAGE_LIMIT_OPTIONS: PageLimit[] = [20, 50, 100, 200, PAGE_LIMIT_ALL];

export function isAllPageLimit(limit: PageLimit | undefined): limit is typeof PAGE_LIMIT_ALL {
  return limit === PAGE_LIMIT_ALL;
}

export function pageLimitNumber(limit: PageLimit | undefined, fallback = Number(DEFAULT_PAGE_LIMIT)) {
  const value = typeof limit === "number" ? limit : Number(limit);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function pageLimitSize(limit: PageLimit | undefined, rowCount: number, fallback = Number(DEFAULT_PAGE_LIMIT)) {
  return isAllPageLimit(limit) ? rowCount || fallback : pageLimitNumber(limit, fallback);
}

// Falls back to a client-computed page count when the API doesn't report one (or reports 0).
export function pageTotalPages(totalPages: number, total: number, pageSize: number) {
  return Math.max(1, Number(totalPages || Math.ceil(total / pageSize) || 1));
}

export function pageRange(rowsLength: number, page: number, pageSize: number) {
  const start = rowsLength ? (page - 1) * pageSize + 1 : 0;
  return {
    start,
    end: rowsLength ? start + rowsLength - 1 : 0
  };
}

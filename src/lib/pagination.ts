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

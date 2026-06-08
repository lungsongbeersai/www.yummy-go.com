import { DEFAULT_PAGE_LIMIT, PAGE_LIMIT_OPTIONS } from "@/lib/pagination";
import type { PageLimit } from "@/services/shared/types";

export const PAGE_QUERY_PARAM = "page";
export const LIMIT_QUERY_PARAM = "limit";

export interface UrlPaginationState {
  page: number;
  limit: PageLimit;
}

export type UrlSearchParamsRecord = Record<string, string | string[] | undefined>;

interface PaginationOptions {
  defaultLimit?: PageLimit;
  limitOptions?: PageLimit[];
}

export function parseUrlPagination(
  searchParams: URLSearchParams | UrlSearchParamsRecord | undefined,
  options: PaginationOptions = {},
): UrlPaginationState {
  const defaultLimit = options.defaultLimit ?? DEFAULT_PAGE_LIMIT;
  const limitOptions = options.limitOptions ?? PAGE_LIMIT_OPTIONS;

  return {
    page: normalizeUrlPage(paramValue(searchParams, PAGE_QUERY_PARAM)),
    limit: normalizeUrlLimit(paramValue(searchParams, LIMIT_QUERY_PARAM), defaultLimit, limitOptions),
  };
}

export function normalizeUrlPage(value: unknown) {
  const page = Number(firstValue(value));
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function normalizeUrlLimit(value: unknown, defaultLimit: PageLimit = DEFAULT_PAGE_LIMIT, limitOptions: PageLimit[] = PAGE_LIMIT_OPTIONS) {
  const raw = firstValue(value);
  if (!raw) return defaultLimit;

  const nextLimit: PageLimit = raw === "All" ? "All" : Number(raw);
  return limitOptions.some((limit) => samePageLimit(limit, nextLimit)) ? nextLimit : defaultLimit;
}

export function samePageLimit(a: PageLimit, b: PageLimit) {
  return String(a ?? "") === String(b ?? "");
}

function paramValue(searchParams: URLSearchParams | UrlSearchParamsRecord | undefined, key: string) {
  if (!searchParams) return "";
  if (searchParams instanceof URLSearchParams) return searchParams.get(key) ?? "";
  return searchParams[key];
}

function firstValue(value: unknown) {
  if (Array.isArray(value)) return String(value[0] ?? "");
  return value === null || value === undefined ? "" : String(value);
}

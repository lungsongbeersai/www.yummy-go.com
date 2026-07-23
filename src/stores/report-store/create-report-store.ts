"use client";

import { create } from "zustand";
import { DEFAULT_PAGE_LIMIT, PAGE_LIMIT_ALL_BATCH, isAllPageLimit } from "@/lib/pagination";
import type { PageLimit } from "@/services/shared/types";
import { createSessionGuard } from "@/stores/session-store-registry";
import { errorMessage } from "@/stores/store-utils";

// The {limit, page, total, totalPages} pagination shape is identical across every paginated
// report's normalizer (each declares its own nominal *Pagination type for domain clarity),
// so the default value and the loadAll finalization math are shared here instead of being
// hand-copied per store.
export interface ReportPagination {
  limit: PageLimit;
  page: number;
  total: number;
  totalPages: number;
}

export function defaultReportPagination(limit: PageLimit = DEFAULT_PAGE_LIMIT): ReportPagination {
  return { limit, page: 1, total: 0, totalPages: 1 };
}

/** Folds a page-walk's outcome into the {limit, page, total, totalPages} a store exposes:
 *  when `loadAll` batched every page, `total`/`page`/`totalPages` collapse to the merged
 *  count / page 1 / 1 page; otherwise the first page's own pagination values pass through. */
export function finalizeReportPagination<Pagination extends ReportPagination>(
  pagination: Pagination,
  limit: PageLimit,
  loadAll: boolean,
  loadAllTotal: number
): Pagination {
  const total = loadAll ? loadAllTotal : pagination.total;
  return {
    ...pagination,
    limit,
    page: loadAll ? 1 : pagination.page,
    total,
    totalPages: loadAll ? 1 : pagination.totalPages
  };
}

/**
 * Every report store gets its own monotonically increasing request id so a slow
 * in-flight `load()` (superseded by new filters, a fresh `load()` call, or a
 * logout mid-request) can detect it's stale and skip writing to the store.
 * Keyed by the caller-supplied `key` so unrelated report stores never
 * invalidate each other.
 */
const reportRequestIds = new Map<string, number>();

function createReportRequestGuard(key: string) {
  const requestId = (reportRequestIds.get(key) ?? 0) + 1;
  reportRequestIds.set(key, requestId);
  const isCurrentSession = createSessionGuard();
  return () => requestId === reportRequestIds.get(key) && isCurrentSession();
}

function invalidateReportRequest(key: string) {
  reportRequestIds.set(key, (reportRequestIds.get(key) ?? 0) + 1);
}

interface ReportListParams {
  limit: PageLimit;
  page: number;
}

interface ReportStoreBaseState<Params, Response> {
  error: string | null;
  loading: boolean;
  response: Response | null;
  load: (params: Params) => Promise<Response>;
  reset: () => void;
}

export interface CreateReportStoreConfig<
  Params extends ReportListParams,
  Response,
  Normalized,
  Fields extends object
> {
  /** Unique id for this report's in-flight request generation (see createReportRequestGuard). */
  key: string;
  fetch: (params: Params) => Promise<Response>;
  normalize: (response: Response, params: Params) => Normalized;
  /** Loop bound for the "load all pages" batch walk, derived from the first page's result. */
  getTotalPages?: (normalized: Normalized, response: Response, params: Params) => number;
  /** Folds one more page's normalized result into the running accumulator. */
  mergePage?: (accumulated: Normalized, next: Normalized) => Normalized;
  /** Maps the (possibly multi-page) normalized result to the store's domain fields. `loadAll`
   *  reflects the caller's requested limit (`isAllPageLimit(params.limit)`), regardless of
   *  whether `batchAllPages` actually walked further pages. Fields left out (e.g. a static
   *  `loadExportData`) simply keep their current store value, per Zustand's partial `set`. */
  finalize: (merged: Normalized, response: Response, params: Params, loadAll: boolean) => Partial<Fields>;
  /** Full domain-field shape used for both the initial state and reset(). */
  emptyState: Fields;
  /**
   * When false, `params` is sent to `fetch` as-is and no page-walk loop runs — for reports
   * whose backend doesn't support the "load all" batch walk. Defaults to true.
   */
  batchAllPages?: boolean;
}

/**
 * Factory for the report stores that load one page of a list report at a time, optionally
 * walking every page in the background when the caller asks for the "All" page limit
 * (batching PAGE_LIMIT_ALL_BATCH-sized requests until every page has been merged in).
 * Centralizes the request guard, the page-walk loop, and reset() so each domain store only
 * supplies its fetch/normalize/merge/finalize glue.
 */
export function createReportStore<
  Params extends ReportListParams,
  Response,
  Normalized,
  Fields extends object
>(config: CreateReportStoreConfig<Params, Response, Normalized, Fields>) {
  const {
    key,
    fetch,
    normalize,
    getTotalPages = () => 1,
    mergePage = (_accumulated, next) => next,
    finalize,
    emptyState,
    batchAllPages = true
  } = config;

  type State = Fields & ReportStoreBaseState<Params, Response>;

  return create<State>((set) => ({
    ...emptyState,
    error: null,
    loading: false,
    response: null,
    load: async (params) => {
      const isCurrentRequest = createReportRequestGuard(key);
      set({ error: null, loading: true } as Partial<State>);
      try {
        const isAllLimit = isAllPageLimit(params.limit);
        const shouldBatch = batchAllPages && isAllLimit;
        const requestParams = shouldBatch ? ({ ...params, limit: PAGE_LIMIT_ALL_BATCH, page: 1 } as Params) : params;
        const response = await fetch(requestParams);
        let merged = normalize(response, requestParams);

        if (shouldBatch) {
          const totalPages = getTotalPages(merged, response, requestParams);
          for (let nextPage = 2; nextPage <= totalPages; nextPage += 1) {
            if (!isCurrentRequest()) return response;
            const nextParams = { ...requestParams, page: nextPage } as Params;
            const nextResponse = await fetch(nextParams);
            if (!isCurrentRequest()) return response;
            merged = mergePage(merged, normalize(nextResponse, nextParams));
          }
        }

        if (!isCurrentRequest()) return response;

        set({ ...finalize(merged, response, params, isAllLimit), loading: false, response } as Partial<State>);
        return response;
      } catch (error) {
        if (isCurrentRequest()) set({ error: errorMessage(error), loading: false } as Partial<State>);
        throw error;
      }
    },
    reset: () => {
      invalidateReportRequest(key);
      set({ ...emptyState, error: null, loading: false, response: null } as Partial<State>);
    }
  }));
}

export interface CreateSimpleReportStoreConfig<Params, Response, Fields extends object> {
  key: string;
  fetch: (params: Params) => Promise<Response>;
  finalize: (response: Response) => Partial<Fields>;
  emptyState: Fields;
  /** Clear domain fields back to emptyState the moment a load starts, so stale data from a
   *  previous report isn't shown while the new one is in flight. */
  clearOnStart?: boolean;
}

/**
 * Factory for the report stores that load a single, non-paginated result (e.g. a one-shot
 * summary report). Shares the same request guard and reset() plumbing as createReportStore
 * without forcing an unrelated page-walk shape onto a report that has no pages.
 */
export function createSimpleReportStore<Params, Response, Fields extends object>(
  config: CreateSimpleReportStoreConfig<Params, Response, Fields>
) {
  const { key, fetch, finalize, emptyState, clearOnStart = false } = config;

  type State = Fields & ReportStoreBaseState<Params, Response>;

  return create<State>((set) => ({
    ...emptyState,
    error: null,
    loading: false,
    response: null,
    load: async (params) => {
      const isCurrentRequest = createReportRequestGuard(key);
      set(
        (clearOnStart
          ? { ...emptyState, error: null, loading: true, response: null }
          : { error: null, loading: true }) as Partial<State>
      );
      try {
        const response = await fetch(params);
        if (isCurrentRequest()) set({ ...finalize(response), loading: false, response } as Partial<State>);
        return response;
      } catch (error) {
        if (isCurrentRequest()) set({ error: errorMessage(error), loading: false } as Partial<State>);
        throw error;
      }
    },
    reset: () => {
      invalidateReportRequest(key);
      set({ ...emptyState, error: null, loading: false, response: null } as Partial<State>);
    }
  }));
}

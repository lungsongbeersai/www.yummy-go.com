"use client";

import { DEFAULT_PAGE_LIMIT } from "@/lib/pagination";
import { getDailySaleItems, type DailySaleItemsResponse, type FetchDailySaleItemsParams } from "@/services/report";
import type { ApiEntity } from "@/services/shared/types";
import { registerSessionStoreReset } from "@/stores/session-store-registry";
import { createReportStore, defaultReportPagination, finalizeReportPagination } from "./create-report-store";
import {
  normalizeDailySaleItemsResponse,
  type DailySaleItemsBillGroup,
  type DailySaleItemsPagination
} from "./daily-sale-items-normalizers";

interface DailySaleItemsNormalized {
  bills: DailySaleItemsBillGroup[];
  pagination: DailySaleItemsPagination;
  reportTotal: ApiEntity;
  rows: ApiEntity[];
}

interface DailySaleItemsReportFields {
  bills: DailySaleItemsBillGroup[];
  limit: FetchDailySaleItemsParams["limit"];
  page: number;
  pagination: DailySaleItemsPagination;
  reportTotal: ApiEntity;
  rows: ApiEntity[];
  total: number;
  totalPages: number;
}

const emptyState: DailySaleItemsReportFields = {
  bills: [],
  limit: DEFAULT_PAGE_LIMIT,
  page: 1,
  pagination: defaultReportPagination(),
  reportTotal: {},
  rows: [],
  total: 0,
  totalPages: 1
};

export const useDailySaleItemsStore = createReportStore<
  FetchDailySaleItemsParams,
  DailySaleItemsResponse,
  DailySaleItemsNormalized,
  DailySaleItemsReportFields
>({
  key: "dailySaleItems",
  fetch: getDailySaleItems,
  normalize: normalizeDailySaleItemsResponse,
  getTotalPages: (normalized) => normalized.pagination.totalPages,
  mergePage: (accumulated, next) => ({ ...accumulated, bills: [...accumulated.bills, ...next.bills] }),
  finalize: (merged, response, params, loadAll) => {
    const pagination = finalizeReportPagination(merged.pagination, params.limit, loadAll, merged.bills.length);
    return {
      bills: merged.bills,
      limit: params.limit,
      page: pagination.page,
      pagination,
      reportTotal: merged.reportTotal,
      rows: merged.bills.flatMap((bill) => bill.items),
      total: pagination.total,
      totalPages: pagination.totalPages
    };
  },
  emptyState
});

registerSessionStoreReset("daily-sale-items-report", () => useDailySaleItemsStore.getState().reset());

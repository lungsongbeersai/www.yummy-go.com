"use client";

import { DEFAULT_PAGE_LIMIT } from "@/lib/pagination";
import {
  getDailySalesBillReport,
  type DailySalesBillReportResponse,
  type FetchDailySalesBillReportParams
} from "@/services/report";
import type { ApiEntity } from "@/services/shared/types";
import { registerSessionStoreReset } from "@/stores/session-store-registry";
import { createReportStore, defaultReportPagination, finalizeReportPagination } from "./create-report-store";
import {
  loadDailySalesBillReportExportData,
  type DailySalesBillReportExportParams,
  type DailySalesReportExportData
} from "./export-loaders";
import {
  normalizeDailySalesBillReportResponse,
  type DailySalesBillReportNormalized,
  type DailySalesBillReportPagination
} from "./daily-sales-bill-normalizers";

interface DailySalesBillReportFields {
  filters: ApiEntity;
  limit: FetchDailySalesBillReportParams["limit"];
  loadExportData: (params: DailySalesBillReportExportParams) => Promise<DailySalesReportExportData>;
  page: number;
  pagination: DailySalesBillReportPagination;
  rows: ApiEntity[];
  summary: ApiEntity;
  total: number;
  totalPages: number;
}

const emptyState: DailySalesBillReportFields = {
  filters: {},
  limit: DEFAULT_PAGE_LIMIT,
  loadExportData: loadDailySalesBillReportExportData,
  page: 1,
  pagination: defaultReportPagination(),
  rows: [],
  summary: {},
  total: 0,
  totalPages: 1
};

export const useDailySalesBillReportStore = createReportStore<
  FetchDailySalesBillReportParams,
  DailySalesBillReportResponse,
  DailySalesBillReportNormalized,
  DailySalesBillReportFields
>({
  key: "dailySalesBill",
  fetch: getDailySalesBillReport,
  normalize: normalizeDailySalesBillReportResponse,
  getTotalPages: (normalized) => normalized.pagination.totalPages,
  mergePage: (accumulated, next) => ({ ...accumulated, rows: [...accumulated.rows, ...next.rows] }),
  finalize: (merged, response, params, loadAll) => {
    const pagination = finalizeReportPagination(merged.pagination, params.limit, loadAll, merged.rows.length);
    return {
      filters: merged.filters,
      limit: params.limit,
      page: pagination.page,
      pagination,
      rows: merged.rows,
      summary: merged.summary,
      total: pagination.total,
      totalPages: pagination.totalPages
    };
  },
  emptyState
});

registerSessionStoreReset("daily-sales-bill-report", () => useDailySalesBillReportStore.getState().reset());

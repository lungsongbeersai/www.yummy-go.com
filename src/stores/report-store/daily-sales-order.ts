"use client";

import { DEFAULT_PAGE_LIMIT } from "@/lib/pagination";
import {
  getDailySalesOrderReport,
  type DailySalesOrderReportResponse,
  type FetchDailySalesOrderReportParams
} from "@/services/report";
import type { ApiEntity } from "@/services/shared/types";
import { registerSessionStoreReset } from "@/stores/session-store-registry";
import { createReportStore, defaultReportPagination, finalizeReportPagination } from "./create-report-store";
import {
  loadDailySalesOrderReportExportData,
  type DailySalesOrderReportExportParams,
  type DailySalesReportExportData
} from "./export-loaders";
import type { DailySalesBillGroup, SummaryCards } from "./normalizers";
import {
  normalizeDailySalesOrderReportResponse,
  type DailySalesOrderReportNormalized,
  type DailySalesOrderReportPagination
} from "./daily-sales-order-normalizers";

interface DailySalesOrderReportFields {
  billGroups: DailySalesBillGroup[];
  filters: ApiEntity;
  grandTotalByDate: ApiEntity[];
  limit: FetchDailySalesOrderReportParams["limit"];
  loadExportData: (params: DailySalesOrderReportExportParams) => Promise<DailySalesReportExportData>;
  page: number;
  pagination: DailySalesOrderReportPagination;
  reportTotal: ApiEntity;
  rows: ApiEntity[];
  summaryCards: SummaryCards;
  total: number;
  totalPages: number;
}

const emptyState: DailySalesOrderReportFields = {
  billGroups: [],
  filters: {},
  grandTotalByDate: [],
  limit: DEFAULT_PAGE_LIMIT,
  loadExportData: loadDailySalesOrderReportExportData,
  page: 1,
  pagination: defaultReportPagination(),
  reportTotal: {},
  rows: [],
  summaryCards: {},
  total: 0,
  totalPages: 1
};

export const useDailySalesOrderReportStore = createReportStore<
  FetchDailySalesOrderReportParams,
  DailySalesOrderReportResponse,
  DailySalesOrderReportNormalized,
  DailySalesOrderReportFields
>({
  key: "dailySalesOrder",
  fetch: getDailySalesOrderReport,
  normalize: normalizeDailySalesOrderReportResponse,
  getTotalPages: (normalized) => normalized.pagination.totalPages,
  mergePage: (accumulated, next) => ({
    ...accumulated,
    billGroups: [...accumulated.billGroups, ...next.billGroups],
    rows: [...accumulated.rows, ...next.rows]
  }),
  finalize: (merged, response, params, loadAll) => {
    const pagination = finalizeReportPagination(merged.pagination, params.limit, loadAll, merged.billGroups.length);
    return {
      billGroups: merged.billGroups,
      filters: merged.filters,
      grandTotalByDate: merged.grandTotalByDate,
      limit: params.limit,
      page: pagination.page,
      pagination,
      reportTotal: merged.reportTotal,
      rows: merged.rows,
      summaryCards: merged.summaryCards,
      total: pagination.total,
      totalPages: pagination.totalPages
    };
  },
  emptyState
});

registerSessionStoreReset("daily-sales-order-report", () => useDailySalesOrderReportStore.getState().reset());
